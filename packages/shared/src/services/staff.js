import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

/** Super-admin only: mints a Firebase Auth account + staffUsers doc together. */
export function createStaffUser(payload) {
  // payload: { email, password, username, permissions, isSuperAdmin }
  return httpsCallable(functions, 'createStaffUser')(payload);
}
