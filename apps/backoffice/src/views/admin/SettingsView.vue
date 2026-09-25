<script setup>
import { ref, watch } from 'vue';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, COL, useStoreSettings } from '@myshop/shared';

const { settings, loading } = useStoreSettings();
const form = ref({ storeName: '', storeEmail: '', storePhone: '', storeAddress: '', defaultCurrency: 'USD', defaultLanguage: 'en' });
const saving = ref(false);
const saved = ref(false);

watch(settings, (s) => {
  if (!s) return;
  form.value = {
    storeName: s.storeName || '', storeEmail: s.storeEmail || '', storePhone: s.storePhone || '',
    storeAddress: s.storeAddress || '', defaultCurrency: s.defaultCurrency || 'USD', defaultLanguage: s.defaultLanguage || 'en',
  };
}, { immediate: true });

async function save() {
  saving.value = true;
  await setDoc(doc(db, COL.SETTINGS, 'global'), { ...form.value, dateUpdated: serverTimestamp() }, { merge: true });
  saving.value = false;
  saved.value = true;
  setTimeout(() => (saved.value = false), 2000);
}
</script>

<template>
  <v-container class="py-6" style="max-width: 560px">
    <h1 class="text-h5 font-weight-bold mb-4">Store settings</h1>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-card>
      <v-card-text>
        <v-text-field v-model="form.storeName" label="Store name" class="mb-2" />
        <v-text-field v-model="form.storeEmail" label="Store email" class="mb-2" />
        <v-text-field v-model="form.storePhone" label="Store phone" class="mb-2" />
        <v-textarea v-model="form.storeAddress" label="Store address" rows="2" class="mb-2" />
        <v-text-field v-model="form.defaultCurrency" label="Default currency code" class="mb-2" />
        <v-text-field v-model="form.defaultLanguage" label="Default language code" class="mb-2" />
        <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
        <v-fade-transition>
          <span v-if="saved" class="text-success ml-3">Saved</span>
        </v-fade-transition>
      </v-card-text>
    </v-card>
  </v-container>
</template>
