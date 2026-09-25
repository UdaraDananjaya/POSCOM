import { roundMoney } from '../utils/money.js';

/**
 * Does this geoZone's zone list match a customer address? Mirrors LiteCart's
 * zones_to_geo_zones matching: countryCode required, zoneCode/city optional
 * wildcards (blank = matches any).
 */
function geoZoneMatches(geoZone, address) {
  if (!address?.countryCode) return false;
  return (geoZone.zones || []).some((z) => {
    if (z.countryCode !== address.countryCode) return false;
    if (z.zoneCode && z.zoneCode !== address.zoneCode) return false;
    if (z.city && z.city.toLowerCase() !== (address.city || '').toLowerCase()) return false;
    return true;
  });
}

/**
 * Find tax rates applicable to a tax class for a customer's address, honouring
 * each rate's addressType (payment|shipping) and company/individual tax-id rules.
 * @param {object} customer - { paymentAddress, shippingAddress, isCompany, hasTaxId }
 */
export function getApplicableTaxRates({ taxRates, geoZones, taxClassId, customer }) {
  const geoZoneById = new Map(geoZones.map((g) => [g.id, g]));
  return taxRates.filter((rate) => {
    if (rate.taxClassId !== taxClassId) return false;
    const geoZone = geoZoneById.get(rate.geoZoneId);
    if (!geoZone) return false;
    const address = rate.addressType === 'shipping'
      ? (customer?.shippingAddress || customer?.paymentAddress)
      : customer?.paymentAddress;
    if (!geoZoneMatches(geoZone, address)) return false;

    const isCompany = !!customer?.isCompany;
    const hasTaxId = !!customer?.hasTaxId;
    if (isCompany && hasTaxId && rate.ruleCompaniesWithTaxId === false) return false;
    if (isCompany && !hasTaxId && rate.ruleCompaniesWithoutTaxId === false) return false;
    if (!isCompany && hasTaxId && rate.ruleIndividualsWithTaxId === false) return false;
    if (!isCompany && !hasTaxId && rate.ruleIndividualsWithoutTaxId === false) return false;
    return true;
  });
}

/** Sum tax for a price given the matching rates — fixed rates add flat, percent rates add value*rate/100. */
export function getTax(price, rates) {
  const total = rates.reduce((sum, rate) => {
    if (rate.type === 'fixed') return sum + Number(rate.rate);
    return sum + price * (Number(rate.rate) / 100);
  }, 0);
  return roundMoney(total);
}

export function getPriceWithTax(price, rates) {
  return roundMoney(price + getTax(price, rates));
}
