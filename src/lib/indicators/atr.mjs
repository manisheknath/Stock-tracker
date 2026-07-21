import { trueRange, wilderRMA, closes, lastValid, strengthFromPct } from './helpers.mjs';

// ATR is a volatility measure, not directional -- signal is always 'neutral'.
// strength reflects how volatile price currently is (ATR as % of price).
export function computeATR(bars, period = 14) {
  const values = wilderRMA(trueRange(bars), period);
  const atr = lastValid(values);
  const price = lastValid(closes(bars));
  if (atr === null || price === null) {
    return { values, signal: 'neutral', strength: 0 };
  }
  const atrPct = (atr / price) * 100;
  return { values, signal: 'neutral', strength: strengthFromPct(atrPct, 3) };
}
