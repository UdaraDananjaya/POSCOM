<script setup>
import { ref, watch, onMounted } from 'vue';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../composables/useAuth.js';
import { COL } from '../../constants.js';

const { currentUser, profile, loadProfile } = useAuth(COL.CUSTOMERS);

const form = ref({
  firstname: '', lastname: '', phone: '',
  address1: '', address2: '', city: '', postcode: '', countryCode: '', zoneCode: '',
});
const saving = ref(false);
const saved = ref(false);

onMounted(loadProfile);

watch(profile, (p) => {
  if (!p) return;
  form.value = {
    firstname: p.firstname || '', lastname: p.lastname || '', phone: p.phone || '',
    address1: p.address1 || '', address2: p.address2 || '', city: p.city || '',
    postcode: p.postcode || '', countryCode: p.countryCode || '', zoneCode: p.zoneCode || '',
  };
}, { immediate: true });

async function save() {
  if (!currentUser.value) return;
  saving.value = true;
  try {
    await setDoc(doc(db, COL.CUSTOMERS, currentUser.value.uid), form.value, { merge: true });
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-container class="py-6" style="max-width: 560px">
    <h1 class="text-h5 font-weight-bold mb-4">My address</h1>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Saved here so it's ready to go next time you check out — you can still change it per order.
    </p>
    <v-card>
      <v-card-text>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.firstname" label="First name" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.lastname" label="Last name" /></v-col>
        </v-row>
        <v-text-field v-model="form.phone" label="Phone" class="mb-2" />
        <v-text-field v-model="form.address1" label="Address line 1" class="mb-2" />
        <v-text-field v-model="form.address2" label="Address line 2" class="mb-2" />
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.city" label="City" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.postcode" label="Postcode" /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.countryCode" label="Country code (e.g. US)" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.zoneCode" label="State / zone" /></v-col>
        </v-row>
        <v-btn color="primary" :loading="saving" @click="save">Save address</v-btn>
        <v-fade-transition>
          <span v-if="saved" class="text-success ml-3">Saved</span>
        </v-fade-transition>
      </v-card-text>
    </v-card>
  </v-container>
</template>
