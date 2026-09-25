<script setup>
import { useRouter } from 'vue-router';
import { useCart } from '../../composables/useCart.js';
import { formatMoney } from '../../utils/money.js';
import { CURRENCY_SYMBOL } from '../../config.js';

const router = useRouter();
const { items, updateQuantity, removeItem, subtotal } = useCart('myshop_ecom_cart');
</script>

<template>
  <v-container class="py-6">
    <h1 class="text-h5 font-weight-bold mb-4">Your Cart</h1>

    <v-empty-state
      v-if="!items.length"
      icon="mdi-cart-outline"
      title="Your cart is empty"
      text="Browse products and add something you like."
    >
      <template #actions>
        <v-btn color="primary" to="/">Continue shopping</v-btn>
      </template>
    </v-empty-state>

    <v-row v-else>
      <v-col cols="12" md="8">
        <v-card v-for="item in items" :key="item.key" class="mb-3">
          <v-card-text class="d-flex align-center ga-4">
            <v-avatar size="72" rounded="lg">
              <v-img :src="item.image" cover />
            </v-avatar>
            <div class="flex-grow-1">
              <div class="font-weight-medium">{{ item.name }}</div>
              <div class="text-body-2 text-medium-emphasis">{{ formatMoney(item.price, { symbol: CURRENCY_SYMBOL }) }} each</div>
            </div>
            <v-text-field
              :model-value="item.quantity"
              type="number"
              min="1"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 90px"
              @update:model-value="(v) => updateQuantity(item.key, Number(v))"
            />
            <div class="font-weight-bold" style="min-width: 80px; text-align: right">
              {{ formatMoney(item.price * item.quantity, { symbol: CURRENCY_SYMBOL }) }}
            </div>
            <v-btn icon="mdi-delete-outline" variant="text" @click="removeItem(item.key)" />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between mb-2">
              <span>Subtotal</span>
              <span class="font-weight-bold">{{ formatMoney(subtotal, { symbol: CURRENCY_SYMBOL }) }}</span>
            </div>
            <p class="text-caption text-medium-emphasis mb-4">Shipping and tax calculated at checkout.</p>
            <v-btn color="primary" block size="large" @click="router.push('/checkout')">Checkout</v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
