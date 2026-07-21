import { closes, highs, lows, rollingHighest, rollingLowest } from '../../indicators/helpers.mjs';
import { computeADX } from '../../indicators/adx.mjs';

export const name = 'Donchian 20 Breakout + ADX filter';

const DONCHIAN_PERIOD = 20;
const ADX_TREND_THRESHOLD = 25;

export function generateSignals(bars) {
  const close = closes(bars);
  const donchianHigh = rollingHighest(highs(bars), DONCHIAN_PERIOD);
  const donchianLow = rollingLowest(lows(bars), DONCHIAN_PERIOD);
  const adxSeries = computeADX(bars, 14).values;
  const signals = [];

  for (let i = 1; i < bars.length; i++) {
    // Use yesterday's channel (not including today's own bar) as the
    // breakout threshold -- today's high/low can't count toward its own breakout.
    const priorHigh = donchianHigh[i - 1];
    const priorLow = donchianLow[i - 1];
    if (priorHigh === null || priorLow === null) continue;

    const adx = adxSeries[i]?.adx;
    const breakoutUp = close[i] > priorHigh && adx !== undefined && adx !== null && adx >= ADX_TREND_THRESHOLD;
    const breakoutDown = close[i] < priorLow;

    if (breakoutUp) signals.push({ index: i, type: 'enter' });
    if (breakoutDown) signals.push({ index: i, type: 'exit' });
  }

  return signals;
}
