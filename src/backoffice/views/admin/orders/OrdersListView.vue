<script setup>
import { computed, ref } from 'vue';
import { orderBy } from 'firebase/firestore';
import { useCollection } from '../../../../composables/useCollection.js';
import { formatMoney } from '../../../../utils/money.js';
import { COL } from '../../../../constants.js';
import { CURRENCY_SYMBOL } from '../../../../config.js';

const { data: orders, loading } = useCollection(COL.ORDERS, () => [orderBy('dateCreated', 'desc')]);
const { data: statuses } = useCollection(COL.ORDER_STATUSES);
const sourceFilter = ref('all');

const statusName = (id) => statuses.value.find((s) => s.id === id)?.name?.en || id;
const statusColor = (id) => statuses.value.find((s) => s.id === id)?.color || 'grey';

const filtered = computed(() =>
  sourceFilter.value === 'all' ? orders.value : orders.value.filter((o) => o.source === sourceFilter.value)
);
</script>

<template>
  <v-container class="py-6" fluid>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Orders</h1>
      <v-spacer />
      <v-btn-toggle v-model="sourceFilter" mandatory density="compact" color="primary">
        <v-btn value="all">All</v-btn>
        <v-btn value="ecom">Ecom</v-btn>
        <v-btn value="pos">POS</v-btn>
      </v-btn-toggle>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-table>
      <thead>
        <tr><th>Order</th><th>Source</th><th>Status</th><th>Total</th><th>Date</th></tr>
      </thead>
      <tbody>
        <tr v-for="o in filtered" :key="o.id" style="cursor: pointer" @click="$router.push(`/staff/admin/orders/${o.id}`)">
          <td>#{{ o.id.slice(0, 8).toUpperCase() }}</td>
          <td><v-chip size="small" variant="tonal">{{ o.source }}</v-chip></td>
          <td><v-chip size="small" :color="statusColor(o.orderStatusId)" variant="tonal">{{ statusName(o.orderStatusId) }}</v-chip></td>
          <td>{{ formatMoney(o.paymentDue, { symbol: CURRENCY_SYMBOL }) }}</td>
          <td>{{ o.dateCreated?.toDate ? o.dateCreated.toDate().toLocaleString() : '' }}</td>
        </tr>
      </tbody>
    </v-table>

    <v-empty-state v-if="!loading && !filtered.length" icon="mdi-receipt-text-outline" title="No orders yet" />
  </v-container>
</template>
