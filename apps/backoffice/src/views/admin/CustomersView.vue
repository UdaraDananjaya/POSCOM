<script setup>
import { ref, computed } from 'vue';
import { doc, setDoc } from 'firebase/firestore';
import { db, useCollection, COL } from '@myshop/shared';

const { data: customers, loading } = useCollection(COL.CUSTOMERS);
const search = ref('');

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return customers.value;
  return customers.value.filter(
    (c) => (c.email || '').toLowerCase().includes(q) ||
      `${c.firstname || ''} ${c.lastname || ''}`.toLowerCase().includes(q)
  );
});

async function toggleStatus(c) {
  await setDoc(doc(db, COL.CUSTOMERS, c.id), { status: !(c.status !== false) }, { merge: true });
}
</script>

<template>
  <v-container class="py-6" fluid>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Customers</h1>
      <v-spacer />
      <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" placeholder="Search…" hide-details style="max-width: 280px" />
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-table>
      <thead>
        <tr><th>Name</th><th>Email</th><th>Phone</th><th>Newsletter</th><th>Status</th></tr>
      </thead>
      <tbody>
        <tr v-for="c in filtered" :key="c.id">
          <td>{{ c.firstname }} {{ c.lastname }}</td>
          <td>{{ c.email }}</td>
          <td>{{ c.phone || '—' }}</td>
          <td>{{ c.newsletter ? 'Yes' : 'No' }}</td>
          <td>
            <v-switch :model-value="c.status !== false" color="primary" density="compact" hide-details @update:model-value="toggleStatus(c)" />
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-empty-state v-if="!loading && !filtered.length" icon="mdi-account-outline" title="No customers yet" />
  </v-container>
</template>
