<script setup>
import { where, orderBy } from 'firebase/firestore';
import { useAuth, useCollection, COL, formatMoney } from '@myshop/shared';
import { CURRENCY_SYMBOL } from '../config.js';

const { currentUser } = useAuth(COL.CUSTOMERS);
const { data: orders, loading } = useCollection(COL.ORDERS, () =>
  currentUser.value
    ? [where('customerId', '==', currentUser.value.uid), orderBy('dateCreated', 'desc')]
    : [where('customerId', '==', '__none__')]
);
</script>

<template>
  <v-container class="py-6">
    <h1 class="text-h5 font-weight-bold mb-4">Order history</h1>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-empty-state v-else-if="!orders.length" icon="mdi-receipt-text-outline" title="No orders yet" />
    <v-list v-else lines="two">
      <v-list-item
        v-for="o in orders"
        :key="o.id"
        :to="`/order/${o.id}`"
        :title="`Order #${o.id.slice(0, 8).toUpperCase()}`"
        :subtitle="`${o.orderStatusId} · ${formatMoney(o.paymentDue, { symbol: CURRENCY_SYMBOL })}`"
      />
    </v-list>
  </v-container>
</template>
