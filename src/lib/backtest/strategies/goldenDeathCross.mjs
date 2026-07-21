import { closes, sma } from '../../indicators/helpers.mjs';

export const name = 'Golden/Death Cross (50/200)';

export function generateSignals(bars) {
  const close = closes(bars);
  const sma50 = sma(close, 50);
  const sma200 = sma(close, 200);
  const signals = [];

  for (let i = 1; i < bars.length; i++) {
    if (sma50[i - 1] === null || sma200[i - 1] === null || sma50[i] === null || sma200[i] === null) continue;
    const goldenCross = sma50[i - 1] <= sma200[i - 1] && sma50[i] > sma200[i];
    const deathCross = sma50[i - 1] >= sma200[i - 1] && sma50[i] < sma200[i];
    if (goldenCross) signals.push({ index: i, type: 'enter' });
    if (deathCross) signals.push({ index: i, type: 'exit' });
  }

  return signals;
}
