import { shape, priorTrendPct, volumeRatio, combineConfidence, clamp } from './helpers.mjs';

const TREND_WINDOW = 5;

export function detectPiercingDarkCloud(bars) {
  const matches = [];
  for (let i = TREND_WINDOW + 1; i < bars.length; i++) {
    const prev = shape(bars[i - 1]);
    const curr = shape(bars[i]);
    if (prev.body === 0) continue;

    const prevOpen = bars[i - 1].open;
    const prevClose = bars[i - 1].close;
    const trend = priorTrendPct(bars, i - 1, TREND_WINDOW);

    if (prev.bearish && curr.bullish
      && bars[i].open < bars[i - 1].low
      && bars[i].close > prevClose && bars[i].close < prevOpen) {
      const penetration = (bars[i].close - prevClose) / (prevOpen - prevClose);
      if (penetration > 0.5) {
        matches.push({
          pattern: 'Piercing',
          direction: 'bullish',
          confidence: Math.round(combineConfidence({
            geometricFit: clamp((penetration - 0.5) / 0.5, 0, 1),
            volumeConfirmation: volumeRatio(bars, i),
            trendAlignment: clamp(-trend / 5, 0, 1),
          })),
          barIndex: i,
          keyLevels: { priorOpen: prevOpen, priorClose: prevClose, open: bars[i].open, close: bars[i].close },
          description: `Gap-down open recovers to close ${(penetration * 100).toFixed(0)}% into the prior bearish body after a ${Math.abs(trend).toFixed(1)}% pullback.`,
        });
      }
    } else if (prev.bullish && curr.bearish
      && bars[i].open > bars[i - 1].high
      && bars[i].close < prevClose && bars[i].close > prevOpen) {
      const penetration = (prevClose - bars[i].close) / (prevClose - prevOpen);
      if (penetration > 0.5) {
        matches.push({
          pattern: 'Dark Cloud Cover',
          direction: 'bearish',
          confidence: Math.round(combineConfidence({
            geometricFit: clamp((penetration - 0.5) / 0.5, 0, 1),
            volumeConfirmation: volumeRatio(bars, i),
            trendAlignment: clamp(trend / 5, 0, 1),
          })),
          barIndex: i,
          keyLevels: { priorOpen: prevOpen, priorClose: prevClose, open: bars[i].open, close: bars[i].close },
          description: `Gap-up open falls back to close ${(penetration * 100).toFixed(0)}% into the prior bullish body after a ${trend.toFixed(1)}% rally.`,
        });
      }
    }
  }
  return matches;
}
