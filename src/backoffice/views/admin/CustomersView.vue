<script setup>
import { ref, computed } from 'vue';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase.js';
import { useCollection } from '../../../composables/useCollection.js';
import { COL } from '../../../constants.js';

const { data: customers, loading } = useCollection(COL.CUSTOMERS);
const search = ref('');

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return customers.value;
  return customers.value.filter(
    (c) => (c.email || '').toLowerCase().includes(q) ||
      `${c.firstname || ''} ${c.lastname || ''}`.toLowerCase().includes(q) ||
      (c.address1 || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
  );
});

function formatAddress(c) {
  const parts = [c.address1, c.address2, c.city, c.postcode, c.countryCode].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

async function toggleStatus(c) {
  await setDoc(doc(db, COL.CUSTOMERS, c.id), { status: !(c.status !== false) }, { merge: true });
}

// --- Detail / edit-address dialog ---
const detailDialog = ref(false);
const detailForm = ref(null);
const savingDetail = ref(false);

function openDetail(c) {
  detailForm.value = {
    id: c.id,
    firstname: c.firstname || '', lastname: c.lastname || '', email: c.email || '', phone: c.phone || '',
    address1: c.address1 || '', address2: c.address2 || '', city: c.city || '',
    postcode: c.postcode || '', countryCode: c.countryCode || '', zoneCode: c.zoneCode || '',
  };
  detailDialog.value = true;
}

async function saveDetail() {
  savingDetail.value = true;
  try {
    const { id, ...data } = detailForm.value;
    await setDoc(doc(db, COL.CUSTOMERS, id), data, { merge: true });
    detailDialog.value = false;
  } finally {
    savingDetail.value = false;
  }
}
</script>

<template>
  <v-container class="py-6" fluid>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Customers</h1>
      <v-spacer />
      <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" placeholder="Search name, email, address…" hide-details style="max-width: 320px" />
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-table>
      <thead>
        <tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Newsletter</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="c in filtered" :key="c.id" style="cursor: pointer" @click="openDetail(c)">
          <td>{{ c.firstname }} {{ c.lastname }}</td>
          <td>{{ c.email }}</td>
          <td>{{ c.phone || '—' }}</td>
          <td>{{ formatAddress(c) }}</td>
          <td>{{ c.newsletter ? 'Yes' : 'No' }}</td>
          <td @click.stop>
            <v-switch :model-value="c.status !== false" color="primary" density="compact" hide-details @update:model-value="toggleStatus(c)" />
          </td>
          <td @click.stop>
            <v-btn icon="mdi-eye-outline" variant="text" size="small" @click="openDetail(c)" />
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-empty-state v-if="!loading && !filtered.length" icon="mdi-account-outline" title="No customers yet" />

    <v-dialog v-model="detailDialog" max-width="480">
      <v-card v-if="detailForm">
        <v-card-title>{{ detailForm.firstname }} {{ detailForm.lastname }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="detailForm.email" label="Email" class="mb-2" readonly />
          <v-text-field v-model="detailForm.phone" label="Phone" class="mb-2" />
          <v-text-field v-model="detailForm.address1" label="Address line 1" class="mb-2" />
          <v-text-field v-model="detailForm.address2" label="Address line 2" class="mb-2" />
          <v-row dense>
            <v-col cols="6"><v-text-field v-model="detailForm.city" label="City" /></v-col>
            <v-col cols="6"><v-text-field v-model="detailForm.postcode" label="Postcode" /></v-col>
          </v-row>
          <v-row dense>
            <v-col cols="6"><v-text-field v-model="detailForm.countryCode" label="Country code" /></v-col>
            <v-col cols="6"><v-text-field v-model="detailForm.zoneCode" label="State / zone" /></v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailDialog = false">Close</v-btn>
          <v-btn color="primary" :loading="savingDetail" @click="saveDetail">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
