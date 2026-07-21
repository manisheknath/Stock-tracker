import { closes, ema, trueRange, wilderRMA, lastValid, clamp } from './helpers.mjs';

export function computeKeltner(bars, emaPeriod = 20, atrPeriod = 10, mult = 2) {
  const close = closes(bars);
  const middle = ema(close, emaPeriod);
  const atr = wilderRMA(trueRange(bars), atrPeriod);
  const upper = middle.map((m, i) => (m === null || atr[i] === null ? null : m + mult * atr[i]));
  const lower = middle.map((m, i) => (m === null || atr[i] === null ? null : m - mult * atr[i]));
  const values = middle.map((m, i) => ({ middle: m, upper: upper[i], lower: lower[i] }));

  const price = lastValid(close);
  const u = lastValid(upper);
  const l = lastValid(lower);
  if (price === null || u === null || l === null || u === l) {
    return { values, signal: 'neutral', strength: 0 };
  }

  const percentK = (price - l) / (u - l);
  const signal = price >= u ? 'sell' : price <= l ? 'buy' : 'neutral';
  const strength = clamp(Math.abs(percentK - 0.5) * 200, 0, 100);
  return { values, signal, strength };
}
