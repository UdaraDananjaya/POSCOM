import { roundMoney } from '../utils/money.js';
import { getTax } from './tax.js';

/**
 * Composes order total line items the way LiteCart's mod_order_total does:
 * each contributor returns {title, value, tax, calculate}; calculate=false
 * rows (like subtotal) are informational only and excluded from the sum to
 * avoid double counting (items already carry their own price+tax).
 *
 * @param {object} params
 * @param {Array<{price:number, tax:number, quantity:number}>} params.items
 * @param {object} [params.shippingOption] - {title, cost, taxClassId}
 * @param {object} [params.paymentOption] - {title, cost, taxClassId}
 * @param {object} params.taxContext - { getRatesFor(taxClassId) }
 */
export function buildOrderTotals({ items, shippingOption, paymentOption, taxContext }) {
  const rows = [];

  const subtotal = roundMoney(items.reduce((s, i) => s + i.price * i.quantity, 0));
  const itemsTax = roundMoney(items.reduce((s, i) => s + i.tax * i.quantity, 0));
  rows.push({ id: 'subtotal', title: 'Subtotal', value: subtotal, tax: itemsTax, calculate: false });

  let payable = subtotal + itemsTax;

  if (shippingOption) {
    const rates = taxContext.getRatesFor(shippingOption.taxClassId);
    const tax = getTax(shippingOption.cost, rates);
    rows.push({ id: 'shipping_fee', title: shippingOption.title, value: roundMoney(shippingOption.cost), tax, calculate: true });
    payable += shippingOption.cost + tax;
  }

  if (paymentOption?.cost) {
    const rates = taxContext.getRatesFor(paymentOption.taxClassId);
    const tax = getTax(paymentOption.cost, rates);
    rows.push({ id: 'payment_fee', title: paymentOption.title, value: roundMoney(paymentOption.cost), tax, calculate: true });
    payable += paymentOption.cost + tax;
  }

  return {
    rows,
    subtotal,
    taxTotal: roundMoney(itemsTax + rows.filter((r) => r.calculate).reduce((s, r) => s + r.tax, 0)),
    paymentDue: roundMoney(payable),
  };
}
