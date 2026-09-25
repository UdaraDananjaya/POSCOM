import { ref } from 'vue';
import { placePosSale } from '../../services/orders.js';

// POS sales must still work with a flaky in-store connection: a sale that
// can't reach Firebase right now is queued in localStorage (survives a page
// reload/crash) and retried in order as soon as the browser is back online —
// each queued sale only leaves the queue once placePosSale() actually
// succeeds, so a sale is never silently dropped nor double-submitted.
const STORAGE_KEY = 'myshop_pos_offline_queue';

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeQueue(queue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export const pendingCount = ref(readQueue().length);
export const syncing = ref(false);

export function enqueueSale(payload) {
  const queue = readQueue();
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  queue.push({ localId, payload, queuedAt: Date.now() });
  writeQueue(queue);
  pendingCount.value = queue.length;
  return localId;
}

let flushing = false;
export async function flushQueue() {
  if (flushing || syncing.value) return;
  flushing = true;
  syncing.value = true;
  try {
    let queue = readQueue();
    while (queue.length > 0 && navigator.onLine) {
      const [next, ...rest] = queue;
      try {
        await placePosSale(next.payload);
        queue = rest;
        writeQueue(queue);
        pendingCount.value = queue.length;
      } catch (err) {
        // Stop on first failure (e.g. still offline, or a real validation
        // error) so we don't reorder sales or spin on a broken item forever.
        console.warn('POS offline queue: sale failed to sync, will retry later', err);
        break;
      }
    }
  } finally {
    flushing = false;
    syncing.value = false;
  }
}

window.addEventListener('online', flushQueue);
setInterval(flushQueue, 30_000);
flushQueue();
