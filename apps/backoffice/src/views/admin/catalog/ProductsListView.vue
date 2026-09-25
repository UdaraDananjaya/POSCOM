<script setup>
import { ref, computed } from 'vue';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, useProducts, COL, getQuantityAvailable, getEffectivePrice, formatMoney } from '@myshop/shared';
import { CURRENCY_SYMBOL, DEFAULT_CURRENCY } from '../../../config.js';

const { data: products, loading } = useProducts({ activeOnly: false });
const search = ref('');

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return products.value;
  return products.value.filter(
    (p) => (p.name?.en || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
  );
});

async function remove(p) {
  if (!confirm(`Delete product "${p.name?.en}"? This does not remove its order history.`)) return;
  await deleteDoc(doc(db, COL.PRODUCTS, p.id));
}
</script>

<template>
  <v-container class="py-6" fluid>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Products</h1>
      <v-spacer />
      <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" placeholder="Search…" hide-details style="max-width: 280px" class="mr-4" />
      <v-btn color="primary" prepend-icon="mdi-plus" to="/admin/catalog/products/new">New product</v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-table>
      <thead>
        <tr>
          <th></th>
          <th>Name</th>
          <th>SKU</th>
          <th>Price</th>
          <th>Available</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in filtered" :key="p.id" style="cursor: pointer" @click="$router.push(`/admin/catalog/products/${p.id}`)">
          <td class="py-2">
            <v-avatar size="40" rounded="lg"><v-img :src="p.images?.[0]?.url" cover /></v-avatar>
          </td>
          <td>{{ p.name?.en }}</td>
          <td>{{ p.sku }}</td>
          <td>{{ formatMoney(getEffectivePrice(p, DEFAULT_CURRENCY).price, { symbol: CURRENCY_SYMBOL }) }}</td>
          <td>{{ getQuantityAvailable(p) }}</td>
          <td><v-chip size="small" :color="p.status ? 'success' : 'grey'" variant="tonal">{{ p.status ? 'Active' : 'Disabled' }}</v-chip></td>
          <td @click.stop>
            <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="remove(p)" />
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-empty-state v-if="!loading && !filtered.length" icon="mdi-package-variant" title="No products yet" />
  </v-container>
</template>
