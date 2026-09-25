import { doc, onSnapshot } from 'firebase/firestore';
import { ref } from 'vue';
import { db } from '../firebase.js';
import { COL } from '../constants.js';

/** Realtime global store settings (settings/global) — store name, contact info, checkout defaults. */
export function useStoreSettings() {
  const settings = ref(null);
  const loading = ref(true);
  onSnapshot(doc(db, COL.SETTINGS, 'global'), (snap) => {
    settings.value = snap.exists() ? snap.data() : null;
    loading.value = false;
  });
  return { settings, loading };
}
