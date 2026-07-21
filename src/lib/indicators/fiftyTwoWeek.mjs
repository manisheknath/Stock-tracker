import { closes, highs, lows, rollingHighest, rollingLowest, lastValid, clamp } from './helpers.mjs';

// rollingHighest/Lowest return null until `period` bars are available; for a
// ticker with less than a year of history, fall back to an expanding window
// (min(period, n)) rather than reporting null for the entire series.
export function computeFiftyTwoWeek(bars, period = 252) {
  const close = closes(bars);
  const n = bars.length;
  const window = Math.min(period, n);
  const high52 = rollingHighest(highs(bars), window);
  const low52 = rollingLowest(lows(bars), window);
  const values = close.map((_, i) => ({ high52w: high52[i], low52w: low52[i] }));

  const last = values[n - 1];
  const price = lastValid(close);
  if (!last || last.high52w === null || last.low52w === null || price === null || last.high52w === last.low52w) {
    return { values, signal: 'neutral', strength: 0 };
  }

  const position = (price - last.low52w) / (last.high52w - last.low52w);
  const signal = position >= 0.98 ? 'buy' : position <= 0.02 ? 'sell' : 'neutral';
  const strength = clamp(Math.abs(position - 0.5) * 200, 0, 100);
  return { values, signal, strength };
}
