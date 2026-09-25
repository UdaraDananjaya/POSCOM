# My Shop

A POS and Ecom storefront that share one Firebase-backed stock pool. Vue 3 + Vite + Vuetify on the frontend, Firebase (Auth, Firestore, Storage, Cloud Functions) on the backend.

Rebuilt from the LiteCart PHP cart in `../litecart` — see `../.claude/plans/valiant-wibbling-riddle.md` for the full architecture/milestone plan.

## Structure

```
apps/storefront/   Public Ecom site (customers)
apps/backoffice/   POS + Admin panel (staff)
packages/shared/   Firebase client, business logic, composables, theme — used by both apps
functions/         Cloud Functions: the only path that ever changes stock quantities
scripts/seed.mjs   Seeds order statuses, a sample catalog, and a super-admin login
```

This project runs against your real Firebase project (`gts-pos-online`, configured in `.firebaserc`) — there is no local emulator setup.

## First-time setup

1. Install dependencies (from the repo root): `npm install`
2. Install the Firebase CLI if you don't have it: `npm install -g firebase-tools`, then `firebase login`.
3. In the [Firebase Console](https://console.firebase.google.com/project/gts-pos-online):
   - Authentication → Sign-in method → enable **Email/Password**.
   - Firestore Database → create a database (production mode).
   - Storage → create a default bucket.
4. Deploy security rules and Cloud Functions: `firebase deploy --only firestore:rules,storage:rules,functions`
5. `apps/storefront/.env.local` and `apps/backoffice/.env.local` already hold the project's Web SDK config.
6. Run each app:
   ```
   npm run dev:storefront   # http://localhost:5173
   npm run dev:backoffice   # http://localhost:5174
   ```
7. Seed baseline data (order statuses are required for any order/sale to work) — this writes real data to the live project, including a super-admin login with a default password, so review `scripts/seed.mjs` first:
   ```
   gcloud auth application-default login   # once, if you haven't already
   CONFIRM_SEED=yes npm run seed
   ```
   Sign in to the backoffice at `/login` with the seeded account: **admin@myshop.local / password123** — change this password immediately after first login. Skip the sample categories/products in the script (or edit them) if you'd rather enter your real catalog by hand in the admin panel.

## Deploying to hosting

Wire up hosting targets once, then build and deploy:
```
firebase target:apply hosting storefront <your-storefront-site-id>
firebase target:apply hosting backoffice <your-backoffice-site-id>
npm run build:storefront && npm run build:backoffice
firebase deploy --only hosting
```

## How stock stays consistent across POS and Ecom

Every quantity change — a POS sale, an Ecom order being reserved/paid/cancelled, or a manual stock adjustment — goes through one Cloud Function code path (`functions/src/stock.js`), inside a Firestore transaction, and is recorded in the `stockMovements` ledger. Firestore security rules block direct client writes to `orders` and to product `quantity`/`reserved`, so neither app can bypass this. See the plan doc for the full reserve-vs-commit model (mirrors LiteCart's `order_statuses.stock_action`).

## What's built vs. what's next

Implemented: catalog (products/categories/manufacturers), shared stock engine, POS sale flow (barcode input, cash/card tender, receipt print, offline queue), Ecom storefront (browse/cart/checkout/orders, COD payment), staff accounts + permissions, order admin with status-driven stock commit/restock, tax classes/rates + geo-zones, CMS pages, homepage slides, store settings, reports (sales/products/customers, CSV export), newsletter, product Q&A.

Not yet built: multi-language/multi-currency UI (single `en`/`USD` throughout today), a formal pluggable payment/shipping module admin UI (the code shape exists in `functions/src/callable/placeEcomOrder.js`; only `cod` + two static shipping options ship today), PWA manifest.
