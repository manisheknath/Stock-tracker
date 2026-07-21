import { closes, volumes, sma, lastValid, strengthFromPct } from './helpers.mjs';

export function computeOBV(bars, trendPeriod = 20) {
  const close = closes(bars);
  const volume = volumes(bars);
  const values = new Array(close.length).fill(null);
  values[0] = volume[0];
  for (let i = 1; i < close.length; i++) {
    if (close[i] > close[i - 1]) values[i] = values[i - 1] + volume[i];
    else if (close[i] < close[i - 1]) values[i] = values[i - 1] - volume[i];
    else values[i] = values[i - 1];
  }

  const obvSMA = sma(values, trendPeriod);
  const obv = lastValid(values);
  const trend = lastValid(obvSMA);
  if (obv === null || trend === null || trend === 0) {
    return { values, signal: 'neutral', strength: 0 };
  }

  const pctDist = ((obv - trend) / Math.abs(trend)) * 100;
  const signal = obv > trend ? 'buy' : obv < trend ? 'sell' : 'neutral';
  return { values, signal, strength: strengthFromPct(pctDist, 20) };
}
