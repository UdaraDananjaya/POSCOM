/** Round to the currency's decimal places (default 2), avoiding float drift. */
export function roundMoney(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function formatMoney(value, { symbol = '', decimals = 2 } = {}) {
  const n = roundMoney(value, decimals).toFixed(decimals);
  return symbol ? `${symbol}${n}` : n;
}
