import { closes, highs, lows, sma, lastValid, clamp } from './helpers.mjs';

export function computeCCI(bars, period = 20) {
  const close = closes(bars);
  const high = highs(bars);
  const low = lows(bars);
  const typicalPrice = close.map((c, i) => (high[i] + low[i] + c) / 3);
  const smaTP = sma(typicalPrice, period);

  const values = typicalPrice.map((tp, i) => {
    if (smaTP[i] === null) return null;
    let meanDev = 0;
    for (let j = i - period + 1; j <= i; j++) meanDev += Math.abs(typicalPrice[j] - smaTP[i]);
    meanDev /= period;
    if (meanDev === 0) return 0;
    return (tp - smaTP[i]) / (0.015 * meanDev);
  });

  const cci = lastValid(values);
  if (cci === null) return { values, signal: 'neutral', strength: 0 };

  const signal = cci >= 100 ? 'sell' : cci <= -100 ? 'buy' : 'neutral';
  const strength = clamp(Math.abs(cci) / 2, 0, 100);
  return { values, signal, strength };
}
