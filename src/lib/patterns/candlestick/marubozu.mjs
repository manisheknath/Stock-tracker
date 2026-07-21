import { shape, volumeRatio, combineConfidence } from './helpers.mjs';

const MIN_BODY_RATIO = 0.9;
const MAX_SHADOW_RATIO = 0.05;

export function detectMarubozu(bars) {
  const matches = [];
  for (let i = 0; i < bars.length; i++) {
    const s = shape(bars[i]);
    if (s.range === 0) continue;
    if (s.bodyRatio < MIN_BODY_RATIO) continue;
    if (s.upperShadowRatio > MAX_SHADOW_RATIO || s.lowerShadowRatio > MAX_SHADOW_RATIO) continue;

    const direction = s.bullish ? 'bullish' : 'bearish';
    const confidence = combineConfidence({
      geometricFit: s.bodyRatio,
      volumeConfirmation: volumeRatio(bars, i),
      trendAlignment: 1,
    });

    matches.push({
      pattern: 'Marubozu',
      direction,
      confidence: Math.round(confidence),
      barIndex: i,
      keyLevels: { open: bars[i].open, close: bars[i].close, high: bars[i].high, low: bars[i].low },
      description: `Full-bodied ${direction} candle with negligible wicks (body ${(s.bodyRatio * 100).toFixed(0)}% of range), indicating strong ${s.bullish ? 'buying' : 'selling'} conviction.`,
    });
  }
  return matches;
}
