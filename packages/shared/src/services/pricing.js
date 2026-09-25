import { roundMoney } from '../utils/money.js';

/**
 * Effective unit price for a product in a given currency, honouring an active
 * time-boxed campaign price if one is running now — mirrors LiteCart's
 * ref_product::final_price (campaign price wins only when lower and active).
 * @param {object} product - product doc data, expects product.prices = {USD: 10, ...}
 *   and optional product.campaigns = [{currencyPrices:{USD:8}, startDate, endDate}]
 * @param {string} currencyCode
 * @param {Date} [now]
 */
export function getEffectivePrice(product, currencyCode, now = new Date()) {
  const basePrice = product.prices?.[currencyCode] ?? 0;
  const activeCampaign = (product.campaigns || []).find((c) => {
    const start = c.startDate ? new Date(c.startDate) : null;
    const end = c.endDate ? new Date(c.endDate) : null;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return c.currencyPrices?.[currencyCode] != null;
  });
  if (activeCampaign) {
    const campaignPrice = activeCampaign.currencyPrices[currencyCode];
    return {
      price: roundMoney(Math.min(basePrice, campaignPrice)),
      basePrice: roundMoney(basePrice),
      onCampaign: campaignPrice < basePrice,
    };
  }
  return { price: roundMoney(basePrice), basePrice: roundMoney(basePrice), onCampaign: false };
}

/**
 * Applies an option value's price_operator to a running price — mirrors
 * LiteCart's ref_product option price adjustment (+, -, +%, -%, =).
 */
export function applyPriceOperator(price, operator, amount) {
  switch (operator) {
    case '+':
      return roundMoney(price + amount);
    case '-':
      return roundMoney(price - amount);
    case '+%':
      return roundMoney(price + price * (amount / 100));
    case '-%':
      return roundMoney(price - price * (amount / 100));
    case '=':
      return roundMoney(amount);
    default:
      return roundMoney(price);
  }
}
