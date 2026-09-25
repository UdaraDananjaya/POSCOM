<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../../firebase.js';
import { useCategories, getQuantityAvailable } from '../../../../composables/useProducts.js';
import { useCollection } from '../../../../composables/useCollection.js';
import { adjustStock } from '../../../../services/stock.js';
import { COL } from '../../../../constants.js';
import { DEFAULT_CURRENCY } from '../../../../config.js';

const props = defineProps({ id: { type: String, default: null } });
const router = useRouter();
const { data: categories } = useCategories({ activeOnly: false });
const { data: manufacturers } = useCollection(COL.MANUFACTURERS);
const { data: taxClasses } = useCollection(COL.TAX_CLASSES);

const isNew = computed(() => !props.id);
const saving = ref(false);
const uploading = ref(false);
const product = ref(null);

const form = ref({
  name: '', sku: '', description: '', price: 0, quantity: 0,
  categories: [], status: true, images: [], manufacturerId: null, taxClassId: null,
});

const adjustDialog = ref(false);
const adjustAmount = ref(0);
const adjustNote = ref('');

const categoryDialog = ref(false);
const newCategoryName = ref('');
const creatingCategory = ref(false);

async function createCategory() {
  if (!newCategoryName.value.trim()) return;
  creatingCategory.value = true;
  try {
    const ref = await addDoc(collection(db, COL.CATEGORIES), {
      name: { en: newCategoryName.value.trim() },
      parentId: null,
      priority: 0,
      status: true,
      dateCreated: serverTimestamp(),
    });
    form.value.categories.push(ref.id);
    newCategoryName.value = '';
    categoryDialog.value = false;
  } finally {
    creatingCategory.value = false;
  }
}

async function load() {
  if (isNew.value) return;
  const snap = await getDoc(doc(db, COL.PRODUCTS, props.id));
  if (!snap.exists()) return;
  product.value = { id: snap.id, ...snap.data() };
  form.value = {
    name: product.value.name?.en || '',
    sku: product.value.sku || '',
    description: product.value.description?.en || '',
    price: product.value.prices?.[DEFAULT_CURRENCY] || 0,
    quantity: product.value.quantity || 0,
    categories: product.value.categories || [],
    status: product.value.status !== false,
    images: product.value.images || [],
    manufacturerId: product.value.manufacturerId || null,
    taxClassId: product.value.taxClassId || null,
  };
}
onMounted(load);

async function handleUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const path = `products/${props.id || 'new'}/${Date.now()}_${file.name}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);
    form.value.images.push({ url, priority: form.value.images.length });
  } finally {
    uploading.value = false;
  }
}
function removeImage(i) {
  form.value.images.splice(i, 1);
}

async function save() {
  saving.value = true;
  try {
    const ref = isNew.value ? doc(collection(db, COL.PRODUCTS)) : doc(db, COL.PRODUCTS, props.id);
    const payload = {
      name: { en: form.value.name },
      sku: form.value.sku,
      description: { en: form.value.description },
      prices: { [DEFAULT_CURRENCY]: Number(form.value.price) || 0 },
      categories: form.value.categories,
      status: form.value.status,
      images: form.value.images,
      manufacturerId: form.value.manufacturerId || null,
      taxClassId: form.value.taxClassId || null,
      dateUpdated: serverTimestamp(),
    };
    if (isNew.value) {
      payload.quantity = Number(form.value.quantity) || 0;
      payload.reserved = 0;
      payload.dateCreated = serverTimestamp();
    }
    await setDoc(ref, payload, { merge: true });
    router.push('/staff/admin/catalog/products');
  } finally {
    saving.value = false;
  }
}

async function submitAdjustment() {
  if (!adjustAmount.value) return;
  await adjustStock({ productId: props.id, delta: Number(adjustAmount.value), note: adjustNote.value });
  adjustDialog.value = false;
  adjustAmount.value = 0;
  adjustNote.value = '';
  await load();
}
</script>

<template>
  <v-container class="py-6" style="max-width: 720px">
    <h1 class="text-h5 font-weight-bold mb-4">{{ isNew ? 'New product' : 'Edit product' }}</h1>

    <v-card class="mb-4">
      <v-card-text>
        <v-text-field v-model="form.name" label="Name" class="mb-2" />
        <v-text-field v-model="form.sku" label="SKU / barcode" class="mb-2" hint="Scanned/typed in POS to find this product" persistent-hint />
        <v-textarea v-model="form.description" label="Description" class="mb-2" rows="3" />
        <div class="d-flex align-center ga-2 mb-2">
          <v-select v-model="form.categories" :items="categories" item-title="name.en" item-value="id" label="Categories" multiple chips hide-details class="flex-grow-1" />
          <v-btn icon="mdi-plus" variant="tonal" size="small" title="New category" @click="categoryDialog = true" />
        </div>
        <v-select v-model="form.manufacturerId" :items="manufacturers" item-title="name" item-value="id" label="Manufacturer" clearable class="mb-2" />
        <v-select v-model="form.taxClassId" :items="taxClasses" item-title="name" item-value="id" label="Tax class" clearable class="mb-2" />
        <v-text-field v-model="form.price" label="Price (USD)" type="number" step="0.01" class="mb-2" />

        <v-text-field
          v-if="isNew"
          v-model="form.quantity"
          label="Starting stock quantity"
          type="number"
          class="mb-2"
        />
        <template v-else>
          <v-alert type="info" variant="tonal" density="compact" class="mb-2">
            On hand: {{ product?.quantity ?? 0 }} · Reserved: {{ product?.reserved ?? 0 }} ·
            Available: {{ product ? getQuantityAvailable(product) : 0 }}
          </v-alert>
          <v-btn size="small" variant="tonal" prepend-icon="mdi-package-variant-plus" @click="adjustDialog = true">
            Adjust stock
          </v-btn>
        </template>

        <v-switch v-model="form.status" label="Active (visible for sale)" color="primary" class="mt-4" hide-details />
      </v-card-text>
    </v-card>

    <v-card class="mb-4">
      <v-card-title>Images</v-card-title>
      <v-card-text>
        <div class="d-flex flex-wrap ga-3 mb-3">
          <div v-for="(img, i) in form.images" :key="i" class="position-relative">
            <v-img :src="img.url" width="96" height="96" cover class="rounded-lg" />
            <v-btn icon="mdi-close" size="x-small" class="position-absolute" style="top: -8px; right: -8px" @click="removeImage(i)" />
          </div>
        </div>
        <v-file-input label="Upload image" prepend-icon="mdi-camera" :loading="uploading" @change="handleUpload" />
      </v-card-text>
    </v-card>

    <v-btn color="primary" size="large" :loading="saving" @click="save">Save product</v-btn>

    <v-dialog v-model="adjustDialog" max-width="380">
      <v-card>
        <v-card-title>Adjust stock</v-card-title>
        <v-card-text>
          <v-text-field v-model="adjustAmount" label="Change (+/-)" type="number" class="mb-2" />
          <v-text-field v-model="adjustNote" label="Reason / note" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="adjustDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="submitAdjustment">Apply</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="categoryDialog" max-width="360">
      <v-card>
        <v-card-title>New category</v-card-title>
        <v-card-text>
          <v-text-field v-model="newCategoryName" label="Category name" autofocus @keyup.enter="createCategory" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="categoryDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="creatingCategory" @click="createCategory">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
