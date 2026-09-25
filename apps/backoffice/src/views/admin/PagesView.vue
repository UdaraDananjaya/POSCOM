<script setup>
import { ref } from 'vue';
import { doc, setDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, useCollection, COL } from '@myshop/shared';

const { data: pages, loading } = useCollection(COL.PAGES);

const dialog = ref(false);
const editing = ref(null);
const form = ref({ title: '', content: '', dock: 'menu', priority: 0, status: true });

const dockOptions = [
  { title: 'Main menu', value: 'menu' },
  { title: 'Customer service', value: 'customer_service' },
  { title: 'Information', value: 'information' },
];

function openNew() {
  editing.value = null;
  form.value = { title: '', content: '', dock: 'menu', priority: 0, status: true };
  dialog.value = true;
}
function openEdit(p) {
  editing.value = p;
  form.value = { title: p.title?.en || '', content: p.content?.en || '', dock: p.dock || 'menu', priority: p.priority || 0, status: p.status !== false };
  dialog.value = true;
}
async function save() {
  const ref = editing.value ? doc(db, COL.PAGES, editing.value.id) : doc(collection(db, COL.PAGES));
  await setDoc(ref, {
    title: { en: form.value.title },
    content: { en: form.value.content },
    dock: form.value.dock,
    priority: Number(form.value.priority) || 0,
    status: form.value.status,
    parentId: null,
    dateUpdated: serverTimestamp(),
    ...(editing.value ? {} : { dateCreated: serverTimestamp() }),
  }, { merge: true });
  dialog.value = false;
}
async function remove(p) {
  if (!confirm(`Delete page "${p.title?.en}"?`)) return;
  await deleteDoc(doc(db, COL.PAGES, p.id));
}
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Pages</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">New page</v-btn>
    </div>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-list>
      <v-list-item v-for="p in pages" :key="p.id" :title="p.title?.en" :subtitle="p.dock">
        <template #append>
          <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(p)" />
          <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="remove(p)" />
        </template>
      </v-list-item>
    </v-list>

    <v-dialog v-model="dialog" max-width="640">
      <v-card>
        <v-card-title>{{ editing ? 'Edit page' : 'New page' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.title" label="Title" class="mb-2" />
          <v-select v-model="form.dock" :items="dockOptions" label="Show in" class="mb-2" />
          <v-textarea v-model="form.content" label="Content (HTML)" rows="8" class="mb-2" />
          <v-text-field v-model="form.priority" label="Sort priority" type="number" class="mb-2" />
          <v-switch v-model="form.status" label="Published" color="primary" hide-details />
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
