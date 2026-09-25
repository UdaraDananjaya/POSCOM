<script setup>
import { ref } from 'vue';
import { doc, setDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, useCollection, COL } from '@myshop/shared';

const { data: manufacturers, loading } = useCollection(COL.MANUFACTURERS);

const dialog = ref(false);
const editing = ref(null);
const form = ref({ name: '', status: true });

function openNew() {
  editing.value = null;
  form.value = { name: '', status: true };
  dialog.value = true;
}
function openEdit(m) {
  editing.value = m;
  form.value = { name: m.name || '', status: m.status !== false };
  dialog.value = true;
}
async function save() {
  const ref = editing.value ? doc(db, COL.MANUFACTURERS, editing.value.id) : doc(collection(db, COL.MANUFACTURERS));
  await setDoc(ref, {
    name: form.value.name,
    status: form.value.status,
    dateUpdated: serverTimestamp(),
    ...(editing.value ? {} : { dateCreated: serverTimestamp() }),
  }, { merge: true });
  dialog.value = false;
}
async function remove(m) {
  if (!confirm(`Delete manufacturer "${m.name}"?`)) return;
  await deleteDoc(doc(db, COL.MANUFACTURERS, m.id));
}
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Manufacturers</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">New manufacturer</v-btn>
    </div>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-list>
      <v-list-item v-for="m in manufacturers" :key="m.id" :title="m.name" :subtitle="m.status ? 'Active' : 'Disabled'">
        <template #append>
          <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(m)" />
          <v-btn icon="mdi-delete-outline" variant="text" size="small" @click="remove(m)" />
        </template>
      </v-list-item>
    </v-list>

    <v-dialog v-model="dialog" max-width="420">
      <v-card>
        <v-card-title>{{ editing ? 'Edit manufacturer' : 'New manufacturer' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Name" class="mb-2" />
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
