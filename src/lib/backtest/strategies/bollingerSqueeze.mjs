import { closes, rollingLowest } from '../../indicators/helpers.mjs';
import { computeBollinger } from '../../indicators/bollinger.mjs';

export const name = 'Bollinger Squeeze release';

const SQUEEZE_LOOKBACK = 100;
const SQUEEZE_TOLERANCE = 1.1; // within 10% of the trailing-100-bar bandwidth low

export function generateSignals(bars) {
  const close = closes(bars);
  const bb = computeBollinger(bars).values;
  const bandwidth = bb.map((b) => (b.middle === null || b.middle === 0 ? null : (b.upper - b.lower) / b.middle));
  const bandwidthLow = rollingLowest(bandwidth.map((v) => (v === null ? Infinity : v)), SQUEEZE_LOOKBACK);
  const signals = [];

  for (let i = 1; i < bars.length; i++) {
    const priorBandwidth = bandwidth[i - 1];
    const priorLow = bandwidthLow[i - 1];
    const priorUpper = bb[i - 1]?.upper;
    if (priorBandwidth === null || priorLow === null || priorUpper == null) continue;

    const wasSqueezed = priorBandwidth <= priorLow * SQUEEZE_TOLERANCE;
    const breakout = close[i] > priorUpper;
    if (wasSqueezed && breakout) signals.push({ index: i, type: 'enter' });

    const middle = bb[i]?.middle;
    if (middle != null && close[i] < middle) signals.push({ index: i, type: 'exit' });
  }

  return signals;
}
