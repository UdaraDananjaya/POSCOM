import { ref, shallowRef, watchEffect } from 'vue';
import { onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '../firebase.js';

/**
 * Realtime-subscribes to a Firestore collection (optionally with query
 * constraints) and keeps a reactive array of {id, ...data} in sync.
 * @param {string} path - collection path, e.g. 'products'
 * @param {() => import('firebase/firestore').QueryConstraint[]} [constraintsFn]
 *   reactive getter for query constraints (where/orderBy/limit) — re-subscribes when it changes
 */
export function useCollection(path, constraintsFn = () => []) {
  const data = shallowRef([]);
  const loading = ref(true);
  const error = shallowRef(null);

  watchEffect((onCleanup) => {
    loading.value = true;
    const q = query(collection(db, path), ...constraintsFn());
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        data.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        loading.value = false;
      },
      (err) => {
        error.value = err;
        loading.value = false;
      }
    );
    onCleanup(unsubscribe);
  });

  return { data, loading, error };
}
