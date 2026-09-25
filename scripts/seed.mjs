// Seeds order statuses (the reserve/commit stock-action machine), a
// super-admin staff login, and a small sample catalog directly into your
// real Firebase project (project id comes from .firebaserc).
//
// This writes real data (including a super-admin login with a known default
// password) to a live project — it will NOT run unless you pass CONFIRM_SEED=yes,
// so it's never triggered by accident.
//
// Requires Application Default Credentials for the project — run
// `gcloud auth application-default login` once, or set
// GOOGLE_APPLICATION_CREDENTIALS to a service account key JSON.
//
// Usage: CONFIRM_SEED=yes node scripts/seed.mjs

import { readFileSync } from 'fs';
import admin from 'firebase-admin';

if (process.env.CONFIRM_SEED !== 'yes') {
  console.error(
    'Refusing to run: this writes real data to your live Firebase project.\n' +
    'Re-run as: CONFIRM_SEED=yes node scripts/seed.mjs'
  );
  process.exit(1);
}

const { projects } = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url)));
const projectId = process.env.GCLOUD_PROJECT || projects.default;

admin.initializeApp({ projectId });
const db = admin.firestore();
const auth = admin.auth();

async function upsert(collection, id, data) {
  await db.collection(collection).doc(id).set(data, { merge: true });
}

async function ensureAuthUser(email, password, displayName) {
  try {
    return await auth.getUserByEmail(email);
  } catch {
    return auth.createUser({ email, password, displayName });
  }
}

async function seedOrderStatuses() {
  const statuses = [
    // pending/processing use stockAction 'none': the customer's own order-create
    // write never touches product stock (see firestore.rules) — stock only moves
    // once staff commit the order to 'paid' or a later status.
    { id: 'pending', name: 'Pending', color: 'blue', stockAction: 'none', notify: false, isSale: false, priority: 1 },
    { id: 'processing', name: 'Processing', color: 'orange', stockAction: 'none', notify: true, isSale: false, priority: 2 },
    { id: 'paid', name: 'Paid', color: 'green', stockAction: 'commit', notify: true, isSale: true, priority: 3 },
    { id: 'dispatched', name: 'Dispatched', color: 'purple', stockAction: 'commit', notify: true, isSale: true, priority: 4 },
    { id: 'delivered', name: 'Delivered', color: 'teal', stockAction: 'commit', notify: true, isSale: true, priority: 5 },
    { id: 'cancelled', name: 'Cancelled', color: 'grey', stockAction: 'none', notify: true, isSale: false, priority: 6 },
    { id: 'refunded', name: 'Refunded', color: 'red', stockAction: 'none', notify: true, isSale: false, priority: 7 },
  ];
  for (const s of statuses) {
    const { id, name, ...rest } = s;
    await upsert('orderStatuses', id, { name: { en: name }, ...rest });
  }
  console.log(`Seeded ${statuses.length} order statuses.`);
}

async function seedCatalog() {
  const categories = [
    { id: 'beverages', name: 'Beverages', priority: 1 },
    { id: 'snacks', name: 'Snacks', priority: 2 },
    { id: 'household', name: 'Household', priority: 3 },
  ];
  for (const c of categories) {
    const { id, name, ...rest } = c;
    await upsert('categories', id, { name: { en: name }, parentId: null, status: true, ...rest });
  }

  const products = [
    { id: 'sku-cola-500', sku: 'COLA500', name: 'Cola 500ml', price: 1.5, quantity: 120, category: 'beverages' },
    { id: 'sku-water-1l', sku: 'WATER1L', name: 'Spring Water 1L', price: 1.0, quantity: 200, category: 'beverages' },
    { id: 'sku-chips-classic', sku: 'CHIPSCL', name: 'Classic Potato Chips', price: 2.25, quantity: 80, category: 'snacks' },
    { id: 'sku-choc-bar', sku: 'CHOCBAR', name: 'Chocolate Bar', price: 1.75, quantity: 150, category: 'snacks' },
    { id: 'sku-dish-soap', sku: 'DISHSOAP', name: 'Dish Soap 750ml', price: 3.5, quantity: 60, category: 'household' },
    { id: 'sku-paper-towel', sku: 'PAPTOWEL', name: 'Paper Towels (2pk)', price: 4.0, quantity: 45, category: 'household' },
  ];
  for (const p of products) {
    await upsert('products', p.id, {
      name: { en: p.name },
      sku: p.sku,
      description: { en: '' },
      prices: { USD: p.price },
      categories: [p.category],
      images: [],
      quantity: p.quantity,
      reserved: 0,
      status: true,
    });
  }
  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

async function seedStaff() {
  const email = 'admin@myshop.local';
  const password = 'password123';
  const user = await ensureAuthUser(email, password, 'Admin');
  await upsert('staffUsers', user.uid, {
    username: 'admin',
    email,
    status: true,
    isSuperAdmin: true,
    permissions: {},
  });
  console.log(`Super-admin ready: ${email} / ${password}`);
}

await seedOrderStatuses();
await seedCatalog();
await seedStaff();
console.log('Seed complete.');
process.exit(0);
