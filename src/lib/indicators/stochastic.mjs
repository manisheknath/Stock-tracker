import { closes, highs, lows, sma, rollingHighest, rollingLowest, lastValid, clamp } from './helpers.mjs';

// SMA of a series with leading nulls, only emitting a value once the whole
// smoothing window sits inside the valid region (no zero-substitution bleed).
function smaWithLeadingNulls(values, period) {
  const firstValid = values.findIndex((v) => v !== null);
  if (firstValid === -1) return new Array(values.length).fill(null);
  const trimmed = values.slice(firstValid);
  const smaTrimmed = sma(trimmed, period);
  return new Array(firstValid).fill(null).concat(smaTrimmed);
}

export function computeStochastic(bars, kPeriod = 14, kSmooth = 3, dPeriod = 3) {
  const close = closes(bars);
  const highN = rollingHighest(highs(bars), kPeriod);
  const lowN = rollingLowest(lows(bars), kPeriod);

  const rawK = close.map((c, i) => {
    if (highN[i] === null || lowN[i] === null || highN[i] === lowN[i]) return null;
    return ((c - lowN[i]) / (highN[i] - lowN[i])) * 100;
  });

  const kSeries = smaWithLeadingNulls(rawK, kSmooth);
  const dSeries = smaWithLeadingNulls(kSeries, dPeriod);

  const values = kSeries.map((k, i) => ({ k, d: dSeries[i] }));

  const k = lastValid(kSeries);
  if (k === null) return { values, signal: 'neutral', strength: 0 };

  const signal = k >= 80 ? 'sell' : k <= 20 ? 'buy' : 'neutral';
  const strength = clamp(Math.abs(k - 50) * 2, 0, 100);
  return { values, signal, strength };
}
