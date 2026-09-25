import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';
import { COL } from '../constants.js';

const routes = [
  // ---- Storefront (customer-facing) ----
  {
    path: '/',
    component: () => import('../layouts/StorefrontLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('../storefront/views/HomeView.vue') },
      { path: 'category/:id', name: 'category', component: () => import('../storefront/views/CategoryView.vue'), props: true },
      { path: 'product/:id', name: 'product', component: () => import('../storefront/views/ProductView.vue'), props: true },
      { path: 'cart', name: 'cart', component: () => import('../storefront/views/CartView.vue') },
      { path: 'checkout', name: 'checkout', component: () => import('../storefront/views/CheckoutView.vue') },
      { path: 'login', name: 'login', component: () => import('../storefront/views/LoginView.vue') },
      { path: 'register', name: 'register', component: () => import('../storefront/views/RegisterView.vue') },
      { path: 'account/orders', name: 'order-history', component: () => import('../storefront/views/OrderHistoryView.vue') },
      { path: 'order/:id', name: 'order-detail', component: () => import('../storefront/views/OrderDetailView.vue'), props: true },
      { path: 'order-success/:id', name: 'order-success', component: () => import('../storefront/views/OrderSuccessView.vue'), props: true },
      { path: 'page/:id', name: 'page', component: () => import('../storefront/views/PageView.vue'), props: true },
    ],
  },

  // ---- Backoffice (staff: POS + Admin), all under /staff ----
  {
    path: '/staff',
    component: () => import('../layouts/BackofficeLayout.vue'),
    children: [
      { path: '', redirect: '/staff/pos' },
      { path: 'login', name: 'staff-login', component: () => import('../backoffice/views/StaffLoginView.vue'), meta: { public: true } },
      { path: 'pos', name: 'pos', component: () => import('../backoffice/views/pos/PosSaleView.vue') },
      { path: 'admin', redirect: '/staff/admin/dashboard' },
      { path: 'admin/dashboard', name: 'dashboard', component: () => import('../backoffice/views/admin/DashboardView.vue') },
      { path: 'admin/catalog/products', name: 'products', component: () => import('../backoffice/views/admin/catalog/ProductsListView.vue') },
      { path: 'admin/catalog/products/new', name: 'product-new', component: () => import('../backoffice/views/admin/catalog/ProductEditView.vue') },
      { path: 'admin/catalog/products/:id', name: 'product-edit', component: () => import('../backoffice/views/admin/catalog/ProductEditView.vue'), props: true },
      { path: 'admin/catalog/categories', name: 'categories', component: () => import('../backoffice/views/admin/catalog/CategoriesView.vue') },
      { path: 'admin/catalog/manufacturers', name: 'manufacturers', component: () => import('../backoffice/views/admin/catalog/ManufacturersView.vue') },
      { path: 'admin/orders', name: 'orders', component: () => import('../backoffice/views/admin/orders/OrdersListView.vue') },
      { path: 'admin/orders/:id', name: 'admin-order-detail', component: () => import('../backoffice/views/admin/orders/OrderDetailView.vue'), props: true },
      { path: 'admin/customers', name: 'customers', component: () => import('../backoffice/views/admin/CustomersView.vue') },
      { path: 'admin/staff', name: 'staff-users', component: () => import('../backoffice/views/admin/StaffUsersView.vue') },
      { path: 'admin/pages', name: 'pages', component: () => import('../backoffice/views/admin/PagesView.vue') },
      { path: 'admin/slides', name: 'slides', component: () => import('../backoffice/views/admin/SlidesView.vue') },
      { path: 'admin/settings', name: 'settings', component: () => import('../backoffice/views/admin/SettingsView.vue') },
      { path: 'admin/tax', name: 'tax', component: () => import('../backoffice/views/admin/TaxView.vue') },
      { path: 'admin/reports', name: 'reports', component: () => import('../backoffice/views/admin/ReportsView.vue') },
    ],
  },
];

const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) });

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
  if (!to.path.startsWith('/staff')) return true; // storefront routes are public
  await waitForAuthReady();
  if (to.meta.public) return true;
  if (!currentUser.value) return { name: 'staff-login', query: { redirect: to.fullPath } };
  if (!profile.value) await loadProfile();
  return true;
});

export default router;
