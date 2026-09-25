<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth, COL } from '@myshop/shared';

const router = useRouter();
const { registerCustomer } = useAuth(COL.CUSTOMERS);

const form = ref({ firstname: '', lastname: '', email: '', password: '' });
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await registerCustomer(form.value.email, form.value.password, {
      firstname: form.value.firstname,
      lastname: form.value.lastname,
      displayName: `${form.value.firstname} ${form.value.lastname}`.trim(),
    });
    router.push('/');
  } catch (e) {
    error.value = e.message.replace('Firebase: ', '');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-container class="py-10" style="max-width: 420px">
    <h1 class="text-h5 font-weight-bold mb-4">Create account</h1>
    <v-form @submit.prevent="submit">
      <v-text-field v-model="form.firstname" label="First name" variant="outlined" class="mb-2" />
      <v-text-field v-model="form.lastname" label="Last name" variant="outlined" class="mb-2" />
      <v-text-field v-model="form.email" label="Email" type="email" variant="outlined" class="mb-2" required />
      <v-text-field v-model="form.password" label="Password" type="password" variant="outlined" class="mb-2" required />
      <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
      <v-btn type="submit" color="primary" block size="large" :loading="loading">Create account</v-btn>
    </v-form>
    <p class="text-body-2 mt-4">
      Already have an account? <router-link to="/login">Sign in</router-link>
    </p>
  </v-container>
</template>
