<script setup>
import { ref, onMounted, watch } from 'vue';
import { doc, getDoc } from 'firebase/firestore';
import { db, COL } from '@myshop/shared';

const props = defineProps({ id: { type: String, required: true } });
const page = ref(null);

async function load() {
  const snap = await getDoc(doc(db, COL.PAGES, props.id));
  page.value = snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
onMounted(load);
watch(() => props.id, load);
</script>

<template>
  <v-container class="py-6" style="max-width: 800px" v-if="page">
    <h1 class="text-h5 font-weight-bold mb-4">{{ page.title?.en }}</h1>
    <div class="text-body-1" v-html="page.content?.en" />
  </v-container>
  <v-container v-else class="py-10 text-center">
    <v-progress-circular indeterminate color="primary" />
  </v-container>
</template>
