import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin.js';
import { COL } from './constants.js';

export async function requireStaff(request, appCode = null) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Staff login required.');
  const snap = await db.collection(COL.STAFF_USERS).doc(request.auth.uid).get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'Not a staff account.');
  const staff = snap.data();
  if (staff.status === false) throw new HttpsError('permission-denied', 'Staff account disabled.');
  if (appCode && !staff.isSuperAdmin && !staff.permissions?.[appCode]?.status) {
    throw new HttpsError('permission-denied', `Missing '${appCode}' permission.`);
  }
  return { uid: request.auth.uid, ...staff };
}

export function requireCustomer(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Customer login required.');
  return request.auth.uid;
}
