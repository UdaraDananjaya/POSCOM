<script setup>
import { computed } from 'vue';
import { where } from 'firebase/firestore';
import { useCollection } from '../../../composables/useCollection.js';
import { getQuantityAvailable } from '../../../composables/useProducts.js';
import { COL } from '../../../constants.js';

const { data: products, loading } = useCollection(COL.PRODUCTS, () => [where('status', '==', true)]);
const lowStock = computed(() => products.value.filter((p) => getQuantityAvailable(p) <= (p.quantityMin ?? 5)).slice(0, 20));
</script>

<template>
  <v-container class="py-6">
    <h1 class="text-h5 font-weight-bold mb-4">Dashboard</h1>

    <v-row class="mb-4">
      <v-col cols="12" sm="4">
        <v-card><v-card-text>
          <div class="text-caption text-medium-emphasis">Products</div>
          <div class="text-h4 font-weight-bold">{{ products.length }}</div>
        </v-card-text></v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card><v-card-text>
          <div class="text-caption text-medium-emphasis">Low / out of stock</div>
          <div class="text-h4 font-weight-bold">{{ lowStock.length }}</div>
        </v-card-text></v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card class="d-flex flex-column justify-center" style="min-height: 88px">
          <v-card-actions>
            <v-btn color="primary" to="/staff/pos" prepend-icon="mdi-point-of-sale">Open POS</v-btn>
            <v-btn to="/staff/admin/catalog/products/new" prepend-icon="mdi-plus">New product</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-card>
      <v-card-title>Low stock</v-card-title>
      <v-progress-linear v-if="loading" indeterminate color="primary" />
      <v-list>
        <v-list-item
          v-for="p in lowStock"
          :key="p.id"
          :title="p.name?.en"
          :subtitle="`Available: ${getQuantityAvailable(p)}`"
          :to="`/staff/admin/catalog/products/${p.id}`"
        />
        <v-list-item v-if="!loading && !lowStock.length" title="Nothing low on stock 🎉" />
      </v-list>
    </v-card>
  </v-container>
</template>
