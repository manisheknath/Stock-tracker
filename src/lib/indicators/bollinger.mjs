import { closes, sma, stdev, lastValid, clamp } from './helpers.mjs';

export function computeBollinger(bars, period = 20, mult = 2) {
  const close = closes(bars);
  const middle = sma(close, period);
  const dev = stdev(close, period);
  const upper = middle.map((m, i) => (m === null ? null : m + mult * dev[i]));
  const lower = middle.map((m, i) => (m === null ? null : m - mult * dev[i]));
  const values = middle.map((m, i) => ({ middle: m, upper: upper[i], lower: lower[i] }));

  const price = lastValid(close);
  const u = lastValid(upper);
  const l = lastValid(lower);
  if (price === null || u === null || l === null || u === l) {
    return { values, signal: 'neutral', strength: 0 };
  }

  const percentB = (price - l) / (u - l);
  const signal = price >= u ? 'sell' : price <= l ? 'buy' : 'neutral';
  const strength = clamp(Math.abs(percentB - 0.5) * 200, 0, 100);
  return { values, signal, strength };
}
