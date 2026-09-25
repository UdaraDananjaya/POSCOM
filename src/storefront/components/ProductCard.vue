<script setup>
import { computed } from 'vue';
import { getEffectivePrice } from '../../services/pricing.js';
import { formatMoney } from '../../utils/money.js';
import { getQuantityAvailable } from '../../composables/useProducts.js';
import { DEFAULT_CURRENCY, CURRENCY_SYMBOL } from '../../config.js';

const props = defineProps({ product: { type: Object, required: true } });

const priceInfo = computed(() => getEffectivePrice(props.product, DEFAULT_CURRENCY));
const image = computed(() => props.product.images?.[0]?.url || null);
const available = computed(() => getQuantityAvailable(props.product) > 0);
</script>

<template>
  <v-card :to="`/product/${product.id}`" class="h-100 d-flex flex-column">
    <v-img :src="image" height="180" cover class="bg-grey-lighten-3">
      <template #placeholder>
        <div class="d-flex align-center justify-center fill-height">
          <v-icon icon="mdi-image-off-outline" size="40" color="grey" />
        </div>
      </template>
    </v-img>
    <v-card-item>
      <v-card-title class="text-body-1">{{ product.name?.en }}</v-card-title>
    </v-card-item>
    <v-spacer />
    <v-card-text class="d-flex align-center justify-space-between">
      <div>
        <span class="text-h6 font-weight-bold">{{ formatMoney(priceInfo.price, { symbol: CURRENCY_SYMBOL }) }}</span>
        <span v-if="priceInfo.onCampaign" class="text-decoration-line-through text-medium-emphasis text-body-2 ml-2">
          {{ formatMoney(priceInfo.basePrice, { symbol: CURRENCY_SYMBOL }) }}
        </span>
      </div>
      <v-chip v-if="!available" size="small" color="error" variant="tonal">Out of stock</v-chip>
    </v-card-text>
  </v-card>
</template>
