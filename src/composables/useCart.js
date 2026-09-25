import { reactive, computed, watch } from 'vue';
import { roundMoney } from '../utils/money.js';

/**
 * Reactive cart persisted to localStorage under `storageKey` — used by both
 * the POS sale screen and the Ecom cart/checkout with different keys so
 * they never bleed into each other on a shared device.
 */
export function useCart(storageKey) {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const items = reactive(stored);

  watch(
    () => items.map((i) => ({ ...i })),
    (val) => localStorage.setItem(storageKey, JSON.stringify(val)),
    { deep: true }
  );

  function lineKey(productId, variantKey) {
    return variantKey ? `${productId}::${variantKey}` : productId;
  }

  function addItem({ productId, variantKey = null, name, sku, price, tax = 0, quantity = 1, maxQuantity = Infinity, image = null, taxClassId = null }) {
    const key = lineKey(productId, variantKey);
    const existing = items.find((i) => i.key === key);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, maxQuantity);
    } else {
      items.push({ key, productId, variantKey, name, sku, price, tax, quantity: Math.min(quantity, maxQuantity), maxQuantity, image, taxClassId });
    }
  }

  function updateQuantity(key, quantity) {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (quantity <= 0) return removeItem(key);
    item.quantity = Math.min(quantity, item.maxQuantity ?? Infinity);
  }

  function removeItem(key) {
    const idx = items.findIndex((i) => i.key === key);
    if (idx !== -1) items.splice(idx, 1);
  }

  function clear() {
    items.splice(0, items.length);
  }

  const subtotal = computed(() => roundMoney(items.reduce((s, i) => s + i.price * i.quantity, 0)));
  const taxTotal = computed(() => roundMoney(items.reduce((s, i) => s + i.tax * i.quantity, 0)));
  const itemCount = computed(() => items.reduce((s, i) => s + i.quantity, 0));

  return { items, addItem, updateQuantity, removeItem, clear, subtotal, taxTotal, itemCount };
}
