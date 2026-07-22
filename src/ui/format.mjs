const MARKET_FLAGS = {
  US: '🇺🇸', UK: '🇬🇧', FR: '🇫🇷', DE: '🇩🇪', NL: '🇳🇱', ES: '🇪🇸', IN: '🇮🇳',
};

export function marketFlag(market) {
  return MARKET_FLAGS[market] ?? market;
}

// Every color-coded element must carry this same text alongside it -- color
// is never the sole signal (accessibility requirement from the spec).
export const SIGNAL_STYLES = {
  BUY: { classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'BUY' },
  SELL: { classes: 'bg-rose-500/15 text-rose-400 border-rose-500/30', label: 'SELL' },
  HOLD: { classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30', label: 'HOLD' },
};

export function convictionBarColor(conviction) {
  if (conviction >= 70) return 'bg-emerald-500';
  if (conviction >= 50) return 'bg-amber-500';
  return 'bg-slate-600';
}

export function formatPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return value.toFixed(digits);
}

// Prices carry their exchange's native currency and are never converted to a
// common one, so the label is essential -- GBp (LSE pence, so 529.30 = £5.29)
// looks like a wildly different magnitude from USD/EUR without it.
export function formatPrice(value, currency, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  return currency ? `${value.toFixed(digits)} ${currency}` : value.toFixed(digits);
}

export function formatDate(dateStr) {
  if (!dateStr) return 'n/a';
  return dateStr;
}
