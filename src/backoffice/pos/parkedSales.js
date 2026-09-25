import { ref } from 'vue';

// "Park" a sale: set the current cart aside (with an optional label, e.g. a
// customer name) so the cashier can serve someone else, then resume it later
// to finish charging it. Persisted to localStorage so it survives a reload.
const STORAGE_KEY = 'myshop_pos_parked_sales';

function readParked() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeParked(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const parkedSales = ref(readParked());

export function parkSale({ label, items, customer }) {
  const entry = {
    id: `parked_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: label?.trim() || '',
    items,
    customer: customer || null,
    parkedAt: Date.now(),
  };
  const list = [...parkedSales.value, entry];
  writeParked(list);
  parkedSales.value = list;
  return entry.id;
}

/** Removes and returns the parked entry (items + customer) so it can be loaded back into the active cart. */
export function resumeSale(id) {
  const entry = parkedSales.value.find((p) => p.id === id);
  if (!entry) return null;
  const list = parkedSales.value.filter((p) => p.id !== id);
  writeParked(list);
  parkedSales.value = list;
  return entry;
}

export function deleteParkedSale(id) {
  const list = parkedSales.value.filter((p) => p.id !== id);
  writeParked(list);
  parkedSales.value = list;
}
