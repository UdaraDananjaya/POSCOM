<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { doc, onSnapshot, collection, addDoc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'vue-router';
import { db } from '../../firebase.js';
import { useAuth } from '../../composables/useAuth.js';
import { useCart } from '../../composables/useCart.js';
import { getQuantityAvailable } from '../../composables/useProducts.js';
import { getEffectivePrice, applyPriceOperator } from '../../services/pricing.js';
import { formatMoney } from '../../utils/money.js';
import { COL } from '../../constants.js';
import { DEFAULT_CURRENCY, CURRENCY_SYMBOL } from '../../config.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const { addItem } = useCart('myshop_ecom_cart');
const { currentUser, profile } = useAuth(COL.CUSTOMERS);

const discussions = ref([]);
const newMessage = ref('');
let unsubDiscussions = null;

async function postDiscussion() {
  if (!newMessage.value.trim() || !currentUser.value) return;
  await addDoc(collection(db, COL.PRODUCTS, props.id, 'discussions'), {
    authorId: currentUser.value.uid,
    authorName: profile.value?.firstname || currentUser.value.email,
    text: newMessage.value.trim(),
    dateCreated: serverTimestamp(),
  });
  newMessage.value = '';
}

const product = ref(null);
const variants = ref([]);
const selectedValues = ref({}); // optionId -> valueId
const quantity = ref(1);
const activeImage = ref(0);
let unsubProduct = null;
let unsubVariants = null;

function subscribe() {
  unsubProduct?.();
  unsubVariants?.();
  unsubDiscussions?.();
  product.value = null;
  activeImage.value = 0;
  selectedValues.value = {};

  unsubProduct = onSnapshot(doc(db, COL.PRODUCTS, props.id), (snap) => {
    product.value = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  });
  unsubVariants = onSnapshot(collection(db, COL.PRODUCTS, props.id, 'variants'), (snap) => {
    variants.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  unsubDiscussions = onSnapshot(
    query(collection(db, COL.PRODUCTS, props.id, 'discussions'), orderBy('dateCreated', 'desc')),
    (snap) => { discussions.value = snap.docs.map((d) => ({ id: d.id, ...d.data() })); }
  );
}

onMounted(subscribe);
watch(() => props.id, subscribe);
onUnmounted(() => {
  unsubProduct?.();
  unsubVariants?.();
  unsubDiscussions?.();
});

const priceInfo = computed(() => (product.value ? getEffectivePrice(product.value, DEFAULT_CURRENCY) : { price: 0 }));

const hasOptions = computed(() => (product.value?.options?.length || 0) > 0);

const combinationKey = computed(() => {
  if (!hasOptions.value) return null;
  const opts = product.value.options;
  if (opts.some((o) => o.required && !selectedValues.value[o.id])) return null;
  return opts
    .map((o) => `${o.id}:${selectedValues.value[o.id]}`)
    .filter((s) => !s.endsWith(':undefined'))
    .sort()
    .join(',');
});

const selectedVariant = computed(() =>
  hasOptions.value ? variants.value.find((v) => v.id === combinationKey.value) : null
);

const stockDoc = computed(() => (hasOptions.value ? selectedVariant.value : product.value));
const available = computed(() => (stockDoc.value ? getQuantityAvailable(stockDoc.value) : 0));

const finalPrice = computed(() => {
  let price = priceInfo.value.price;
  if (hasOptions.value) {
    for (const opt of product.value.options) {
      const valueId = selectedValues.value[opt.id];
      const value = opt.values?.find((v) => v.id === valueId);
      if (value?.priceOperator) price = applyPriceOperator(price, value.priceOperator, value.priceAmount || 0);
    }
  }
  return price;
});

const canAddToCart = computed(() => {
  if (!product.value) return false;
  if (hasOptions.value && !selectedVariant.value) return false;
  return available.value > 0;
});

function addToCart() {
  if (!canAddToCart.value) return;
  addItem({
    productId: product.value.id,
    variantKey: hasOptions.value ? combinationKey.value : null,
    name: product.value.name?.en,
    sku: stockDoc.value?.sku || product.value.sku,
    price: finalPrice.value,
    tax: 0,
    quantity: quantity.value,
    maxQuantity: available.value,
    image: product.value.images?.[0]?.url || null,
    taxClassId: product.value.taxClassId || null,
  });
  router.push('/cart');
}
</script>

<template>
  <v-container class="py-6" v-if="product">
    <v-row>
      <v-col cols="12" md="6">
        <v-img
          :src="product.images?.[activeImage]?.url"
          height="420"
          class="bg-grey-lighten-3 rounded-lg"
          cover
        />
        <div class="d-flex ga-2 mt-2">
          <v-avatar
            v-for="(img, i) in product.images"
            :key="i"
            size="56"
            class="cursor-pointer"
            :class="{ 'border-primary': i === activeImage }"
            @click="activeImage = i"
          >
            <v-img :src="img.url" cover />
          </v-avatar>
        </div>
      </v-col>

      <v-col cols="12" md="6">
        <h1 class="text-h5 font-weight-bold mb-2">{{ product.name?.en }}</h1>
        <div class="mb-3">
          <span class="text-h5 font-weight-bold">{{ formatMoney(finalPrice, { symbol: CURRENCY_SYMBOL }) }}</span>
          <span v-if="priceInfo.onCampaign" class="text-decoration-line-through text-medium-emphasis ml-2">
            {{ formatMoney(priceInfo.basePrice, { symbol: CURRENCY_SYMBOL }) }}
          </span>
        </div>

        <v-chip :color="available > 0 ? 'success' : 'error'" variant="tonal" class="mb-4">
          {{ available > 0 ? `${available} in stock` : 'Out of stock' }}
        </v-chip>

        <div v-if="hasOptions" class="mb-4">
          <div v-for="opt in product.options" :key="opt.id" class="mb-3">
            <div class="text-subtitle-2 mb-1">{{ opt.name?.en }}<span v-if="opt.required"> *</span></div>
            <v-chip-group v-model="selectedValues[opt.id]" mandatory="force" selected-class="text-primary">
              <v-chip
                v-for="val in opt.values"
                :key="val.id"
                :value="val.id"
                filter
                variant="outlined"
              >
                {{ val.name?.en }}
              </v-chip>
            </v-chip-group>
          </div>
        </div>

        <div class="d-flex align-center ga-4 mb-4">
          <div class="d-flex align-center border rounded-lg" style="width: 140px">
            <v-btn icon="mdi-minus" variant="text" density="comfortable" @click="quantity = Math.max(1, quantity - 1)" />
            <div class="flex-grow-1 text-center">{{ quantity }}</div>
            <v-btn icon="mdi-plus" variant="text" density="comfortable" @click="quantity = Math.min(available || 1, quantity + 1)" />
          </div>
          <v-btn color="primary" size="large" prepend-icon="mdi-cart-plus" :disabled="!canAddToCart" @click="addToCart">
            Add to cart
          </v-btn>
        </div>

        <v-divider class="mb-4" />
        <div class="text-body-2" v-html="product.description?.en" />
      </v-col>
    </v-row>

    <v-divider class="my-6" />
    <h2 class="text-h6 font-weight-bold mb-3">Questions &amp; comments</h2>
    <v-card v-if="currentUser" class="mb-4" variant="tonal">
      <v-card-text class="d-flex ga-2">
        <v-text-field v-model="newMessage" placeholder="Ask a question about this product…" hide-details density="compact" @keyup.enter="postDiscussion" />
        <v-btn color="primary" @click="postDiscussion">Post</v-btn>
      </v-card-text>
    </v-card>
    <p v-else class="text-body-2 text-medium-emphasis mb-4">
      <router-link to="/login">Sign in</router-link> to ask a question.
    </p>
    <v-list>
      <v-list-item
        v-for="d in discussions"
        :key="d.id"
        :title="d.text"
        :subtitle="`${d.authorName} · ${d.dateCreated?.toDate ? d.dateCreated.toDate().toLocaleDateString() : ''}`"
      />
      <v-list-item v-if="!discussions.length" title="No questions yet — be the first to ask." />
    </v-list>
  </v-container>
  <v-container v-else class="py-10 text-center">
    <v-progress-circular indeterminate color="primary" />
  </v-container>
</template>
