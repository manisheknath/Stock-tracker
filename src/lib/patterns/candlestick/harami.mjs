import { shape, priorTrendPct, volumeRatio, combineConfidence, clamp } from './helpers.mjs';

const TREND_WINDOW = 5;
const MAX_BODY_RATIO_TO_PRIOR = 0.5;

export function detectHarami(bars) {
  const matches = [];
  for (let i = TREND_WINDOW + 1; i < bars.length; i++) {
    const prev = shape(bars[i - 1]);
    const curr = shape(bars[i]);
    if (prev.body === 0) continue;
    if (curr.body > MAX_BODY_RATIO_TO_PRIOR * prev.body) continue;

    const prevLow = Math.min(bars[i - 1].open, bars[i - 1].close);
    const prevHigh = Math.max(bars[i - 1].open, bars[i - 1].close);
    const currLow = Math.min(bars[i].open, bars[i].close);
    const currHigh = Math.max(bars[i].open, bars[i].close);
    const contained = currLow >= prevLow && currHigh <= prevHigh;
    if (!contained) continue;

    const trend = priorTrendPct(bars, i - 1, TREND_WINDOW);
    const geometricFit = clamp(1 - curr.body / prev.body, 0, 1);

    if (prev.bearish) {
      matches.push({
        pattern: 'Bullish Harami',
        direction: 'bullish',
        confidence: Math.round(combineConfidence({
          geometricFit,
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment: clamp(-trend / 5, 0, 1),
        })),
        barIndex: i,
        keyLevels: { priorOpen: bars[i - 1].open, priorClose: bars[i - 1].close, open: bars[i].open, close: bars[i].close },
        description: `Small body contained within the prior bearish candle's range after a ${Math.abs(trend).toFixed(1)}% pullback -- momentum stalling.`,
      });
    } else if (prev.bullish) {
      matches.push({
        pattern: 'Bearish Harami',
        direction: 'bearish',
        confidence: Math.round(combineConfidence({
          geometricFit,
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment: clamp(trend / 5, 0, 1),
        })),
        barIndex: i,
        keyLevels: { priorOpen: bars[i - 1].open, priorClose: bars[i - 1].close, open: bars[i].open, close: bars[i].close },
        description: `Small body contained within the prior bullish candle's range after a ${trend.toFixed(1)}% rally -- momentum stalling.`,
      });
    }
  }
  return matches;
}
