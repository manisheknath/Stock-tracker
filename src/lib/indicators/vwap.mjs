import { closes, highs, lows, volumes, lastValid, strengthFromPct } from './helpers.mjs';

// True VWAP resets intraday on tick data, which this EOD pipeline doesn't have.
// This computes a rolling N-day volume-weighted average price as the daily-bar
// equivalent -- a common adaptation used by EOD-only platforms.
export function computeVWAP(bars, period = 20) {
  const close = closes(bars);
  const high = highs(bars);
  const low = lows(bars);
  const volume = volumes(bars);
  const typicalPrice = close.map((c, i) => (high[i] + low[i] + c) / 3);

  const values = new Array(close.length).fill(null);
  for (let i = period - 1; i < close.length; i++) {
    let pvSum = 0;
    let vSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      pvSum += typicalPrice[j] * volume[j];
      vSum += volume[j];
    }
    values[i] = vSum === 0 ? null : pvSum / vSum;
  }

  const vwap = lastValid(values);
  const price = lastValid(close);
  if (vwap === null || price === null) return { values, signal: 'neutral', strength: 0 };

  const pctDist = ((price - vwap) / vwap) * 100;
  const signal = price > vwap ? 'buy' : price < vwap ? 'sell' : 'neutral';
  return { values, signal, strength: strengthFromPct(pctDist, 5) };
}
