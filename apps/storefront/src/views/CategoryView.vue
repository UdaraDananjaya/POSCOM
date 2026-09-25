<script setup>
import { doc, getDoc } from 'firebase/firestore';
import { ref, onMounted, watch } from 'vue';
import { db, useProducts, COL } from '@myshop/shared';
import ProductCard from '../components/ProductCard.vue';

const props = defineProps({ id: { type: String, required: true } });

const category = ref(null);
const { data: products, loading } = useProducts({ categoryId: props.id });

async function loadCategory() {
  const snap = await getDoc(doc(db, COL.CATEGORIES, props.id));
  category.value = snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

onMounted(loadCategory);
watch(() => props.id, loadCategory);
</script>

<template>
  <v-container class="py-6">
    <h1 class="text-h5 font-weight-bold mb-1">{{ category?.name?.en || 'Category' }}</h1>
    <p v-if="category?.description?.en" class="text-body-2 text-medium-emphasis mb-4">
      {{ category.description.en }}
    </p>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-row v-if="!loading && products.length">
      <v-col v-for="p in products" :key="p.id" cols="12" sm="6" md="4" lg="3">
        <ProductCard :product="p" />
      </v-col>
    </v-row>
    <v-empty-state v-else-if="!loading" icon="mdi-package-variant" title="No products in this category yet" />
  </v-container>
</template>
