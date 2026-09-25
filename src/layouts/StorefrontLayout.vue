<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { where } from 'firebase/firestore';
import { useAuth } from '../composables/useAuth.js';
import { useCategories } from '../composables/useProducts.js';
import { useCollection } from '../composables/useCollection.js';
import { useCart } from '../composables/useCart.js';
import { subscribeNewsletter } from '../services/newsletter.js';
import { COL } from '../constants.js';

const router = useRouter();
const { currentUser, profile, loadProfile, signOut } = useAuth(COL.CUSTOMERS);
const { data: categories } = useCategories();
const { itemCount } = useCart('myshop_ecom_cart');
const { data: footerPages } = useCollection(COL.PAGES, () => [where('status', '==', true)]);

const search = ref('');
const drawer = ref(false);
const newsletterEmail = ref('');
const newsletterDone = ref(false);

onMounted(loadProfile);

const topCategories = computed(() => categories.value.filter((c) => !c.parentId).slice(0, 8));

function runSearch() {
  if (!search.value.trim()) return;
  router.push({ path: '/', query: { q: search.value.trim() } });
}

async function handleSignOut() {
  await signOut();
  router.push('/');
}

async function subscribe() {
  if (!newsletterEmail.value) return;
  await subscribeNewsletter(newsletterEmail.value);
  newsletterDone.value = true;
  newsletterEmail.value = '';
}
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" flat>
      <v-app-bar-nav-icon class="d-md-none" @click="drawer = !drawer" />
      <v-toolbar-title class="font-weight-bold" style="cursor: pointer" @click="router.push('/')">
        My Shop
      </v-toolbar-title>

      <v-text-field
        v-model="search"
        density="compact"
        variant="solo"
        hide-details
        single-line
        placeholder="Search products…"
        prepend-inner-icon="mdi-magnify"
        class="mx-4 d-none d-md-flex"
        style="max-width: 420px"
        @keyup.enter="runSearch"
      />

      <v-spacer />

      <v-btn icon="mdi-cart" :to="'/cart'">
        <v-badge v-if="itemCount" :content="itemCount" color="secondary">
          <v-icon>mdi-cart</v-icon>
        </v-badge>
        <v-icon v-else>mdi-cart</v-icon>
      </v-btn>

      <v-menu v-if="currentUser">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon="mdi-account-circle" />
        </template>
        <v-list>
          <v-list-item :title="profile?.firstname || currentUser.email" subtitle="My account" />
          <v-divider />
          <v-list-item title="My address" to="/account/address" />
          <v-list-item title="Order history" to="/account/orders" />
          <v-list-item title="Sign out" @click="handleSignOut" />
        </v-list>
      </v-menu>
      <v-btn v-else to="/login" variant="text">Sign in</v-btn>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" temporary>
      <v-list>
        <v-list-item v-for="c in topCategories" :key="c.id" :title="c.name?.en" :to="`/category/${c.id}`" />
      </v-list>
    </v-navigation-drawer>

    <v-sheet color="primary-darken-1" class="d-none d-md-block">
      <v-container class="py-1">
        <div class="d-flex ga-4">
          <router-link
            v-for="c in topCategories"
            :key="c.id"
            :to="`/category/${c.id}`"
            class="text-white text-decoration-none text-body-2"
          >
            {{ c.name?.en }}
          </router-link>
        </div>
      </v-container>
    </v-sheet>

    <v-main>
      <router-view />
    </v-main>

    <v-footer color="primary-darken-1" class="text-white d-flex flex-column py-6">
      <v-container class="d-flex flex-wrap justify-space-between ga-6">
        <div class="d-flex flex-wrap ga-4">
          <router-link
            v-for="p in footerPages"
            :key="p.id"
            :to="`/page/${p.id}`"
            class="text-white text-decoration-none text-body-2"
          >
            {{ p.title?.en }}
          </router-link>
        </div>
        <div style="max-width: 320px; width: 100%">
          <div v-if="newsletterDone" class="text-body-2">Thanks for subscribing!</div>
          <v-form v-else class="d-flex ga-2" @submit.prevent="subscribe">
            <v-text-field
              v-model="newsletterEmail"
              placeholder="Email for newsletter"
              density="compact"
              variant="solo"
              hide-details
              bg-color="white"
            />
            <v-btn type="submit" color="secondary">Join</v-btn>
          </v-form>
        </div>
      </v-container>
      <span class="text-body-2 mt-4">© {{ new Date().getFullYear() }} My Shop</span>
    </v-footer>
  </v-app>
</template>
