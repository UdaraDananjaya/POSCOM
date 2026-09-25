import { runTransaction, doc, collection, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { COL, STOCK_ACTION, STOCK_REASON } from '../constants.js';

function stockRef(productId, variantKey) {
  return variantKey
    ? doc(db, COL.PRODUCTS, productId, 'variants', variantKey)
    : doc(db, COL.PRODUCTS, productId);
}

/**
 * The single choke point for every quantity change in the system. Mirrors
 * LiteCart's two-phase stock model: a status with stockAction 'reserve' only
 * moves the soft `reserved` counter; 'commit' actually moves `quantity`.
 * Called with oldStatus=null on order creation (transition from "nothing").
 *
 * Must be called with an already-open Firestore transaction (`tx`) so it can
 * be combined atomically with whatever order write triggered it (a POS sale,
 * or a staff-driven order status change) — see services/orders.js. All stock
 * doc reads happen first (a Firestore transaction requirement), then
 * availability is validated, then every write is staged — so it either fully
 * applies or fully rejects.
 *
 * @param {import('firebase/firestore').Transaction} tx
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

  snaps.forEach((snap, idx) => {
    const item = items[idx];
    const stock = snap.exists() ? snap.data() : { quantity: 0, reserved: 0 };
    let quantity = stock.quantity ?? 0;
    let reserved = stock.reserved ?? 0;

    if (oldAction === STOCK_ACTION.COMMIT) quantity += item.quantity; // hypothetical restock
    if (oldAction === STOCK_ACTION.RESERVE) reserved -= item.quantity; // hypothetical release

    const available = quantity - reserved;
    if ((newAction === STOCK_ACTION.COMMIT || newAction === STOCK_ACTION.RESERVE) && available < item.quantity) {
      throw new Error(
        `Insufficient stock for ${item.name || item.sku || item.productId}: requested ${item.quantity}, available ${available}`
      );
    }
  });

  refs.forEach((ref, idx) => {
    const item = items[idx];
    const updates = {};

    if (oldAction === STOCK_ACTION.COMMIT) updates.quantity = increment(item.quantity);
    if (oldAction === STOCK_ACTION.RESERVE) updates.reserved = increment(-item.quantity);
    if (newAction === STOCK_ACTION.COMMIT) updates.quantity = increment(-item.quantity);
    if (newAction === STOCK_ACTION.RESERVE) updates.reserved = increment(item.quantity);

    if (Object.keys(updates).length) tx.set(ref, updates, { merge: true });

    if (oldAction !== newAction) {
      const movementRef = doc(collection(db, COL.STOCK_MOVEMENTS));
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
        orderId: ctx.orderId || null,
        staffId: ctx.staffId || null,
        createdAt: serverTimestamp(),
      });
    }
  });
}

/** Standalone manual stock adjustment (receiving, stock-take correction) — always hits `quantity`, never `reserved`. */
export async function adjustStock({ productId, variantKey, delta, reason, staffId, note }) {
  await runTransaction(db, async (tx) => {
    const ref = stockRef(productId, variantKey);
    const snap = await tx.get(ref);
    const quantity = (snap.exists() ? snap.data().quantity : 0) ?? 0;
    if (quantity + delta < 0) throw new Error('Adjustment would make stock negative.');

    tx.set(ref, { quantity: increment(delta) }, { merge: true });
    const movementRef = doc(collection(db, COL.STOCK_MOVEMENTS));
    tx.set(movementRef, {
      productId,
      variantKey: variantKey || null,
      quantityDelta: delta,
      reservedDelta: 0,
      reason: reason || STOCK_REASON.MANUAL_ADJUSTMENT,
      staffId: staffId || null,
      note: note || null,
      createdAt: serverTimestamp(),
    });
  });
}
