import { closes, sma } from '../../indicators/helpers.mjs';
import { computeRSI } from '../../indicators/rsi.mjs';

export const name = 'RSI(2) Mean Reversion above 200DMA';

const OVERSOLD = 10;
const OVERBOUGHT = 70;
const MAX_HOLD_BARS = 10;

export function generateSignals(bars) {
  const close = closes(bars);
  const sma200 = sma(close, 200);
  const rsi2 = computeRSI(bars, 2).values;
  const signals = [];

  let inPosition = false;
  let entryIndex = null;

  for (let i = 0; i < bars.length; i++) {
    if (sma200[i] === null || rsi2[i] === null) continue;

    if (!inPosition) {
      if (rsi2[i] < OVERSOLD && close[i] > sma200[i]) {
        signals.push({ index: i, type: 'enter' });
        inPosition = true;
        entryIndex = i;
      }
    } else if (rsi2[i] > OVERBOUGHT || i - entryIndex >= MAX_HOLD_BARS) {
      signals.push({ index: i, type: 'exit' });
      inPosition = false;
    }
  }

  return signals;
}
