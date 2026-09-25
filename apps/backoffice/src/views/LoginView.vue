<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth, COL } from '@myshop/shared';

const router = useRouter();
const route = useRoute();
const { signIn } = useAuth(COL.STAFF_USERS);

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const user = await signIn(email.value, password.value);
    router.push(route.query.redirect || '/pos');
    void user;
  } catch (e) {
    error.value = e.message.replace('Firebase: ', '');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-container class="py-16 d-flex justify-center">
    <v-card style="max-width: 380px; width: 100%">
      <v-card-item>
        <v-card-title class="text-h6">My Shop — Staff sign in</v-card-title>
      </v-card-item>
      <v-card-text>
        <v-form @submit.prevent="submit">
          <v-text-field v-model="email" label="Email" type="email" class="mb-2" required />
          <v-text-field v-model="password" label="Password" type="password" class="mb-2" required />
          <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
          <v-btn type="submit" color="primary" block size="large" :loading="loading">Sign in</v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>
