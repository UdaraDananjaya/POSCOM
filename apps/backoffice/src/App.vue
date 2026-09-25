<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth, hasPermission, COL } from '@myshop/shared';
import { pendingCount, syncing } from './pos/offlineQueue.js';

const route = useRoute();
const router = useRouter();
const { currentUser, profile, loadProfile, signOut } = useAuth(COL.STAFF_USERS);

onMounted(() => {
  if (currentUser.value) loadProfile();
});

const isLoginPage = computed(() => route.name === 'login');

const navItems = computed(() => {
  const p = profile.value;
  const items = [{ title: 'Point of Sale', icon: 'mdi-point-of-sale', to: '/pos', show: true }];
  items.push({ title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/admin/dashboard', show: true });
  items.push({ title: 'Products', icon: 'mdi-package-variant-closed', to: '/admin/catalog/products', show: hasPermission(p, 'catalog') });
  items.push({ title: 'Categories', icon: 'mdi-shape-outline', to: '/admin/catalog/categories', show: hasPermission(p, 'catalog') });
  items.push({ title: 'Manufacturers', icon: 'mdi-factory', to: '/admin/catalog/manufacturers', show: hasPermission(p, 'catalog') });
  items.push({ title: 'Orders', icon: 'mdi-receipt-text-outline', to: '/admin/orders', show: hasPermission(p, 'orders') });
  items.push({ title: 'Customers', icon: 'mdi-account-multiple-outline', to: '/admin/customers', show: hasPermission(p, 'customers') });
  items.push({ title: 'Reports', icon: 'mdi-chart-line', to: '/admin/reports', show: hasPermission(p, 'reports') });
  items.push({ title: 'Tax & zones', icon: 'mdi-cash-percent', to: '/admin/tax', show: hasPermission(p, 'tax') });
  items.push({ title: 'Pages', icon: 'mdi-file-document-outline', to: '/admin/pages', show: hasPermission(p, 'pages') });
  items.push({ title: 'Slides', icon: 'mdi-image-multiple-outline', to: '/admin/slides', show: hasPermission(p, 'slides') });
  items.push({ title: 'Staff', icon: 'mdi-account-group-outline', to: '/admin/staff', show: hasPermission(p, 'users') || p?.isSuperAdmin });
  items.push({ title: 'Settings', icon: 'mdi-cog-outline', to: '/admin/settings', show: hasPermission(p, 'settings') });
  return items.filter((i) => i.show);
});

async function handleSignOut() {
  await signOut();
  router.push('/login');
}
</script>

<template>
  <v-app>
    <template v-if="!isLoginPage">
      <v-navigation-drawer permanent rail expand-on-hover class="no-print">
        <v-list-item :title="profile?.username || currentUser?.email" nav />
        <v-divider />
        <v-list density="compact" nav>
          <v-list-item
            v-for="item in navItems"
            :key="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
            :to="item.to"
          />
        </v-list>
        <template #append>
          <v-list density="compact" nav>
            <v-list-item prepend-icon="mdi-logout" title="Sign out" @click="handleSignOut" />
          </v-list>
        </template>
      </v-navigation-drawer>

      <v-app-bar flat density="compact" class="no-print">
        <v-spacer />
        <v-chip v-if="pendingCount" color="warning" variant="flat" class="mr-4" prepend-icon="mdi-cloud-sync-outline">
          {{ syncing ? 'Syncing…' : `${pendingCount} sale(s) pending sync` }}
        </v-chip>
      </v-app-bar>
    </template>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
