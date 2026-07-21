import { closes, sma as smaSeries, ema as emaSeries, lastValid, strengthFromPct } from './helpers.mjs';

function maResult(bars, series) {
  const price = lastValid(closes(bars));
  const maValue = lastValid(series);
  if (price === null || maValue === null) {
    return { values: series, signal: 'neutral', strength: 0 };
  }
  const pctDist = ((price - maValue) / maValue) * 100;
  const signal = price > maValue ? 'buy' : price < maValue ? 'sell' : 'neutral';
  return { values: series, signal, strength: strengthFromPct(pctDist, 10) };
}

export function computeSMA(bars, period) {
  return maResult(bars, smaSeries(closes(bars), period));
}

export function computeEMA(bars, period) {
  return maResult(bars, emaSeries(closes(bars), period));
}
