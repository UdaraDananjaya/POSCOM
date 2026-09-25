<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../../composables/useAuth.js';
import { COL } from '../../constants.js';

const router = useRouter();
const route = useRoute();
const { signIn } = useAuth(COL.CUSTOMERS);

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await signIn(email.value, password.value);
    router.push(route.query.redirect || '/');
  } catch (e) {
    error.value = e.message.replace('Firebase: ', '');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-container class="py-10" style="max-width: 420px">
    <h1 class="text-h5 font-weight-bold mb-4">Sign in</h1>
    <v-form @submit.prevent="submit">
      <v-text-field v-model="email" label="Email" type="email" variant="outlined" class="mb-2" required />
      <v-text-field v-model="password" label="Password" type="password" variant="outlined" class="mb-2" required />
      <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
      <v-btn type="submit" color="primary" block size="large" :loading="loading">Sign in</v-btn>
    </v-form>
    <p class="text-body-2 mt-4">
      No account yet? <router-link to="/register">Create one</router-link>
    </p>
  </v-container>
</template>
