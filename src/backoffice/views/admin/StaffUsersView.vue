<script setup>
import { ref } from 'vue';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase.js';
import { useCollection } from '../../../composables/useCollection.js';
import { createStaffUser } from '../../../services/staff.js';
import { COL, ADMIN_APPS } from '../../../constants.js';

const { data: staff, loading } = useCollection(COL.STAFF_USERS);

const dialog = ref(false);
const creating = ref(false);
const error = ref('');
const form = ref({ username: '', email: '', password: '', isSuperAdmin: false, permissions: {} });

function togglePermission(appCode) {
  const current = form.value.permissions[appCode]?.status;
  form.value.permissions = { ...form.value.permissions, [appCode]: { status: !current } };
}

async function submitCreate() {
  error.value = '';
  creating.value = true;
  try {
    await createStaffUser({ ...form.value });
    dialog.value = false;
    form.value = { username: '', email: '', password: '', isSuperAdmin: false, permissions: {} };
  } catch (e) {
    error.value = e.message;
  } finally {
    creating.value = false;
  }
}

async function toggleStatus(user) {
  await setDoc(doc(db, COL.STAFF_USERS, user.id), { status: !user.status }, { merge: true });
}
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Staff</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="dialog = true">New staff account</v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-list>
      <v-list-item
        v-for="u in staff"
        :key="u.id"
        :title="u.username"
        :subtitle="`${u.email}${u.isSuperAdmin ? ' · Super admin' : ''}`"
      >
        <template #append>
          <v-switch :model-value="u.status !== false" color="primary" hide-details @update:model-value="toggleStatus(u)" />
        </template>
      </v-list-item>
    </v-list>

    <v-dialog v-model="dialog" max-width="480">
      <v-card>
        <v-card-title>New staff account</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.username" label="Username" class="mb-2" />
          <v-text-field v-model="form.email" label="Email" type="email" class="mb-2" />
          <v-text-field v-model="form.password" label="Temporary password" type="password" class="mb-2" />
          <v-switch v-model="form.isSuperAdmin" label="Super admin (full access)" color="primary" class="mb-2" />
          <template v-if="!form.isSuperAdmin">
            <div class="text-subtitle-2 mb-2">Permissions</div>
            <v-chip
              v-for="app in ADMIN_APPS"
              :key="app"
              :color="form.permissions[app]?.status ? 'primary' : undefined"
              variant="tonal"
              class="mr-1 mb-1"
              @click="togglePermission(app)"
            >
              {{ app }}
            </v-chip>
          </template>
          <v-alert v-if="error" type="error" density="compact" class="mt-4">{{ error }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="creating" @click="submitCreate">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
