import { shape, volumeRatio, combineConfidence, clamp } from './helpers.mjs';

const MIN_BODY_RATIO = 0.6;
const MAX_SAME_SIDE_SHADOW_RATIO = 0.2;

export function detectThreeSoldiersCrows(bars) {
  const matches = [];
  for (let i = 2; i < bars.length; i++) {
    const s0 = shape(bars[i - 2]);
    const s1 = shape(bars[i - 1]);
    const s2 = shape(bars[i]);

    const allStrongBullish = [s0, s1, s2].every((s) => s.bullish && s.bodyRatio >= MIN_BODY_RATIO && s.upperShadowRatio <= MAX_SAME_SIDE_SHADOW_RATIO);
    const allStrongBearish = [s0, s1, s2].every((s) => s.bearish && s.bodyRatio >= MIN_BODY_RATIO && s.lowerShadowRatio <= MAX_SAME_SIDE_SHADOW_RATIO);

    if (allStrongBullish
      && bars[i - 2].close < bars[i - 1].close && bars[i - 1].close < bars[i].close
      && bars[i - 1].open > bars[i - 2].open && bars[i - 1].open < bars[i - 2].close
      && bars[i].open > bars[i - 1].open && bars[i].open < bars[i - 1].close) {
      const avgBodyRatio = (s0.bodyRatio + s1.bodyRatio + s2.bodyRatio) / 3;
      matches.push({
        pattern: 'Three White Soldiers',
        direction: 'bullish',
        confidence: Math.round(combineConfidence({
          geometricFit: clamp((avgBodyRatio - MIN_BODY_RATIO) / (1 - MIN_BODY_RATIO), 0, 1),
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment: 1,
        })),
        barIndex: i,
        keyLevels: { closes: [bars[i - 2].close, bars[i - 1].close, bars[i].close] },
        description: 'Three consecutive strong-bodied bullish candles, each opening within the prior body and closing progressively higher.',
      });
    } else if (allStrongBearish
      && bars[i - 2].close > bars[i - 1].close && bars[i - 1].close > bars[i].close
      && bars[i - 1].open < bars[i - 2].open && bars[i - 1].open > bars[i - 2].close
      && bars[i].open < bars[i - 1].open && bars[i].open > bars[i - 1].close) {
      const avgBodyRatio = (s0.bodyRatio + s1.bodyRatio + s2.bodyRatio) / 3;
      matches.push({
        pattern: 'Three Black Crows',
        direction: 'bearish',
        confidence: Math.round(combineConfidence({
          geometricFit: clamp((avgBodyRatio - MIN_BODY_RATIO) / (1 - MIN_BODY_RATIO), 0, 1),
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment: 1,
        })),
        barIndex: i,
        keyLevels: { closes: [bars[i - 2].close, bars[i - 1].close, bars[i].close] },
        description: 'Three consecutive strong-bodied bearish candles, each opening within the prior body and closing progressively lower.',
      });
    }
  }
  return matches;
}
