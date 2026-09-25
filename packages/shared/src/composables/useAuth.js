import { ref, shallowRef } from 'vue';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { COL } from '../constants.js';

const currentUser = shallowRef(null);
const authReady = ref(false);

onAuthStateChanged(auth, (user) => {
  currentUser.value = user;
  authReady.value = true;
});

/** Shared auth state + actions. `profileCollection` picks staffUsers vs customers. */
export function useAuth(profileCollection = COL.CUSTOMERS) {
  const profile = shallowRef(null);
  const profileLoading = ref(false);

  async function loadProfile() {
    if (!currentUser.value) {
      profile.value = null;
      return;
    }
    profileLoading.value = true;
    const snap = await getDoc(doc(db, profileCollection, currentUser.value.uid));
    profile.value = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    profileLoading.value = false;
  }

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await loadProfile();
    return cred.user;
  }

  async function registerCustomer(email, password, extra = {}) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (extra.displayName) await updateProfile(cred.user, { displayName: extra.displayName });
    await setDoc(doc(db, COL.CUSTOMERS, cred.user.uid), {
      email,
      firstname: extra.firstname || '',
      lastname: extra.lastname || '',
      status: true,
      dateCreated: serverTimestamp(),
    });
    await loadProfile();
    return cred.user;
  }

  async function signOut() {
    await firebaseSignOut(auth);
    profile.value = null;
  }

  return { currentUser, authReady, profile, profileLoading, loadProfile, signIn, registerCustomer, signOut };
}

/** Does this staff profile have permission to view/edit a given admin section? */
export function hasPermission(staffProfile, appCode) {
  if (!staffProfile) return false;
  if (staffProfile.isSuperAdmin) return true;
  return !!staffProfile.permissions?.[appCode]?.status;
}
