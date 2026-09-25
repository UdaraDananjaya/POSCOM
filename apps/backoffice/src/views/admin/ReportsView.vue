<script setup>
import { computed } from 'vue';
import { useCollection, COL, formatMoney } from '@myshop/shared';
import { CURRENCY_SYMBOL } from '../../config.js';

const { data: orders, loading } = useCollection(COL.ORDERS);
const { data: statuses } = useCollection(COL.ORDER_STATUSES);

const saleOrders = computed(() => {
  const saleStatusIds = new Set(statuses.value.filter((s) => s.isSale).map((s) => s.id));
  return orders.value.filter((o) => saleStatusIds.has(o.orderStatusId));
});

const monthlySales = computed(() => {
  const map = new Map();
  for (const o of saleOrders.value) {
    const d = o.dateCreated?.toDate ? o.dateCreated.toDate() : null;
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + (o.paymentDue || 0));
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
});

const topProducts = computed(() => {
  const map = new Map();
  for (const o of saleOrders.value) {
    for (const item of o.items || []) {
      const cur = map.get(item.productId) || { name: item.name, quantity: 0, sales: 0 };
      cur.quantity += item.quantity;
      cur.sales += item.price * item.quantity;
      map.set(item.productId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 20);
});

const topCustomers = computed(() => {
  const map = new Map();
  for (const o of saleOrders.value) {
    if (!o.customerId) continue;
    const label = o.customer ? `${o.customer.firstname} ${o.customer.lastname}` : o.customerId;
    const cur = map.get(o.customerId) || { name: label, total: 0, orders: 0 };
    cur.total += o.paymentDue || 0;
    cur.orders += 1;
    map.set(o.customerId, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 20);
});

function downloadCsv(filename, rows, headers) {
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <v-container class="py-6">
    <h1 class="text-h5 font-weight-bold mb-4">Reports</h1>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-row>
      <v-col cols="12" md="6">
        <v-card class="mb-4">
          <v-card-title class="d-flex">
            Monthly sales
            <v-spacer />
            <v-btn size="small" variant="text" prepend-icon="mdi-download" @click="downloadCsv('monthly-sales.csv', monthlySales.map(([month, total]) => ({ month, total })), ['month', 'total'])">CSV</v-btn>
          </v-card-title>
          <v-list density="compact">
            <v-list-item v-for="[month, total] in monthlySales" :key="month" :title="month">
              <template #append>{{ formatMoney(total, { symbol: CURRENCY_SYMBOL }) }}</template>
            </v-list-item>
          </v-list>
        </v-card>

        <v-card>
          <v-card-title class="d-flex">
            Top customers
            <v-spacer />
            <v-btn size="small" variant="text" prepend-icon="mdi-download" @click="downloadCsv('top-customers.csv', topCustomers, ['name', 'orders', 'total'])">CSV</v-btn>
          </v-card-title>
          <v-list density="compact">
            <v-list-item v-for="c in topCustomers" :key="c.name" :title="c.name" :subtitle="`${c.orders} order(s)`">
              <template #append>{{ formatMoney(c.total, { symbol: CURRENCY_SYMBOL }) }}</template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="d-flex">
            Most sold products
            <v-spacer />
            <v-btn size="small" variant="text" prepend-icon="mdi-download" @click="downloadCsv('top-products.csv', topProducts, ['name', 'quantity', 'sales'])">CSV</v-btn>
          </v-card-title>
          <v-list density="compact">
            <v-list-item v-for="p in topProducts" :key="p.name" :title="p.name" :subtitle="`${p.quantity} sold`">
              <template #append>{{ formatMoney(p.sales, { symbol: CURRENCY_SYMBOL }) }}</template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
