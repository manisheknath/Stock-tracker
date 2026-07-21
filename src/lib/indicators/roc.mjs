import { closes, lastValid, strengthFromPct } from './helpers.mjs';

export function computeROC(bars, period = 12) {
  const close = closes(bars);
  const values = close.map((c, i) => (
    i < period ? null : ((c - close[i - period]) / close[i - period]) * 100
  ));

  const roc = lastValid(values);
  if (roc === null) return { values, signal: 'neutral', strength: 0 };

  const signal = roc > 0 ? 'buy' : roc < 0 ? 'sell' : 'neutral';
  return { values, signal, strength: strengthFromPct(roc, 10) };
}
