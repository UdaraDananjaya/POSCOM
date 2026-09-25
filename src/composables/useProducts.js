import { where, orderBy as fbOrderBy } from 'firebase/firestore';
import { useCollection } from './useCollection.js';
import { COL } from '../constants.js';

/** All enabled products, optionally filtered by category. Realtime. */
export function useProducts({ categoryId = null, activeOnly = true } = {}) {
  return useCollection(COL.PRODUCTS, () => {
    const constraints = [];
    if (activeOnly) constraints.push(where('status', '==', true));
    if (categoryId) constraints.push(where('categories', 'array-contains', categoryId));
    constraints.push(fbOrderBy('name.en'));
    return constraints;
  });
}

export function useCategories({ activeOnly = true } = {}) {
  return useCollection(COL.CATEGORIES, () => {
    const constraints = [];
    if (activeOnly) constraints.push(where('status', '==', true));
    constraints.push(fbOrderBy('priority'));
    return constraints;
  });
}

/** quantityAvailable = on-hand quantity minus reserved (soft-held by non-committed orders). */
export function getQuantityAvailable(stockDoc) {
  return (stockDoc?.quantity ?? 0) - (stockDoc?.reserved ?? 0);
}

export function isOrderable(product, soldOutStatus) {
  if (getQuantityAvailable(product) > 0) return true;
  return !!soldOutStatus?.orderable;
}
