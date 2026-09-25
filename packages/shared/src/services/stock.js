import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

// Thin client wrappers around the Cloud Functions in functions/index.js.
// Every write that touches product quantity goes through one of these so
// POS and Ecom can never disagree about how stock is adjusted — the actual
// transaction + stockMovements ledger write live server-side (see
// functions/src/stock.js) so a compromised or buggy client can't oversell.

/** Record a manual stock adjustment (receiving, stock take correction, etc). Staff only. */
export function adjustStock(payload) {
  // payload: { productId, variantKey?, delta, reason, note? }
  return httpsCallable(functions, 'adjustStock')(payload);
}

/** Complete a POS sale: creates the order (source:'pos') and commits stock immediately. */
export function placePosSale(payload) {
  // payload: { items:[{productId, variantKey?, name, sku, price, tax, quantity}], payments:[{method, amount}], staffId }
  return httpsCallable(functions, 'placePosSale')(payload);
}

/** Place an Ecom order: creates the order at the default initial status and reserves stock. */
export function placeEcomOrder(payload) {
  // payload: { items, customer, shippingOption, paymentOption, orderTotal, currencyCode }
  return httpsCallable(functions, 'placeEcomOrder')(payload);
}

/** Move an order to a new status; server restocks/withdraws per the two statuses' stockAction. */
export function updateOrderStatus(payload) {
  // payload: { orderId, newStatusId }
  return httpsCallable(functions, 'updateOrderStatus')(payload);
}
