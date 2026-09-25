<script setup>
defineProps({ id: { type: String, required: true } });
</script>

<template>
  <v-container class="py-10 text-center" style="max-width: 480px">
    <v-icon icon="mdi-check-circle" color="success" size="72" class="mb-4" />
    <h1 class="text-h5 font-weight-bold mb-2">Thank you for your order!</h1>
    <p class="text-body-2 text-medium-emphasis mb-6">We'll email you when your order is on its way.</p>
    <v-btn color="primary" :to="`/order/${id}`" class="mr-2">View order</v-btn>
    <v-btn variant="text" to="/">Continue shopping</v-btn>
  </v-container>
</template>
