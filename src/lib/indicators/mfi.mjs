import { closes, highs, lows, volumes, lastValid, clamp } from './helpers.mjs';

export function computeMFI(bars, period = 14) {
  const close = closes(bars);
  const high = highs(bars);
  const low = lows(bars);
  const volume = volumes(bars);
  const typicalPrice = close.map((c, i) => (high[i] + low[i] + c) / 3);
  const rawMoneyFlow = typicalPrice.map((tp, i) => tp * volume[i]);

  const values = close.map((_, i) => {
    if (i < period) return null;
    let posFlow = 0;
    let negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (j === 0) continue;
      if (typicalPrice[j] > typicalPrice[j - 1]) posFlow += rawMoneyFlow[j];
      else if (typicalPrice[j] < typicalPrice[j - 1]) negFlow += rawMoneyFlow[j];
    }
    if (negFlow === 0) return 100;
    if (posFlow === 0) return 0;
    const moneyRatio = posFlow / negFlow;
    return 100 - 100 / (1 + moneyRatio);
  });

  const mfi = lastValid(values);
  if (mfi === null) return { values, signal: 'neutral', strength: 0 };

  const signal = mfi >= 80 ? 'sell' : mfi <= 20 ? 'buy' : 'neutral';
  const strength = clamp(Math.abs(mfi - 50) * 2, 0, 100);
  return { values, signal, strength };
}
