import { shape, priorTrendPct, volumeRatio, combineConfidence, clamp } from './helpers.mjs';

const TREND_WINDOW = 5;
const LONG_BODY_RATIO = 0.5;
const STAR_MAX_BODY_RATIO = 0.3;

export function detectStar(bars) {
  const matches = [];
  for (let i = TREND_WINDOW + 2; i < bars.length; i++) {
    const c1 = shape(bars[i - 2]);
    const c2 = shape(bars[i - 1]);
    const c3 = shape(bars[i]);
    if (c1.body === 0) continue;

    const trend = priorTrendPct(bars, i - 2, TREND_WINDOW);
    const c1Open = bars[i - 2].open;
    const c1Close = bars[i - 2].close;

    const isMorning = c1.bearish && c1.bodyRatio >= LONG_BODY_RATIO
      && c2.bodyRatio <= STAR_MAX_BODY_RATIO
      && Math.max(bars[i - 1].open, bars[i - 1].close) <= c1Close
      && c3.bullish && c3.bodyRatio >= LONG_BODY_RATIO
      && bars[i].close > (c1Open + c1Close) / 2;

    const isEvening = c1.bullish && c1.bodyRatio >= LONG_BODY_RATIO
      && c2.bodyRatio <= STAR_MAX_BODY_RATIO
      && Math.min(bars[i - 1].open, bars[i - 1].close) >= c1Close
      && c3.bearish && c3.bodyRatio >= LONG_BODY_RATIO
      && bars[i].close < (c1Open + c1Close) / 2;

    if (isMorning) {
      const penetration = (bars[i].close - c1Close) / (c1Open - c1Close);
      matches.push({
        pattern: 'Morning Star',
        direction: 'bullish',
        confidence: Math.round(combineConfidence({
          geometricFit: clamp(penetration, 0, 1),
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment: clamp(-trend / 5, 0, 1),
        })),
        barIndex: i,
        keyLevels: { candle1Open: c1Open, candle1Close: c1Close, starBody: [bars[i - 1].open, bars[i - 1].close], close: bars[i].close },
        description: `Long bearish candle, a gapped-down small-bodied star, then a bullish candle closing ${(penetration * 100).toFixed(0)}% back into the first candle's body.`,
      });
    } else if (isEvening) {
      const penetration = (c1Close - bars[i].close) / (c1Close - c1Open);
      matches.push({
        pattern: 'Evening Star',
        direction: 'bearish',
        confidence: Math.round(combineConfidence({
          geometricFit: clamp(penetration, 0, 1),
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment: clamp(trend / 5, 0, 1),
        })),
        barIndex: i,
        keyLevels: { candle1Open: c1Open, candle1Close: c1Close, starBody: [bars[i - 1].open, bars[i - 1].close], close: bars[i].close },
        description: `Long bullish candle, a gapped-up small-bodied star, then a bearish candle closing ${(penetration * 100).toFixed(0)}% back into the first candle's body.`,
      });
    }
  }
  return matches;
}
