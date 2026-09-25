import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../admin.js';
import { requireStaff } from '../authz.js';
import { applyStockTransition } from '../stock.js';
import { COL, STOCK_REASON } from '../constants.js';

export const updateOrderStatus = onCall(async (request) => {
  const staff = await requireStaff(request, 'orders');
  const { orderId, newStatusId, comment } = request.data;
  if (!orderId || !newStatusId) throw new HttpsError('invalid-argument', 'orderId and newStatusId are required.');

  await db.runTransaction(async (tx) => {
    const orderRef = db.collection(COL.ORDERS).doc(orderId);
    const [orderSnap, newStatusSnap] = await Promise.all([
      tx.get(orderRef),
      tx.get(db.collection(COL.ORDER_STATUSES).doc(newStatusId)),
    ]);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Order not found.');
    if (!newStatusSnap.exists) throw new HttpsError('not-found', 'Target order status not found.');

    const order = orderSnap.data();
    const oldStatusSnap = await tx.get(db.collection(COL.ORDER_STATUSES).doc(order.orderStatusId));
    const oldStatus = oldStatusSnap.exists ? oldStatusSnap.data() : null;
    const newStatus = newStatusSnap.data();

    if (order.orderStatusId !== newStatusId) {
      const reason = newStatus.stockAction === 'commit' ? STOCK_REASON.ORDER_COMMIT : STOCK_REASON.ORDER_RESTOCK;
      await applyStockTransition(tx, oldStatus, newStatus, order.items, {
        orderId,
        reason,
        staffId: staff.uid,
      });
    }

    const updates = {
      orderStatusId: newStatusId,
      dateUpdated: FieldValue.serverTimestamp(),
    };
    if (newStatus.stockAction === 'commit' && !order.datePaid) updates.datePaid = FieldValue.serverTimestamp();

    tx.set(orderRef, updates, { merge: true });

    const commentRef = orderRef.collection('comments').doc();
    tx.set(commentRef, {
      author: 'staff',
      authorId: staff.uid,
      text: comment || `Status changed to ${newStatusId}`,
      dateCreated: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});
