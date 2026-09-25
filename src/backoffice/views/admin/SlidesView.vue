<script setup>
import { ref } from 'vue';
import { doc, setDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebase.js';
import { useCollection } from '../../../composables/useCollection.js';
import { COL } from '../../../constants.js';

const { data: slides, loading } = useCollection(COL.SLIDES);

const dialog = ref(false);
const editing = ref(null);
const uploading = ref(false);
const form = ref({ name: '', caption: '', link: '', image: '', priority: 0, status: true });

function openNew() {
  editing.value = null;
  form.value = { name: '', caption: '', link: '', image: '', priority: 0, status: true };
  dialog.value = true;
}
function openEdit(s) {
  editing.value = s;
  form.value = { name: s.name || '', caption: s.caption?.en || '', link: s.link?.en || '', image: s.image || '', priority: s.priority || 0, status: s.status !== false };
  dialog.value = true;
}
async function handleUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const path = `slides/${Date.now()}_${file.name}`;
    const sref = storageRef(storage, path);
    await uploadBytes(sref, file);
    form.value.image = await getDownloadURL(sref);
  } finally {
    uploading.value = false;
  }
}
async function save() {
  const ref = editing.value ? doc(db, COL.SLIDES, editing.value.id) : doc(collection(db, COL.SLIDES));
  await setDoc(ref, {
    name: form.value.name,
    caption: { en: form.value.caption },
    link: { en: form.value.link },
    image: form.value.image,
    priority: Number(form.value.priority) || 0,
    status: form.value.status,
    dateUpdated: serverTimestamp(),
    ...(editing.value ? {} : { dateCreated: serverTimestamp() }),
  }, { merge: true });
  dialog.value = false;
}
async function remove(s) {
  if (!confirm(`Delete slide "${s.name}"?`)) return;
  await deleteDoc(doc(db, COL.SLIDES, s.id));
}
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Homepage slides</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">New slide</v-btn>
    </div>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-row>
      <v-col v-for="s in slides" :key="s.id" cols="12" sm="6" md="4">
        <v-card>
          <v-img :src="s.image" height="120" cover class="bg-grey-lighten-3" />
          <v-card-text>
            <div class="font-weight-medium">{{ s.name }}</div>
            <div class="text-caption text-medium-emphasis">{{ s.status ? 'Active' : 'Disabled' }}</div>
          </v-card-text>
          <v-card-actions>
            <v-btn size="small" variant="text" @click="openEdit(s)">Edit</v-btn>
            <v-btn size="small" variant="text" @click="remove(s)">Delete</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="dialog" max-width="480">
      <v-card>
        <v-card-title>{{ editing ? 'Edit slide' : 'New slide' }}</v-card-title>
        <v-card-text>
          <v-img v-if="form.image" :src="form.image" height="120" cover class="rounded-lg mb-2" />
          <v-file-input label="Slide image" prepend-icon="mdi-image" :loading="uploading" class="mb-2" @change="handleUpload" />
          <v-text-field v-model="form.name" label="Internal name" class="mb-2" />
          <v-text-field v-model="form.caption" label="Caption" class="mb-2" />
          <v-text-field v-model="form.link" label="Link URL" class="mb-2" />
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
