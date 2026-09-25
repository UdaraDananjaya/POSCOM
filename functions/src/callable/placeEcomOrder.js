import { randomUUID } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../admin.js';
import { requireCustomer } from '../authz.js';
import { applyStockTransition } from '../stock.js';
import { COL, ORDER_SOURCE, STOCK_REASON, DEFAULT_ORDER_STATUS } from '../constants.js';
import { getApplicableTaxRates } from '../../../packages/shared/src/services/tax.js';
import { buildOrderTotals } from '../../../packages/shared/src/services/orderTotals.js';

/** Ecom orders start at the default initial status (seeded 'pending', stockAction 'reserve'). */
export const placeEcomOrder = onCall(async (request) => {
  const uid = requireCustomer(request);
  const { items, customer, shippingOption, paymentOption, currencyCode = 'USD' } = request.data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError('invalid-argument', 'items[] is required.');
  }

  const [taxRatesSnap, geoZonesSnap] = await Promise.all([
    db.collection(COL.TAX_RATES).get(),
    db.collection(COL.GEO_ZONES).get(),
  ]);
  const taxRates = taxRatesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const geoZones = geoZonesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Checkout collects one address (no separate billing step yet), so it doubles
  // as both the payment and shipping address for tax-rate matching.
  const taxCustomer = { ...customer, paymentAddress: customer, shippingAddress: customer };

  const itemsWithTax = items.map((item) => {
    const rates = getApplicableTaxRates({ taxRates, geoZones, taxClassId: item.taxClassId, customer: taxCustomer });
    const unitTax = rates.reduce((s, r) => s + (r.type === 'fixed' ? Number(r.rate) : item.price * (Number(r.rate) / 100)), 0);
    return { ...item, tax: Math.round(unitTax * 100) / 100 };
  });

  const totals = buildOrderTotals({
    items: itemsWithTax,
    shippingOption,
    paymentOption,
    taxContext: { getRatesFor: (taxClassId) => getApplicableTaxRates({ taxRates, geoZones, taxClassId, customer: taxCustomer }) },
  });

  const orderRef = db.collection(COL.ORDERS).doc();
  const publicKey = randomUUID();

  await db.runTransaction(async (tx) => {
    const statusSnap = await tx.get(db.collection(COL.ORDER_STATUSES).doc(DEFAULT_ORDER_STATUS.PENDING));
    if (!statusSnap.exists) throw new HttpsError('failed-precondition', 'Order status "pending" is not seeded.');
    const pendingStatus = statusSnap.data();

    await applyStockTransition(tx, null, pendingStatus, itemsWithTax, {
      orderId: orderRef.id,
      reason: STOCK_REASON.ORDER_RESERVE,
    });

    tx.set(orderRef, {
      source: ORDER_SOURCE.ECOM,
      customerId: uid,
      customer,
      items: itemsWithTax,
      shippingOption: shippingOption || null,
      paymentOption: paymentOption || null,
      orderTotal: totals.rows,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      paymentDue: totals.paymentDue,
      currencyCode,
      orderStatusId: DEFAULT_ORDER_STATUS.PENDING,
      publicKey,
      dateCreated: FieldValue.serverTimestamp(),
      dateUpdated: FieldValue.serverTimestamp(),
    });
  });

  return { orderId: orderRef.id, publicKey };
});
