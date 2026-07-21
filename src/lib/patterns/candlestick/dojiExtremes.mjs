import { shape, volumeRatio, combineConfidence, clamp } from './helpers.mjs';
import { highs, lows, rollingHighest, rollingLowest } from '../../indicators/helpers.mjs';

const MAX_BODY_RATIO = 0.1;
const EXTREME_WINDOW = 10;
const EXTREME_TOLERANCE = 0.999; // bar's high/low must be within 0.1% of the window extreme

export function detectDojiAtExtremes(bars) {
  const matches = [];
  const highN = rollingHighest(highs(bars), EXTREME_WINDOW);
  const lowN = rollingLowest(lows(bars), EXTREME_WINDOW);

  for (let i = EXTREME_WINDOW - 1; i < bars.length; i++) {
    const s = shape(bars[i]);
    if (s.range === 0 || s.bodyRatio > MAX_BODY_RATIO) continue;

    const atTop = highN[i] !== null && bars[i].high >= highN[i] * EXTREME_TOLERANCE;
    const atBottom = lowN[i] !== null && bars[i].low <= lowN[i] / EXTREME_TOLERANCE;
    if (!atTop && !atBottom) continue;

    const direction = atTop ? 'bearish' : 'bullish';
    const geometricFit = clamp(1 - s.bodyRatio / MAX_BODY_RATIO, 0, 1);

    matches.push({
      pattern: 'Doji at extreme',
      direction,
      confidence: Math.round(combineConfidence({
        geometricFit,
        volumeConfirmation: volumeRatio(bars, i),
        trendAlignment: 1,
      })),
      barIndex: i,
      keyLevels: { open: bars[i].open, close: bars[i].close, high: bars[i].high, low: bars[i].low },
      description: `Doji (body ${(s.bodyRatio * 100).toFixed(1)}% of range) at a ${EXTREME_WINDOW}-bar ${atTop ? 'high' : 'low'} -- indecision at a potential reversal point.`,
    });
  }
  return matches;
}
