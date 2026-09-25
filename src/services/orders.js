import { collection, doc, addDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { COL, ORDER_SOURCE, STOCK_REASON, DEFAULT_ORDER_STATUS } from '../constants.js';
import { getApplicableTaxRates } from './tax.js';
import { buildOrderTotals } from './orderTotals.js';
import { applyStockTransition } from './stock.js';

async function fetchTaxContext() {
  const [taxRatesSnap, geoZonesSnap] = await Promise.all([
    getDocs(collection(db, COL.TAX_RATES)),
    getDocs(collection(db, COL.GEO_ZONES)),
  ]);
  return {
    taxRates: taxRatesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    geoZones: geoZonesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

/**
 * Places a customer's Ecom order at the default 'pending' status. Pending is
 * seeded with stockAction 'none', so this is a plain document write — stock
 * is only touched once staff move the order to a paid/commit status via
 * updateOrderStatus(). That keeps the customer's own Firestore write
 * privileges simple: they only ever create their own order document, never
 * touch the products collection directly.
 */
export async function placeEcomOrder({ items, customer, shippingOption, paymentOption, currencyCode = 'USD', customerId }) {
  const { taxRates, geoZones } = await fetchTaxContext();
  const taxCustomer = { ...customer, paymentAddress: customer, shippingAddress: customer };
  const getRatesFor = (taxClassId) => getApplicableTaxRates({ taxRates, geoZones, taxClassId, customer: taxCustomer });

  const itemsWithTax = items.map((item) => {
    const rates = getRatesFor(item.taxClassId);
    const unitTax = rates.reduce((s, r) => s + (r.type === 'fixed' ? Number(r.rate) : item.price * (Number(r.rate) / 100)), 0);
    return { ...item, tax: Math.round(unitTax * 100) / 100 };
  });

  const totals = buildOrderTotals({ items: itemsWithTax, shippingOption, paymentOption, taxContext: { getRatesFor } });
  const publicKey = crypto.randomUUID();

  const orderRef = await addDoc(collection(db, COL.ORDERS), {
    source: ORDER_SOURCE.ECOM,
    customerId,
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
    dateCreated: serverTimestamp(),
    dateUpdated: serverTimestamp(),
  });

  return { orderId: orderRef.id, publicKey };
}

/** A POS sale is paid on the spot: stock commit + order creation happen in one atomic transaction. */
export async function placePosSale({ items, payments, currencyCode = 'USD', staffId, customer = null }) {
  const orderRef = doc(collection(db, COL.ORDERS));

  await runTransaction(db, async (tx) => {
    const statusSnap = await tx.get(doc(db, COL.ORDER_STATUSES, DEFAULT_ORDER_STATUS.PAID));
    if (!statusSnap.exists()) throw new Error('Order status "paid" is not seeded yet — run the seed script first.');
    const paidStatus = statusSnap.data();

    await applyStockTransition(tx, null, paidStatus, items, {
      orderId: orderRef.id,
      reason: STOCK_REASON.POS_SALE,
      staffId,
    });

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const taxTotal = items.reduce((s, i) => s + (i.tax || 0) * i.quantity, 0);

    tx.set(orderRef, {
      source: ORDER_SOURCE.POS,
      staffId,
      customer,
      items,
      payments: payments || [],
      currencyCode,
      subtotal,
      taxTotal,
      paymentDue: subtotal + taxTotal,
      orderStatusId: DEFAULT_ORDER_STATUS.PAID,
      dateCreated: serverTimestamp(),
      dateUpdated: serverTimestamp(),
      datePaid: serverTimestamp(),
    });
  });

  return { orderId: orderRef.id };
}

/** Staff-only: move an order to a new status; stock is restocked/withdrawn per the two statuses' stockAction. */
export async function updateOrderStatus({ orderId, newStatusId, comment, staffId }) {
  await runTransaction(db, async (tx) => {
    const orderRef = doc(db, COL.ORDERS, orderId);
    const [orderSnap, newStatusSnap] = await Promise.all([
      tx.get(orderRef),
      tx.get(doc(db, COL.ORDER_STATUSES, newStatusId)),
    ]);
    if (!orderSnap.exists()) throw new Error('Order not found.');
    if (!newStatusSnap.exists()) throw new Error('Target order status not found.');

    const order = orderSnap.data();
    const oldStatusSnap = await tx.get(doc(db, COL.ORDER_STATUSES, order.orderStatusId));
    const oldStatus = oldStatusSnap.exists() ? oldStatusSnap.data() : null;
    const newStatus = newStatusSnap.data();

    if (order.orderStatusId !== newStatusId) {
      const reason = newStatus.stockAction === 'commit' ? STOCK_REASON.ORDER_COMMIT : STOCK_REASON.ORDER_RESTOCK;
      await applyStockTransition(tx, oldStatus, newStatus, order.items, { orderId, reason, staffId });
    }

    const updates = { orderStatusId: newStatusId, dateUpdated: serverTimestamp() };
    if (newStatus.stockAction === 'commit' && !order.datePaid) updates.datePaid = serverTimestamp();
    tx.set(orderRef, updates, { merge: true });

    const commentRef = doc(collection(db, COL.ORDERS, orderId, 'comments'));
    tx.set(commentRef, {
      author: 'staff',
      authorId: staffId,
      text: comment || `Status changed to ${newStatusId}`,
      dateCreated: serverTimestamp(),
    });
  });
}
