import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/category/:id', name: 'category', component: () => import('../views/CategoryView.vue'), props: true },
  { path: '/product/:id', name: 'product', component: () => import('../views/ProductView.vue'), props: true },
  { path: '/cart', name: 'cart', component: () => import('../views/CartView.vue') },
  { path: '/checkout', name: 'checkout', component: () => import('../views/CheckoutView.vue') },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue') },
  { path: '/account/orders', name: 'order-history', component: () => import('../views/OrderHistoryView.vue') },
  { path: '/order/:id', name: 'order-detail', component: () => import('../views/OrderDetailView.vue'), props: true },
  { path: '/order-success/:id', name: 'order-success', component: () => import('../views/OrderSuccessView.vue'), props: true },
  { path: '/page/:id', name: 'page', component: () => import('../views/PageView.vue'), props: true },
];

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
