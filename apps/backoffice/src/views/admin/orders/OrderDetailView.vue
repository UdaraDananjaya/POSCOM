<script setup>
import { ref, onMounted, watch } from 'vue';
import { doc, onSnapshot, collection, orderBy, query } from 'firebase/firestore';
import { db, COL, useCollection, formatMoney, updateOrderStatus } from '@myshop/shared';
import { CURRENCY_SYMBOL } from '../../../config.js';

const props = defineProps({ id: { type: String, required: true } });
const { data: statuses } = useCollection(COL.ORDER_STATUSES);

const order = ref(null);
const comments = ref([]);
const changing = ref(false);
const error = ref('');
let unsubOrder = null;
let unsubComments = null;

function subscribe() {
  unsubOrder?.();
  unsubComments?.();
  unsubOrder = onSnapshot(doc(db, COL.ORDERS, props.id), (snap) => {
    order.value = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  });
  unsubComments = onSnapshot(
    query(collection(db, COL.ORDERS, props.id, 'comments'), orderBy('dateCreated', 'desc')),
    (snap) => { comments.value = snap.docs.map((d) => ({ id: d.id, ...d.data() })); }
  );
}
onMounted(subscribe);
watch(() => props.id, subscribe);

async function changeStatus(newStatusId) {
  error.value = '';
  changing.value = true;
  try {
    await updateOrderStatus({ orderId: props.id, newStatusId });
  } catch (e) {
    error.value = e.message;
  } finally {
    changing.value = false;
  }
}
</script>

<template>
  <v-container class="py-6" style="max-width: 800px" v-if="order">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Order #{{ order.id.slice(0, 8).toUpperCase() }}</h1>
      <v-spacer />
      <v-select
        :model-value="order.orderStatusId"
        :items="statuses"
        item-title="name.en"
        item-value="id"
        label="Status"
        density="compact"
        hide-details
        style="max-width: 220px"
        :loading="changing"
        @update:model-value="changeStatus"
      />
    </div>

    <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

    <v-row>
      <v-col cols="12" md="7">
        <v-card class="mb-4">
          <v-card-title>Items</v-card-title>
          <v-list>
            <v-list-item
              v-for="item in order.items"
              :key="item.productId + (item.variantKey || '')"
              :title="item.name"
              :subtitle="`SKU ${item.sku || '—'} · Qty ${item.quantity} × ${formatMoney(item.price, { symbol: CURRENCY_SYMBOL })}`"
            >
              <template #append>{{ formatMoney(item.price * item.quantity, { symbol: CURRENCY_SYMBOL }) }}</template>
            </v-list-item>
          </v-list>
        </v-card>

        <v-card v-if="order.customer">
          <v-card-title>Customer</v-card-title>
          <v-card-text>
            {{ order.customer.firstname }} {{ order.customer.lastname }}<br />
            {{ order.customer.address1 }} {{ order.customer.address2 }}<br />
            {{ order.customer.city }} {{ order.customer.postcode }}, {{ order.customer.countryCode }}<br />
            {{ order.customer.phone }} · {{ order.customer.email }}
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card class="mb-4">
          <v-card-text>
            <div v-if="order.orderTotal" class="mb-2">
              <div v-for="row in order.orderTotal" :key="row.id" class="d-flex justify-space-between">
                <span>{{ row.title }}</span><span>{{ formatMoney(row.value + row.tax, { symbol: CURRENCY_SYMBOL }) }}</span>
              </div>
            </div>
            <v-divider class="my-2" />
            <div class="d-flex justify-space-between text-h6 font-weight-bold">
              <span>Total</span><span>{{ formatMoney(order.paymentDue, { symbol: CURRENCY_SYMBOL }) }}</span>
            </div>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title>Activity</v-card-title>
          <v-list density="compact">
            <v-list-item v-for="c in comments" :key="c.id" :title="c.text" :subtitle="c.dateCreated?.toDate ? c.dateCreated.toDate().toLocaleString() : ''" />
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
