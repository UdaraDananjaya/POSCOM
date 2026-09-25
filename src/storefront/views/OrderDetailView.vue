<script setup>
import { ref, onMounted, watch } from 'vue';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { formatMoney } from '../../utils/money.js';
import { COL } from '../../constants.js';
import { CURRENCY_SYMBOL } from '../../config.js';

const props = defineProps({ id: { type: String, required: true } });
const order = ref(null);
const notFound = ref(false);

async function load() {
  notFound.value = false;
  order.value = null;
  const snap = await getDoc(doc(db, COL.ORDERS, props.id));
  if (snap.exists()) order.value = { id: snap.id, ...snap.data() };
  else notFound.value = true;
}
onMounted(load);
watch(() => props.id, load);
</script>

<template>
  <v-container class="py-6" style="max-width: 720px">
    <v-alert v-if="notFound" type="error">Order not found, or you don't have access to it.</v-alert>
    <template v-else-if="order">
      <h1 class="text-h5 font-weight-bold mb-1">Order #{{ order.id.slice(0, 8).toUpperCase() }}</h1>
      <v-chip class="mb-4" color="primary" variant="tonal">{{ order.orderStatusId }}</v-chip>

      <v-card class="mb-4">
        <v-list>
          <v-list-item v-for="item in order.items" :key="item.productId + (item.variantKey || '')" :title="item.name" :subtitle="`Qty ${item.quantity} × ${formatMoney(item.price, { symbol: CURRENCY_SYMBOL })}`">
            <template #append>{{ formatMoney(item.price * item.quantity, { symbol: CURRENCY_SYMBOL }) }}</template>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card>
        <v-card-text>
          <div class="d-flex justify-space-between mb-1" v-for="row in order.orderTotal" :key="row.id">
            <span>{{ row.title }}</span><span>{{ formatMoney(row.value + row.tax, { symbol: CURRENCY_SYMBOL }) }}</span>
          </div>
          <v-divider class="my-2" />
          <div class="d-flex justify-space-between text-h6 font-weight-bold">
            <span>Total</span><span>{{ formatMoney(order.paymentDue, { symbol: CURRENCY_SYMBOL }) }}</span>
          </div>
        </v-card-text>
      </v-card>
    </template>
  </v-container>
</template>
