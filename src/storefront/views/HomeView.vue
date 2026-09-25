<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { where, orderBy } from 'firebase/firestore';
import { useProducts } from '../../composables/useProducts.js';
import { useCollection } from '../../composables/useCollection.js';
import { COL } from '../../constants.js';
import ProductCard from '../components/ProductCard.vue';

const route = useRoute();
const { data: products, loading } = useProducts();
const { data: slides } = useCollection(COL.SLIDES, () => [where('status', '==', true), orderBy('priority')]);

const filtered = computed(() => {
  const q = (route.query.q || '').toLowerCase().trim();
  if (!q) return products.value;
  return products.value.filter((p) => (p.name?.en || '').toLowerCase().includes(q));
});
</script>

<template>
  <v-carousel v-if="!route.query.q && slides.length" height="320" cycle hide-delimiter-background show-arrows="hover">
    <v-carousel-item v-for="s in slides" :key="s.id" :src="s.image" cover>
      <div class="fill-height d-flex align-end pa-6" style="background: linear-gradient(transparent 40%, rgba(0,0,0,0.5))">
        <a v-if="s.link?.en" :href="s.link.en" class="text-white text-h6 text-decoration-none" v-html="s.caption?.en" />
        <span v-else class="text-white text-h6" v-html="s.caption?.en" />
      </div>
    </v-carousel-item>
  </v-carousel>

  <v-container class="py-6">
    <h1 class="text-h5 font-weight-bold mb-4">
      {{ route.query.q ? `Results for "${route.query.q}"` : 'All Products' }}
    </h1>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-row v-if="!loading && filtered.length">
      <v-col v-for="p in filtered" :key="p.id" cols="12" sm="6" md="4" lg="3">
        <ProductCard :product="p" />
      </v-col>
    </v-row>

    <v-empty-state
      v-else-if="!loading"
      icon="mdi-package-variant"
      title="No products found"
      text="Try a different search, or check back soon."
    />
  </v-container>
</template>
