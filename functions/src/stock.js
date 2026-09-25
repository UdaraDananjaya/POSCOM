import { db, FieldValue } from './admin.js';
import { COL, STOCK_ACTION, STOCK_REASON } from './constants.js';
import { HttpsError } from 'firebase-functions/v2/https';

function stockRef(productId, variantKey) {
  return variantKey
    ? db.collection(COL.PRODUCTS).doc(productId).collection('variants').doc(variantKey)
    : db.collection(COL.PRODUCTS).doc(productId);
}

/**
 * The single choke point for every quantity change in the system. Mirrors
 * LiteCart's two-phase stock model: a status with stockAction 'reserve' only
 * moves the soft `reserved` counter; 'commit' actually moves `quantity`.
 * Called with oldStatus=null on order creation (transition from "nothing").
 *
 * Must run inside a Firestore transaction. Reads every stock doc first (a
 * Firestore transaction requirement), then validates availability, then
 * stages every write — so it either fully applies or fully rejects.
 *
 * @param {import('firebase-admin/firestore').Transaction} tx
 * @param {{stockAction:string}|null} oldStatus
 * @param {{stockAction:string}|null} newStatus
 * @param {Array<{productId:string, variantKey?:string, quantity:number}>} items
 * @param {{orderId:string, reason:string, staffId?:string}} ctx
 */
export async function applyStockTransition(tx, oldStatus, newStatus, items, ctx) {
  const refs = items.map((i) => stockRef(i.productId, i.variantKey));
  const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

  const oldAction = oldStatus?.stockAction ?? STOCK_ACTION.NONE;
  const newAction = newStatus?.stockAction ?? STOCK_ACTION.NONE;

  // Validate availability for whichever new action will withdraw/hold stock,
  // computed against post-release-of-old-hold state.
  snaps.forEach((snap, idx) => {
    const item = items[idx];
    const stock = snap.exists ? snap.data() : { quantity: 0, reserved: 0 };
    let quantity = stock.quantity ?? 0;
    let reserved = stock.reserved ?? 0;

    if (oldAction === STOCK_ACTION.COMMIT) quantity += item.quantity; // hypothetical restock
    if (oldAction === STOCK_ACTION.RESERVE) reserved -= item.quantity; // hypothetical release

    const available = quantity - reserved;
    if ((newAction === STOCK_ACTION.COMMIT || newAction === STOCK_ACTION.RESERVE) && available < item.quantity) {
      throw new HttpsError(
        'failed-precondition',
        `Insufficient stock for product ${item.productId}${item.variantKey ? `/${item.variantKey}` : ''}: ` +
          `requested ${item.quantity}, available ${available}`
      );
    }
  });

  refs.forEach((ref, idx) => {
    const item = items[idx];
    const updates = {};

    if (oldAction === STOCK_ACTION.COMMIT) updates.quantity = FieldValue.increment(item.quantity);
    if (oldAction === STOCK_ACTION.RESERVE) updates.reserved = FieldValue.increment(-item.quantity);
    if (newAction === STOCK_ACTION.COMMIT) updates.quantity = FieldValue.increment(-item.quantity);
    if (newAction === STOCK_ACTION.RESERVE) updates.reserved = FieldValue.increment(item.quantity);

    if (Object.keys(updates).length) tx.set(ref, updates, { merge: true });

    if (oldAction !== newAction) {
      const movementRef = db.collection(COL.STOCK_MOVEMENTS).doc();
      tx.set(movementRef, {
        productId: item.productId,
        variantKey: item.variantKey || null,
        quantityDelta:
          (newAction === STOCK_ACTION.COMMIT ? -item.quantity : 0) +
          (oldAction === STOCK_ACTION.COMMIT ? item.quantity : 0),
        reservedDelta:
          (newAction === STOCK_ACTION.RESERVE ? item.quantity : 0) +
          (oldAction === STOCK_ACTION.RESERVE ? -item.quantity : 0),
        reason: ctx.reason,
        orderId: ctx.orderId,
        staffId: ctx.staffId || null,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });
}

/** Direct manual adjustment (receiving stock, stock-take correction) — always hits `quantity`, never `reserved`. */
export async function applyManualAdjustment(tx, { productId, variantKey, delta, reason, staffId, note }) {
  const ref = stockRef(productId, variantKey);
  const snap = await tx.get(ref);
  const quantity = (snap.exists ? snap.data().quantity : 0) ?? 0;
  if (quantity + delta < 0) {
    throw new HttpsError('failed-precondition', `Adjustment would make stock negative for ${productId}`);
  }
  tx.set(ref, { quantity: FieldValue.increment(delta) }, { merge: true });
  const movementRef = db.collection(COL.STOCK_MOVEMENTS).doc();
  tx.set(movementRef, {
    productId,
    variantKey: variantKey || null,
    quantityDelta: delta,
    reservedDelta: 0,
    reason: reason || STOCK_REASON.MANUAL_ADJUSTMENT,
    staffId: staffId || null,
    note: note || null,
    createdAt: FieldValue.serverTimestamp(),
  });
}
