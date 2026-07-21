// Shape ratios are always relative to that bar's own range/body -- never a
// fixed price/pixel threshold -- so patterns detect identically on a $5 stock
// and a $5,000 one.
export function shape(bar) {
  const range = bar.high - bar.low;
  const body = Math.abs(bar.close - bar.open);
  const bullish = bar.close > bar.open;
  const bearish = bar.close < bar.open;
  const upperShadow = bar.high - Math.max(bar.open, bar.close);
  const lowerShadow = Math.min(bar.open, bar.close) - bar.low;
  const bodyRatio = range === 0 ? 0 : body / range;
  const upperShadowRatio = range === 0 ? 0 : upperShadow / range;
  const lowerShadowRatio = range === 0 ? 0 : lowerShadow / range;
  return { range, body, bullish, bearish, upperShadow, lowerShadow, bodyRatio, upperShadowRatio, lowerShadowRatio };
}

// % change in close over the `window` bars immediately preceding index i
// (not including i) -- a simple, scale-invariant proxy for "was this a prior
// uptrend/downtrend" trend context.
export function priorTrendPct(bars, i, window = 5) {
  const start = i - window;
  if (start < 0) return 0;
  const from = bars[start].close;
  const to = bars[i - 1].close;
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

// Ratio of this bar's volume to the average of the preceding `window` bars.
// >1 means above-average volume (confirming); returns 1 (neutral) if volume
// data is missing or there's no trailing window yet.
export function volumeRatio(bars, i, window = 20) {
  const start = Math.max(0, i - window);
  if (start >= i || !bars[i].volume) return 1;
  let sum = 0;
  let count = 0;
  for (let j = start; j < i; j++) {
    if (bars[j].volume) { sum += bars[j].volume; count++; }
  }
  if (count === 0 || sum === 0) return 1;
  return bars[i].volume / (sum / count);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Combines geometric fit (0-1, how cleanly the bar(s) match the ideal shape),
// volume confirmation, and trend context into a single 0-100 confidence.
// Historical hit-rate weighting from the backtest stage gets folded in once
// that stage exists (build step 6) -- not yet available here.
export function combineConfidence({ geometricFit, volumeConfirmation = 1, trendAlignment = 1 }) {
  const volFactor = clamp(0.85 + 0.15 * clamp(volumeConfirmation, 0, 2) / 2, 0.85, 1.0);
  const trendFactor = clamp(0.85 + 0.15 * clamp(trendAlignment, 0, 1), 0.85, 1.0);
  return clamp(geometricFit * 100 * volFactor * trendFactor, 0, 100);
}
