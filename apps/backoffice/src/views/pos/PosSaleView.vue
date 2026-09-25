<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, useProducts, useAuth, COL, formatMoney, getQuantityAvailable, placePosSale } from '@myshop/shared';
import { enqueueSale } from '../../pos/offlineQueue.js';
import { CURRENCY_SYMBOL, DEFAULT_CURRENCY } from '../../config.js';

const { profile } = useAuth(COL.STAFF_USERS);
const { data: products } = useProducts();

const scanInput = ref('');
const scanInputRef = ref(null);
const search = ref('');
const snackbar = ref({ show: false, text: '', color: 'error' });

const cart = ref([]); // {key, productId, variantKey, name, sku, price, quantity, maxQuantity}

const variantDialog = ref(false);
const variantProduct = ref(null);
const variantList = ref([]);
const selectedValues = ref({});
let unsubVariants = null;

const tenderDialog = ref(false);
const tenderMethod = ref('cash');
const cashTendered = ref(0);
const completing = ref(false);

const receiptDialog = ref(false);
const lastReceipt = ref(null);

const isOnline = ref(navigator.onLine);
window.addEventListener('online', () => (isOnline.value = true));
window.addEventListener('offline', () => (isOnline.value = false));

onMounted(() => focusScan());
function focusScan() {
  nextTick(() => scanInputRef.value?.focus());
}

function notify(text, color = 'error') {
  snackbar.value = { show: true, text, color };
}

const subtotal = computed(() => cart.value.reduce((s, i) => s + i.price * i.quantity, 0));
const itemCount = computed(() => cart.value.reduce((s, i) => s + i.quantity, 0));

const filteredProducts = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return products.value;
  return products.value.filter(
    (p) => (p.name?.en || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
  );
});

function addSimpleToCart(product, quantity = 1) {
  const available = getQuantityAvailable(product);
  if (available <= 0) return notify(`${product.name?.en} is out of stock`);
  const existing = cart.value.find((i) => i.key === product.id);
  const nextQty = (existing?.quantity || 0) + quantity;
  if (nextQty > available) return notify(`Only ${available} of ${product.name?.en} available`);
  if (existing) existing.quantity = nextQty;
  else {
    cart.value.push({
      key: product.id, productId: product.id, variantKey: null,
      name: product.name?.en, sku: product.sku, price: product.prices?.[DEFAULT_CURRENCY] || 0,
      quantity, maxQuantity: available,
    });
  }
}

function selectProduct(product) {
  if (product.options?.length) {
    openVariantPicker(product);
  } else {
    addSimpleToCart(product);
  }
}

function openVariantPicker(product) {
  variantProduct.value = product;
  selectedValues.value = {};
  variantDialog.value = true;
  unsubVariants?.();
  unsubVariants = onSnapshot(collection(db, COL.PRODUCTS, product.id, 'variants'), (snap) => {
    variantList.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

const variantCombinationKey = computed(() => {
  if (!variantProduct.value) return null;
  const opts = variantProduct.value.options;
  if (opts.some((o) => o.required && !selectedValues.value[o.id])) return null;
  return opts.map((o) => `${o.id}:${selectedValues.value[o.id]}`).filter((s) => !s.endsWith(':undefined')).sort().join(',');
});
const selectedVariant = computed(() => variantList.value.find((v) => v.id === variantCombinationKey.value));

function confirmVariant() {
  const variant = selectedVariant.value;
  if (!variant) return;
  const available = getQuantityAvailable(variant);
  if (available <= 0) return notify('That variant is out of stock');
  const key = `${variantProduct.value.id}::${variant.id}`;
  const existing = cart.value.find((i) => i.key === key);
  if (existing) existing.quantity += 1;
  else {
    cart.value.push({
      key, productId: variantProduct.value.id, variantKey: variant.id,
      name: `${variantProduct.value.name?.en} (${variant.sku || variant.id})`,
      sku: variant.sku, price: variantProduct.value.prices?.[DEFAULT_CURRENCY] || 0,
      quantity: 1, maxQuantity: available,
    });
  }
  variantDialog.value = false;
}

function handleScan() {
  const code = scanInput.value.trim();
  scanInput.value = '';
  if (!code) return;
  const product = products.value.find((p) => (p.sku || '').toLowerCase() === code.toLowerCase());
  if (!product) return notify(`No product found for "${code}"`);
  selectProduct(product);
}

function updateQty(item, delta) {
  const next = item.quantity + delta;
  if (next <= 0) return removeItem(item);
  if (next > item.maxQuantity) return notify(`Only ${item.maxQuantity} available`);
  item.quantity = next;
}
function removeItem(item) {
  cart.value = cart.value.filter((i) => i.key !== item.key);
}
function clearCart() {
  cart.value = [];
}

function openTender() {
  if (!cart.value.length) return;
  cashTendered.value = subtotal.value;
  tenderDialog.value = true;
}

const changeDue = computed(() => Math.max(0, (Number(cashTendered.value) || 0) - subtotal.value));

async function completeSale() {
  completing.value = true;
  const payload = {
    items: cart.value.map((i) => ({
      productId: i.productId, variantKey: i.variantKey, name: i.name, sku: i.sku,
      price: i.price, tax: 0, quantity: i.quantity,
    })),
    payments: [{ method: tenderMethod.value, amount: tenderMethod.value === 'cash' ? Number(cashTendered.value) : subtotal.value }],
    currencyCode: DEFAULT_CURRENCY,
  };

  let receiptItems = [...cart.value];
  let queued = false;

  try {
    if (!navigator.onLine) throw new Error('offline');
    await placePosSale(payload);
  } catch (err) {
    if (!navigator.onLine || err.message === 'offline' || err.code === 'unavailable' || err.code === 'internal') {
      enqueueSale(payload);
      queued = true;
    } else {
      completing.value = false;
      return notify(err.message || 'Could not complete sale');
    }
  }

  lastReceipt.value = {
    items: receiptItems, subtotal: subtotal.value, method: tenderMethod.value,
    cashTendered: cashTendered.value, changeDue: changeDue.value, queued,
    staff: profile.value?.username, date: new Date(),
  };
  clearCart();
  tenderDialog.value = false;
  completing.value = false;
  receiptDialog.value = true;
}

function printReceipt() {
  window.print();
}
</script>

<template>
  <div class="d-flex" style="height: 100vh">
    <div class="flex-grow-1 pa-4 overflow-y-auto">
      <v-alert v-if="!isOnline" type="warning" density="compact" class="mb-3">
        Offline — sales will queue and sync automatically once connection returns.
      </v-alert>

      <v-text-field
        ref="scanInputRef"
        v-model="scanInput"
        label="Scan barcode or type SKU, then press Enter"
        prepend-inner-icon="mdi-barcode-scan"
        autofocus
        class="mb-3"
        @keyup.enter="handleScan"
      />
      <v-text-field v-model="search" label="Or search by name" prepend-inner-icon="mdi-magnify" class="mb-3" density="compact" />

      <v-row>
        <v-col v-for="p in filteredProducts" :key="p.id" cols="6" sm="4" md="3">
          <v-card @click="selectProduct(p)" :disabled="getQuantityAvailable(p) <= 0">
            <v-img :src="p.images?.[0]?.url" height="90" cover class="bg-grey-lighten-3" />
            <v-card-text class="pb-1">
              <div class="text-body-2 font-weight-medium text-truncate">{{ p.name?.en }}</div>
              <div class="d-flex justify-space-between">
                <span class="font-weight-bold">{{ formatMoney(p.prices?.[DEFAULT_CURRENCY] || 0, { symbol: CURRENCY_SYMBOL }) }}</span>
                <span class="text-caption text-medium-emphasis">{{ getQuantityAvailable(p) }} left</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <div class="d-flex flex-column border-s" style="width: 380px; min-width: 380px">
      <div class="pa-4 flex-grow-1 overflow-y-auto">
        <div class="d-flex align-center mb-3">
          <h2 class="text-h6">Sale ({{ itemCount }})</h2>
          <v-spacer />
          <v-btn size="small" variant="text" @click="clearCart" v-if="cart.length">Clear</v-btn>
        </div>
        <v-list density="compact">
          <v-list-item v-for="item in cart" :key="item.key">
            <v-list-item-title>{{ item.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ formatMoney(item.price, { symbol: CURRENCY_SYMBOL }) }} each</v-list-item-subtitle>
            <template #append>
              <div class="d-flex align-center ga-1">
                <v-btn icon="mdi-minus" size="x-small" variant="text" @click="updateQty(item, -1)" />
                <span>{{ item.quantity }}</span>
                <v-btn icon="mdi-plus" size="x-small" variant="text" @click="updateQty(item, 1)" />
              </div>
            </template>
          </v-list-item>
        </v-list>
        <v-empty-state v-if="!cart.length" icon="mdi-cart-outline" title="Cart is empty" />
      </div>
      <v-divider />
      <div class="pa-4">
        <div class="d-flex justify-space-between text-h6 font-weight-bold mb-3">
          <span>Total</span><span>{{ formatMoney(subtotal, { symbol: CURRENCY_SYMBOL }) }}</span>
        </div>
        <v-btn color="primary" block size="large" :disabled="!cart.length" @click="openTender">Charge</v-btn>
      </div>
    </div>
  </div>

  <!-- Variant picker -->
  <v-dialog v-model="variantDialog" max-width="420">
    <v-card v-if="variantProduct">
      <v-card-title>{{ variantProduct.name?.en }}</v-card-title>
      <v-card-text>
        <div v-for="opt in variantProduct.options" :key="opt.id" class="mb-3">
          <div class="text-subtitle-2 mb-1">{{ opt.name?.en }}</div>
          <v-chip-group v-model="selectedValues[opt.id]" mandatory="force">
            <v-chip v-for="val in opt.values" :key="val.id" :value="val.id" filter variant="outlined">{{ val.name?.en }}</v-chip>
          </v-chip-group>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="variantDialog = false">Cancel</v-btn>
        <v-btn color="primary" :disabled="!selectedVariant" @click="confirmVariant">Add</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Tender -->
  <v-dialog v-model="tenderDialog" max-width="380" @after-leave="focusScan">
    <v-card>
      <v-card-title>Charge {{ formatMoney(subtotal, { symbol: CURRENCY_SYMBOL }) }}</v-card-title>
      <v-card-text>
        <v-btn-toggle v-model="tenderMethod" mandatory color="primary" class="mb-4">
          <v-btn value="cash" prepend-icon="mdi-cash">Cash</v-btn>
          <v-btn value="card" prepend-icon="mdi-credit-card-outline">Card</v-btn>
        </v-btn-toggle>
        <v-text-field v-if="tenderMethod === 'cash'" v-model="cashTendered" label="Cash tendered" type="number" step="0.01" class="mb-2" />
        <div v-if="tenderMethod === 'cash'" class="d-flex justify-space-between text-h6">
          <span>Change due</span><span>{{ formatMoney(changeDue, { symbol: CURRENCY_SYMBOL }) }}</span>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="tenderDialog = false">Cancel</v-btn>
        <v-btn color="primary" :loading="completing" @click="completeSale">Complete sale</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Receipt -->
  <v-dialog v-model="receiptDialog" max-width="360" @after-leave="focusScan">
    <v-card v-if="lastReceipt">
      <v-card-text id="receipt" style="font-family: monospace; font-size: 13px">
        <div class="text-center font-weight-bold mb-2">MY SHOP</div>
        <div v-if="lastReceipt.queued" class="text-center mb-2">*** OFFLINE — WILL SYNC ***</div>
        <div>{{ lastReceipt.date.toLocaleString() }}</div>
        <div>Cashier: {{ lastReceipt.staff || '—' }}</div>
        <v-divider class="my-2" />
        <div v-for="item in lastReceipt.items" :key="item.key" class="d-flex justify-space-between">
          <span>{{ item.quantity }}x {{ item.name }}</span>
          <span>{{ formatMoney(item.price * item.quantity, { symbol: CURRENCY_SYMBOL }) }}</span>
        </div>
        <v-divider class="my-2" />
        <div class="d-flex justify-space-between font-weight-bold">
          <span>TOTAL</span><span>{{ formatMoney(lastReceipt.subtotal, { symbol: CURRENCY_SYMBOL }) }}</span>
        </div>
        <div class="d-flex justify-space-between">
          <span>{{ lastReceipt.method === 'cash' ? 'Cash' : 'Card' }}</span>
          <span>{{ formatMoney(lastReceipt.method === 'cash' ? lastReceipt.cashTendered : lastReceipt.subtotal, { symbol: CURRENCY_SYMBOL }) }}</span>
        </div>
        <div v-if="lastReceipt.method === 'cash'" class="d-flex justify-space-between">
          <span>Change</span><span>{{ formatMoney(lastReceipt.changeDue, { symbol: CURRENCY_SYMBOL }) }}</span>
        </div>
        <div class="text-center mt-3">Thank you!</div>
      </v-card-text>
      <v-card-actions class="no-print">
        <v-spacer />
        <v-btn variant="text" @click="receiptDialog = false">Close</v-btn>
        <v-btn color="primary" prepend-icon="mdi-printer" @click="printReceipt">Print</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500">{{ snackbar.text }}</v-snackbar>
</template>

<style scoped>
@media print {
  #receipt {
    font-size: 12px;
    width: 280px;
  }
}
</style>
