import { computeMACD } from '../../indicators/macd.mjs';
import { computeSupertrend } from '../../indicators/supertrend.mjs';

export const name = 'MACD + Supertrend confluence';

export function generateSignals(bars) {
  const macd = computeMACD(bars).values;
  const supertrend = computeSupertrend(bars).values;
  const signals = [];

  for (let i = 1; i < bars.length; i++) {
    const prevHist = macd[i - 1]?.histogram;
    const hist = macd[i]?.histogram;
    if (prevHist === null || prevHist === undefined || hist === null || hist === undefined) continue;
    const dir = supertrend[i]?.direction;
    if (!dir) continue;

    const bullishCross = prevHist <= 0 && hist > 0;
    const bearishCross = prevHist >= 0 && hist < 0;

    if (bullishCross && dir === 'up') signals.push({ index: i, type: 'enter' });
    if (bearishCross || dir === 'down') signals.push({ index: i, type: 'exit' });
  }

  return signals;
}
