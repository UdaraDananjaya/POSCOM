<script setup>
import { ref, computed } from 'vue';
import { doc, setDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, useCategories, COL } from '@myshop/shared';

const { data: categories, loading } = useCategories({ activeOnly: false });

const dialog = ref(false);
const editing = ref(null);
const form = ref({ name: '', parentId: null, priority: 0, status: true });

function openNew() {
  editing.value = null;
  form.value = { name: '', parentId: null, priority: 0, status: true };
  dialog.value = true;
}
function openEdit(cat) {
  editing.value = cat;
  form.value = { name: cat.name?.en || '', parentId: cat.parentId || null, priority: cat.priority || 0, status: cat.status !== false };
  dialog.value = true;
}

async function save() {
  const ref = editing.value ? doc(db, COL.CATEGORIES, editing.value.id) : doc(collection(db, COL.CATEGORIES));
  await setDoc(ref, {
    name: { en: form.value.name },
    parentId: form.value.parentId || null,
    priority: Number(form.value.priority) || 0,
    status: form.value.status,
    dateUpdated: serverTimestamp(),
    ...(editing.value ? {} : { dateCreated: serverTimestamp() }),
  }, { merge: true });
  dialog.value = false;
}

async function remove(cat) {
  if (!confirm(`Delete category "${cat.name?.en}"?`)) return;
  await deleteDoc(doc(db, COL.CATEGORIES, cat.id));
}

const parentOptions = computed(() => categories.value.filter((c) => c.id !== editing.value?.id));
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Categories</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">New category</v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-list>
      <v-list-item v-for="c in categories" :key="c.id" :title="c.name?.en" :subtitle="c.status ? 'Active' : 'Disabled'">
        <template #append>
          <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(c)" />
          <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="remove(c)" />
        </template>
      </v-list-item>
    </v-list>

    <v-dialog v-model="dialog" max-width="480">
      <v-card>
        <v-card-title>{{ editing ? 'Edit category' : 'New category' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Name" class="mb-2" />
          <v-select
            v-model="form.parentId"
            :items="parentOptions"
            item-title="name.en"
            item-value="id"
            label="Parent category"
            clearable
            class="mb-2"
          />
          <v-text-field v-model="form.priority" label="Sort priority" type="number" class="mb-2" />
          <v-switch v-model="form.status" label="Active" color="primary" hide-details />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
