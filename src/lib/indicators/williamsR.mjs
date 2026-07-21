import { closes, highs, lows, rollingHighest, rollingLowest, lastValid, clamp } from './helpers.mjs';

export function computeWilliamsR(bars, period = 14) {
  const close = closes(bars);
  const highN = rollingHighest(highs(bars), period);
  const lowN = rollingLowest(lows(bars), period);

  const values = close.map((c, i) => {
    if (highN[i] === null || lowN[i] === null || highN[i] === lowN[i]) return null;
    return ((highN[i] - c) / (highN[i] - lowN[i])) * -100;
  });

  const r = lastValid(values);
  if (r === null) return { values, signal: 'neutral', strength: 0 };

  const signal = r <= -80 ? 'buy' : r >= -20 ? 'sell' : 'neutral';
  const strength = clamp(Math.abs(r + 50) * 2, 0, 100);
  return { values, signal, strength };
}
