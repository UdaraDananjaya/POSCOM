<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase.js';
import { useAuth } from '../../../composables/useAuth.js';
import { useProducts } from '../../../composables/useProducts.js';
import { getQuantityAvailable } from '../../../composables/useProducts.js';
import { formatMoney } from '../../../utils/money.js';
import { COL } from '../../../constants.js';
import { placePosSale } from '../../../services/orders.js';
import { enqueueSale } from '../../pos/offlineQueue.js';
import { parkedSales, parkSale, resumeSale, deleteParkedSale } from '../../pos/parkedSales.js';
import { CURRENCY_SYMBOL, DEFAULT_CURRENCY } from '../../../config.js';

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

const posCustomer = ref(null); // { name, phone, address1, address2, city, postcode }
const customerDialog = ref(false);
const customerForm = ref({ name: '', phone: '', address1: '', address2: '', city: '', postcode: '' });

function openCustomerDialog() {
  customerForm.value = posCustomer.value
    ? { ...posCustomer.value }
    : { name: '', phone: '', address1: '', address2: '', city: '', postcode: '' };
  customerDialog.value = true;
}
function saveCustomer() {
  const hasAny = Object.values(customerForm.value).some((v) => v.trim());
  posCustomer.value = hasAny ? { ...customerForm.value } : null;
  customerDialog.value = false;
}
function clearCustomer() {
  posCustomer.value = null;
}

const parkDialog = ref(false);
const parkLabel = ref('');
const parkedListDialog = ref(false);

function openParkDialog() {
  if (!cart.value.length) return;
  parkLabel.value = posCustomer.value?.name || '';
  parkDialog.value = true;
}
function confirmPark() {
  parkSale({ label: parkLabel.value, items: cart.value, customer: posCustomer.value });
  cart.value = [];
  posCustomer.value = null;
  parkDialog.value = false;
  notify('Sale parked', 'success');
}
function handleResume(id) {
  if (cart.value.length && !confirm('This will replace the current sale. Continue?')) return;
  const entry = resumeSale(id);
  if (!entry) return;
  cart.value = entry.items;
  posCustomer.value = entry.customer || null;
  parkedListDialog.value = false;
  focusScan();
}
function handleDeleteParked(id) {
  if (!confirm('Delete this parked sale?')) return;
  deleteParkedSale(id);
}

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
  posCustomer.value = null;
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
    staffId: profile.value?.id,
    customer: posCustomer.value,
  };

  let receiptItems = [...cart.value];
  let queued = false;

  try {
    if (!navigator.onLine) throw new Error('offline');
    await placePosSale(payload);
  } catch (err) {
    if (!navigator.onLine || err.message === 'offline' || err.code === 'unavailable') {
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
    staff: profile.value?.username, date: new Date(), customer: posCustomer.value,
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

      <div class="d-flex justify-end mb-3">
        <v-btn variant="tonal" prepend-icon="mdi-tray-arrow-down" @click="parkedListDialog = true">
          Parked sales
          <v-badge v-if="parkedSales.length" :content="parkedSales.length" color="secondary" inline class="ml-1" />
        </v-btn>
      </div>

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
          <v-btn size="small" variant="text" @click="openParkDialog" v-if="cart.length" prepend-icon="mdi-pause-circle-outline">Park</v-btn>
          <v-btn size="small" variant="text" @click="clearCart" v-if="cart.length">Clear</v-btn>
        </div>

        <v-chip
          v-if="posCustomer"
          closable
          size="small"
          color="primary"
          variant="tonal"
          class="mb-3"
          prepend-icon="mdi-account"
          @click="openCustomerDialog"
          @click:close="clearCustomer"
        >
          {{ posCustomer.name || 'Customer info added' }}
        </v-chip>
        <v-btn v-else size="small" variant="outlined" class="mb-3" prepend-icon="mdi-account-plus-outline" @click="openCustomerDialog">
          Add customer / address
        </v-btn>

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

  <!-- Customer / address -->
  <v-dialog v-model="customerDialog" max-width="420" @after-leave="focusScan">
    <v-card>
      <v-card-title>Customer / delivery address</v-card-title>
      <v-card-text>
        <v-text-field v-model="customerForm.name" label="Name" class="mb-2" />
        <v-text-field v-model="customerForm.phone" label="Phone" class="mb-2" />
        <v-text-field v-model="customerForm.address1" label="Address line 1" class="mb-2" />
        <v-text-field v-model="customerForm.address2" label="Address line 2" class="mb-2" />
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="customerForm.city" label="City" /></v-col>
          <v-col cols="6"><v-text-field v-model="customerForm.postcode" label="Postcode" /></v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="customerDialog = false">Cancel</v-btn>
        <v-btn color="primary" @click="saveCustomer">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Park sale -->
  <v-dialog v-model="parkDialog" max-width="360" @after-leave="focusScan">
    <v-card>
      <v-card-title>Park this sale</v-card-title>
      <v-card-text>
        <v-text-field v-model="parkLabel" label="Label (e.g. customer name)" autofocus @keyup.enter="confirmPark" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="parkDialog = false">Cancel</v-btn>
        <v-btn color="primary" @click="confirmPark">Park sale</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Parked sales list -->
  <v-dialog v-model="parkedListDialog" max-width="480" @after-leave="focusScan">
    <v-card>
      <v-card-title>Parked sales</v-card-title>
      <v-list>
        <v-list-item
          v-for="p in parkedSales"
          :key="p.id"
          :title="p.label || `Parked sale (${p.items.length} item${p.items.length === 1 ? '' : 's'})`"
          :subtitle="new Date(p.parkedAt).toLocaleTimeString()"
        >
          <template #append>
            <v-btn size="small" color="primary" variant="tonal" class="mr-1" @click="handleResume(p.id)">Resume</v-btn>
            <v-btn icon="mdi-delete-outline" size="small" variant="text" @click="handleDeleteParked(p.id)" />
          </template>
        </v-list-item>
        <v-list-item v-if="!parkedSales.length" title="No parked sales" />
      </v-list>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="parkedListDialog = false">Close</v-btn>
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
        <template v-if="lastReceipt.customer">
          <div v-if="lastReceipt.customer.name">Customer: {{ lastReceipt.customer.name }}</div>
          <div v-if="lastReceipt.customer.address1">
            {{ lastReceipt.customer.address1 }}<span v-if="lastReceipt.customer.address2">, {{ lastReceipt.customer.address2 }}</span>
          </div>
          <div v-if="lastReceipt.customer.city">{{ lastReceipt.customer.city }} {{ lastReceipt.customer.postcode }}</div>
          <div v-if="lastReceipt.customer.phone">{{ lastReceipt.customer.phone }}</div>
        </template>
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
