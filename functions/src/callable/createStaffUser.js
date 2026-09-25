import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { db, FieldValue } from '../admin.js';
import { requireStaff } from '../authz.js';
import { COL } from '../constants.js';

/** Only a super-admin can create staff accounts — this mints Auth + Firestore records together. */
export const createStaffUser = onCall(async (request) => {
  const staff = await requireStaff(request);
  if (!staff.isSuperAdmin) throw new HttpsError('permission-denied', 'Only a super-admin can create staff accounts.');

  const { email, password, username, permissions = {}, isSuperAdmin = false } = request.data;
  if (!email || !password || !username) {
    throw new HttpsError('invalid-argument', 'email, password and username are required.');
  }

  const userRecord = await getAuth().createUser({ email, password, displayName: username });
  await db.collection(COL.STAFF_USERS).doc(userRecord.uid).set({
    username,
    email,
    status: true,
    isSuperAdmin,
    permissions,
    dateCreated: FieldValue.serverTimestamp(),
  });

  return { uid: userRecord.uid };
});
