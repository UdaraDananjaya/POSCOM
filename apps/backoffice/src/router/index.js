import { createRouter, createWebHistory } from 'vue-router';
import { useAuth, COL } from '@myshop/shared';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/', redirect: '/pos' },
  { path: '/pos', name: 'pos', component: () => import('../views/pos/PosSaleView.vue') },
  { path: '/admin', redirect: '/admin/dashboard' },
  { path: '/admin/dashboard', name: 'dashboard', component: () => import('../views/admin/DashboardView.vue') },
  { path: '/admin/catalog/products', name: 'products', component: () => import('../views/admin/catalog/ProductsListView.vue') },
  { path: '/admin/catalog/products/new', name: 'product-new', component: () => import('../views/admin/catalog/ProductEditView.vue') },
  { path: '/admin/catalog/products/:id', name: 'product-edit', component: () => import('../views/admin/catalog/ProductEditView.vue'), props: true },
  { path: '/admin/catalog/categories', name: 'categories', component: () => import('../views/admin/catalog/CategoriesView.vue') },
  { path: '/admin/orders', name: 'orders', component: () => import('../views/admin/orders/OrdersListView.vue') },
  { path: '/admin/orders/:id', name: 'order-detail', component: () => import('../views/admin/orders/OrderDetailView.vue'), props: true },
  { path: '/admin/customers', name: 'customers', component: () => import('../views/admin/CustomersView.vue') },
  { path: '/admin/staff', name: 'staff', component: () => import('../views/admin/StaffUsersView.vue') },
  { path: '/admin/pages', name: 'pages', component: () => import('../views/admin/PagesView.vue') },
  { path: '/admin/slides', name: 'slides', component: () => import('../views/admin/SlidesView.vue') },
  { path: '/admin/settings', name: 'settings', component: () => import('../views/admin/SettingsView.vue') },
  { path: '/admin/catalog/manufacturers', name: 'manufacturers', component: () => import('../views/admin/catalog/ManufacturersView.vue') },
  { path: '/admin/tax', name: 'tax', component: () => import('../views/admin/TaxView.vue') },
  { path: '/admin/reports', name: 'reports', component: () => import('../views/admin/ReportsView.vue') },
];

const router = createRouter({ history: createWebHistory(), routes });

const { currentUser, authReady, profile, loadProfile } = useAuth(COL.STAFF_USERS);

function waitForAuthReady() {
  if (authReady.value) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = setInterval(() => {
      if (authReady.value) {
        clearInterval(stop);
        resolve();
      }
    }, 25);
  });
}

router.beforeEach(async (to) => {
  await waitForAuthReady();
  if (to.meta.public) return true;
  if (!currentUser.value) return { name: 'login', query: { redirect: to.fullPath } };
  if (!profile.value) await loadProfile();
  return true;
});

export default router;
