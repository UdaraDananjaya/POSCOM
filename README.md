# My Shop

A single Vue 3 + Vite + Vuetify app with two sides — a public Ecom storefront and a staff POS/Admin back office — sharing one Firebase-backed stock pool (Firestore + Auth + Storage). No separate backend project: every write, including the stock reserve/commit logic, runs as a Firestore client transaction directly from the app.

Rebuilt from the LiteCart PHP cart in `../litecart`.

## Structure

```
src/
  firebase.js, constants.js, theme.js, config.js   Firebase init + shared config
  composables/        useAuth, useCart, useCollection, useProducts
  services/           pricing, tax, orderTotals, stock, orders, staff, settings, newsletter
  router/index.js      one router: storefront under /, back office under /staff
  layouts/             StorefrontLayout.vue, BackofficeLayout.vue
  storefront/views/    Home, Category, Product, Cart, Checkout, Login, Register, Orders, Page
  backoffice/views/    POS sale screen, and admin: catalog, orders, customers, staff, pages,
                        slides, settings, tax/geo-zones, reports
scripts/seed.mjs       Seeds order statuses, a sample catalog, and a super-admin login (run by you)
```

Runs against the real Firebase project `gts-pos-online` (see `.firebaserc`).

## How stock stays consistent across POS and Ecom

Every quantity change — a POS sale, a staff-driven order status change, or a manual stock adjustment — goes through one function, `applyStockTransition` in `src/services/stock.js`, called inside a Firestore transaction so the read-check-write is atomic (mirrors LiteCart's `order_statuses.stock_action`: `reserve` only moves a soft `reserved` counter, `commit` moves real `quantity`). Every change is also logged to the `stockMovements` collection.

Because there's no server here, **Firestore security rules are the enforcement boundary** (see `firestore.rules`): only staff with the `catalog` or `orders` permission can write to `products`/`stockMovements`, and order status changes (which is what actually commits/restocks) are staff-only. A customer's own Ecom checkout only ever creates their own order document at the `pending` status — `pending` is seeded with `stockAction: 'none'`, so placing an order never touches product stock; stock is only committed once staff move the order to `paid` (or restocked if later cancelled/refunded). This is a deliberate simplification from a fuller "soft-hold while pending" model, traded for not needing a Cloud Functions backend.

## First-time setup

1. Install dependencies: `npm install`
2. Install the Firebase CLI if needed: `npm install -g firebase-tools`, then `firebase login`.
3. In the [Firebase Console](https://console.firebase.google.com/project/gts-pos-online):
   - Authentication → Sign-in method → enable **Email/Password**.
   - Firestore Database → create a database (production mode).
   - Storage → create a default bucket.
4. Deploy security rules: `firebase deploy --only firestore:rules,storage:rules`
5. `.env.local` at the repo root already holds the project's Web SDK config.
6. Run the app: `npm run dev` → http://localhost:5173 (storefront at `/`, staff login at `/staff/login`).
7. Seed baseline data (order statuses are required for any order/sale to work) — this writes real data to the live project, including a super-admin login with a default password, so review `scripts/seed.mjs` first:
   ```
   gcloud auth application-default login   # once, if you haven't already
   CONFIRM_SEED=yes npm run seed
   ```
   Sign in at `/staff/login` with **admin@myshop.local / password123** — change this password immediately after first login. Skip the sample categories/products in the script (or edit them) if you'd rather enter your real catalog by hand.

## Deploying to hosting

```
npm run build
firebase deploy --only hosting,firestore:rules,storage:rules
```

## What's built vs. what's next

Implemented: catalog (products/categories/manufacturers), shared stock engine, POS sale flow (barcode input, cash/card tender, receipt print, offline queue), Ecom storefront (browse/cart/checkout/orders, COD payment), staff accounts + permissions, order admin with status-driven stock commit/restock, tax classes/rates + geo-zones, CMS pages, homepage slides, store settings, reports (sales/products/customers, CSV export), newsletter, product Q&A.

Not yet built: multi-language/multi-currency UI (single `en`/`USD` throughout today), a formal pluggable payment/shipping module admin UI (only `cod` + two static shipping options ship today), PWA manifest.
