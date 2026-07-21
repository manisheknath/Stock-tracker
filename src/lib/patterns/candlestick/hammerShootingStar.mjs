import { shape, priorTrendPct, volumeRatio, combineConfidence, clamp } from './helpers.mjs';

const MAX_BODY_RATIO = 0.35;
const MIN_OPPOSITE_SHADOW_MULT = 2; // dominant shadow must be >= 2x the body
const MAX_SAME_SIDE_SHADOW_RATIO = 0.15;
const TREND_WINDOW = 5;

// Hammer (bullish reversal after a downtrend) and Shooting Star (bearish
// reversal after an uptrend) share the same small-body-with-one-long-shadow
// shape; only the trend context and which shadow dominates differ.
export function detectHammerShootingStar(bars) {
  const matches = [];
  for (let i = TREND_WINDOW; i < bars.length; i++) {
    const s = shape(bars[i]);
    if (s.range === 0 || s.bodyRatio > MAX_BODY_RATIO || s.body === 0) continue;

    const trend = priorTrendPct(bars, i, TREND_WINDOW);
    const trendAlignment = clamp(Math.abs(trend) / 5, 0, 1);

    const isHammerShape = s.lowerShadow >= MIN_OPPOSITE_SHADOW_MULT * s.body
      && s.upperShadowRatio <= MAX_SAME_SIDE_SHADOW_RATIO;
    const isShootingStarShape = s.upperShadow >= MIN_OPPOSITE_SHADOW_MULT * s.body
      && s.lowerShadowRatio <= MAX_SAME_SIDE_SHADOW_RATIO;

    if (isHammerShape && trend < -1) {
      matches.push({
        pattern: 'Hammer',
        direction: 'bullish',
        confidence: Math.round(combineConfidence({
          geometricFit: clamp(s.lowerShadowRatio, 0, 1),
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment,
        })),
        barIndex: i,
        keyLevels: { open: bars[i].open, close: bars[i].close, high: bars[i].high, low: bars[i].low },
        description: `Small body near the top of the range with a long lower shadow (${(s.lowerShadow / s.body).toFixed(1)}x body) after a ${Math.abs(trend).toFixed(1)}% pullback -- rejection of lower prices.`,
      });
    } else if (isShootingStarShape && trend > 1) {
      matches.push({
        pattern: 'Shooting Star',
        direction: 'bearish',
        confidence: Math.round(combineConfidence({
          geometricFit: clamp(s.upperShadowRatio, 0, 1),
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment,
        })),
        barIndex: i,
        keyLevels: { open: bars[i].open, close: bars[i].close, high: bars[i].high, low: bars[i].low },
        description: `Small body near the bottom of the range with a long upper shadow (${(s.upperShadow / s.body).toFixed(1)}x body) after a ${trend.toFixed(1)}% rally -- rejection of higher prices.`,
      });
    }
  }
  return matches;
}
