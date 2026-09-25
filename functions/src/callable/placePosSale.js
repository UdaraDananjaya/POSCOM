import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../admin.js';
import { requireStaff } from '../authz.js';
import { applyStockTransition } from '../stock.js';
import { COL, ORDER_SOURCE, STOCK_REASON, DEFAULT_ORDER_STATUS } from '../constants.js';

/** A POS sale is paid on the spot, so it's created directly at the 'paid' status (stockAction commit). */
export const placePosSale = onCall(async (request) => {
  const staff = await requireStaff(request, 'orders');
  const { items, payments, currencyCode = 'USD' } = request.data;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError('invalid-argument', 'items[] is required.');
  }

  const orderRef = db.collection(COL.ORDERS).doc();

  await db.runTransaction(async (tx) => {
    const statusSnap = await tx.get(db.collection(COL.ORDER_STATUSES).doc(DEFAULT_ORDER_STATUS.PAID));
    if (!statusSnap.exists) throw new HttpsError('failed-precondition', 'Order status "paid" is not seeded.');
    const paidStatus = statusSnap.data();

    await applyStockTransition(tx, null, paidStatus, items, {
      orderId: orderRef.id,
      reason: STOCK_REASON.POS_SALE,
      staffId: staff.uid,
    });

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const taxTotal = items.reduce((s, i) => s + (i.tax || 0) * i.quantity, 0);

    tx.set(orderRef, {
      source: ORDER_SOURCE.POS,
      staffId: staff.uid,
      items,
      payments: payments || [],
      currencyCode,
      subtotal,
      taxTotal,
      paymentDue: subtotal + taxTotal,
      orderStatusId: DEFAULT_ORDER_STATUS.PAID,
      dateCreated: FieldValue.serverTimestamp(),
      dateUpdated: FieldValue.serverTimestamp(),
      datePaid: FieldValue.serverTimestamp(),
    });
  });

  return { orderId: orderRef.id };
});
