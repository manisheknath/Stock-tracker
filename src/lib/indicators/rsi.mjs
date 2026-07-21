import { closes, wilderRMA, lastValid, clamp } from './helpers.mjs';

export function computeRSI(bars, period = 14) {
  const close = closes(bars);
  const gains = new Array(close.length).fill(null);
  const losses = new Array(close.length).fill(null);
  for (let i = 1; i < close.length; i++) {
    const change = close[i] - close[i - 1];
    gains[i] = change > 0 ? change : 0;
    losses[i] = change < 0 ? -change : 0;
  }

  const avgGain = wilderRMA(gains, period);
  const avgLoss = wilderRMA(losses, period);

  const values = close.map((_, i) => {
    if (avgGain[i] === null || avgLoss[i] === null) return null;
    if (avgLoss[i] === 0) return 100;
    if (avgGain[i] === 0) return 0;
    const rs = avgGain[i] / avgLoss[i];
    return 100 - 100 / (1 + rs);
  });

  const rsi = lastValid(values);
  if (rsi === null) return { values, signal: 'neutral', strength: 0 };

  const signal = rsi >= 70 ? 'sell' : rsi <= 30 ? 'buy' : 'neutral';
  const strength = clamp(Math.abs(rsi - 50) * 2, 0, 100);
  return { values, signal, strength };
}
