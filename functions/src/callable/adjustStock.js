import { onCall } from 'firebase-functions/v2/https';
import { db } from '../admin.js';
import { requireStaff } from '../authz.js';
import { applyManualAdjustment } from '../stock.js';

export const adjustStock = onCall(async (request) => {
  const staff = await requireStaff(request, 'catalog');
  const { productId, variantKey, delta, reason, note } = request.data;
  if (!productId || typeof delta !== 'number' || delta === 0) {
    throw new Error('productId and a non-zero numeric delta are required.');
  }

  await db.runTransaction((tx) =>
    applyManualAdjustment(tx, { productId, variantKey, delta, reason, staffId: staff.uid, note })
  );

  return { ok: true };
});
