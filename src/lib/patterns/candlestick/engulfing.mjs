import { shape, priorTrendPct, volumeRatio, combineConfidence, clamp } from './helpers.mjs';

const TREND_WINDOW = 5;

export function detectEngulfing(bars) {
  const matches = [];
  for (let i = TREND_WINDOW + 1; i < bars.length; i++) {
    const prev = shape(bars[i - 1]);
    const curr = shape(bars[i]);
    if (prev.body === 0 || curr.body === 0) continue;

    const trend = priorTrendPct(bars, i - 1, TREND_WINDOW);
    const sizeFit = clamp(curr.body / prev.body - 1, 0, 1);

    const isBullish = prev.bearish && curr.bullish
      && bars[i].open <= bars[i - 1].close && bars[i].close >= bars[i - 1].open;
    const isBearish = prev.bullish && curr.bearish
      && bars[i].open >= bars[i - 1].close && bars[i].close <= bars[i - 1].open;

    if (isBullish) {
      matches.push({
        pattern: 'Bullish Engulfing',
        direction: 'bullish',
        confidence: Math.round(combineConfidence({
          geometricFit: sizeFit,
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment: clamp(-trend / 5, 0, 1),
        })),
        barIndex: i,
        keyLevels: { priorOpen: bars[i - 1].open, priorClose: bars[i - 1].close, open: bars[i].open, close: bars[i].close },
        description: `Bullish body (${(curr.body / prev.body).toFixed(1)}x prior) fully engulfs the prior bearish candle after a ${trend.toFixed(1)}% pullback.`,
      });
    } else if (isBearish) {
      matches.push({
        pattern: 'Bearish Engulfing',
        direction: 'bearish',
        confidence: Math.round(combineConfidence({
          geometricFit: sizeFit,
          volumeConfirmation: volumeRatio(bars, i),
          trendAlignment: clamp(trend / 5, 0, 1),
        })),
        barIndex: i,
        keyLevels: { priorOpen: bars[i - 1].open, priorClose: bars[i - 1].close, open: bars[i].open, close: bars[i].close },
        description: `Bearish body (${(curr.body / prev.body).toFixed(1)}x prior) fully engulfs the prior bullish candle after a ${trend.toFixed(1)}% rally.`,
      });
    }
  }
  return matches;
}
