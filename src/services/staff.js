import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase.js';
import { COL } from '../constants.js';

/**
 * Creates a new staff Auth account + staffUsers doc without touching the
 * current admin's own session. Firebase's client SDK signs the newly created
 * user in on whatever app instance made the call, so this spins up a
 * throwaway secondary app instance for the create + immediately tears it
 * down — a standard pattern for "admin creates another user" without a
 * server-side Admin SDK. Firestore rules still gate who may call this
 * (staffUsers create is restricted to isSuperAdmin).
 */
export async function createStaffUser({ email, password, username, permissions = {}, isSuperAdmin = false }) {
  const secondaryApp = initializeApp(firebaseConfig, `staff-create-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(db, COL.STAFF_USERS, cred.user.uid), {
      username,
      email,
      status: true,
      isSuperAdmin,
      permissions,
      dateCreated: serverTimestamp(),
    });
    await signOut(secondaryAuth);
    return { uid: cred.user.uid };
  } finally {
    await deleteApp(secondaryApp);
  }
}
