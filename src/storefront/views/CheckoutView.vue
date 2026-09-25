<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth.js';
import { useCart } from '../../composables/useCart.js';
import { placeEcomOrder } from '../../services/orders.js';
import { formatMoney } from '../../utils/money.js';
import { COL } from '../../constants.js';
import { DEFAULT_CURRENCY, CURRENCY_SYMBOL } from '../../config.js';

const router = useRouter();
const { currentUser, profile, authReady, loadProfile } = useAuth(COL.CUSTOMERS);
const { items, subtotal, clear } = useCart('myshop_ecom_cart');

const address = ref({
  firstname: '', lastname: '', address1: '', address2: '', postcode: '',
  city: '', countryCode: '', zoneCode: '', phone: '',
});
const shippingMethod = ref('store_pickup');
const submitting = ref(false);
const error = ref('');

const shippingOptions = [
  { id: 'store_pickup', title: 'Store pickup', cost: 0 },
  { id: 'flat_rate', title: 'Flat-rate delivery', cost: 5 },
];

onMounted(async () => {
  await loadProfile();
});

watch(profile, (p) => {
  if (!p) return;
  address.value = {
    firstname: p.firstname || '', lastname: p.lastname || '',
    address1: p.address1 || '', address2: p.address2 || '',
    postcode: p.postcode || '', city: p.city || '',
    countryCode: p.countryCode || '', zoneCode: p.zoneCode || '', phone: p.phone || '',
  };
}, { immediate: true });

const selectedShipping = computed(() => shippingOptions.find((s) => s.id === shippingMethod.value));
const total = computed(() => subtotal.value + (selectedShipping.value?.cost || 0));

async function submit() {
  if (!items.length) return;
  error.value = '';
  submitting.value = true;
  try {
    const { orderId } = await placeEcomOrder({
      items: items.map((i) => ({
        productId: i.productId,
        variantKey: i.variantKey,
        name: i.name,
        sku: i.sku,
        price: i.price,
        quantity: i.quantity,
        taxClassId: i.taxClassId || null,
      })),
      customer: { ...address.value, email: currentUser.value?.email },
      customerId: currentUser.value.uid,
      shippingOption: { id: selectedShipping.value.id, title: selectedShipping.value.title, cost: selectedShipping.value.cost, taxClassId: null },
      paymentOption: { id: 'cod', title: 'Cash on delivery', cost: 0, taxClassId: null },
      currencyCode: DEFAULT_CURRENCY,
    });
    clear();
    router.push(`/order-success/${orderId}`);
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <v-container class="py-6" style="max-width: 720px">
    <h1 class="text-h5 font-weight-bold mb-4">Checkout</h1>

    <template v-if="authReady && !currentUser">
      <v-alert type="info" variant="tonal" class="mb-4">Please sign in to place an order.</v-alert>
      <v-btn color="primary" :to="{ path: '/login', query: { redirect: '/checkout' } }">Sign in</v-btn>
    </template>

    <v-form v-else @submit.prevent="submit">
      <v-card class="mb-4">
        <v-card-title>Delivery address</v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="6"><v-text-field v-model="address.firstname" label="First name" variant="outlined" required /></v-col>
            <v-col cols="6"><v-text-field v-model="address.lastname" label="Last name" variant="outlined" required /></v-col>
            <v-col cols="12"><v-text-field v-model="address.address1" label="Address" variant="outlined" required /></v-col>
            <v-col cols="12"><v-text-field v-model="address.address2" label="Address line 2" variant="outlined" /></v-col>
            <v-col cols="6"><v-text-field v-model="address.city" label="City" variant="outlined" required /></v-col>
            <v-col cols="6"><v-text-field v-model="address.postcode" label="Postcode" variant="outlined" /></v-col>
            <v-col cols="6"><v-text-field v-model="address.countryCode" label="Country code (e.g. US)" variant="outlined" required /></v-col>
            <v-col cols="6"><v-text-field v-model="address.phone" label="Phone" variant="outlined" /></v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card class="mb-4">
        <v-card-title>Delivery method</v-card-title>
        <v-card-text>
          <v-radio-group v-model="shippingMethod" hide-details>
            <v-radio v-for="opt in shippingOptions" :key="opt.id" :value="opt.id">
              <template #label>
                <div class="d-flex justify-space-between" style="width: 100%">
                  <span>{{ opt.title }}</span>
                  <span>{{ opt.cost ? formatMoney(opt.cost, { symbol: CURRENCY_SYMBOL }) : 'Free' }}</span>
                </div>
              </template>
            </v-radio>
          </v-radio-group>
        </v-card-text>
      </v-card>

      <v-card class="mb-4">
        <v-card-title>Payment</v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact">Cash on delivery — pay when your order arrives.</v-alert>
        </v-card-text>
      </v-card>

      <v-card class="mb-4">
        <v-card-text>
          <div class="d-flex justify-space-between mb-1">
            <span>Subtotal</span><span>{{ formatMoney(subtotal, { symbol: CURRENCY_SYMBOL }) }}</span>
          </div>
          <div class="d-flex justify-space-between mb-1">
            <span>Shipping</span><span>{{ formatMoney(selectedShipping?.cost || 0, { symbol: CURRENCY_SYMBOL }) }}</span>
          </div>
          <v-divider class="my-2" />
          <div class="d-flex justify-space-between text-h6 font-weight-bold">
            <span>Total</span><span>{{ formatMoney(total, { symbol: CURRENCY_SYMBOL }) }}</span>
          </div>
        </v-card-text>
      </v-card>

      <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
      <v-btn type="submit" color="primary" size="large" block :loading="submitting" :disabled="!items.length">
        Place order
      </v-btn>
    </v-form>
  </v-container>
</template>
