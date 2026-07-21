import { closes, highs, lows, trueRange, wilderRMA, lastValid, strengthFromPct } from './helpers.mjs';

export function computeSupertrend(bars, period = 10, multiplier = 3) {
  const close = closes(bars);
  const high = highs(bars);
  const low = lows(bars);
  const atr = wilderRMA(trueRange(bars), period);

  const n = bars.length;
  const finalUpper = new Array(n).fill(null);
  const finalLower = new Array(n).fill(null);
  const supertrend = new Array(n).fill(null);
  const direction = new Array(n).fill(null); // 'up' | 'down'

  for (let i = 0; i < n; i++) {
    if (atr[i] === null) continue;
    const mid = (high[i] + low[i]) / 2;
    const basicUpper = mid + multiplier * atr[i];
    const basicLower = mid - multiplier * atr[i];

    const prevFinalUpper = finalUpper[i - 1];
    const prevFinalLower = finalLower[i - 1];

    finalUpper[i] = (prevFinalUpper === null || basicUpper < prevFinalUpper || close[i - 1] > prevFinalUpper)
      ? basicUpper : prevFinalUpper;
    finalLower[i] = (prevFinalLower === null || basicLower > prevFinalLower || close[i - 1] < prevFinalLower)
      ? basicLower : prevFinalLower;

    const prevSupertrend = supertrend[i - 1];
    const prevDirection = direction[i - 1];

    if (prevSupertrend === null) {
      direction[i] = close[i] > finalUpper[i] ? 'up' : 'down';
    } else if (prevDirection === 'down') {
      direction[i] = close[i] > finalUpper[i] ? 'up' : 'down';
    } else {
      direction[i] = close[i] < finalLower[i] ? 'down' : 'up';
    }

    supertrend[i] = direction[i] === 'up' ? finalLower[i] : finalUpper[i];
  }

  const values = supertrend.map((v, i) => ({ value: v, direction: direction[i] }));

  const line = lastValid(supertrend);
  const price = lastValid(close);
  const lastDir = direction[direction.map((d) => d !== null).lastIndexOf(true)];
  if (line === null || price === null || lastDir === null) {
    return { values, signal: 'neutral', strength: 0 };
  }

  const pctDist = ((price - line) / line) * 100;
  const signal = lastDir === 'up' ? 'buy' : 'sell';
  return { values, signal, strength: strengthFromPct(pctDist, 5) };
}
