import { pctDiff, findBreakout, volumeRatioAt, combineConfidence, clamp } from './helpers.mjs';

const SLOPE_TOLERANCE_PCT = 2;

// Both trendlines sloping the *same* direction while converging -- a rising
// wedge resolves bearish (breakdown), a falling wedge resolves bullish
// (breakout), which is what distinguishes a wedge from a channel.
export function detectWedges(bars, pivots) {
  const matches = [];

  for (let j = 0; j + 3 < pivots.length; j++) {
    const [a, b, c, d] = pivots.slice(j, j + 4);
    let highs;
    let lows;
    if (a.type === 'high' && b.type === 'low' && c.type === 'high' && d.type === 'low') {
      highs = [a, c]; lows = [b, d];
    } else if (a.type === 'low' && b.type === 'high' && c.type === 'low' && d.type === 'high') {
      highs = [b, d]; lows = [a, c];
    } else {
      continue;
    }

    const highsPct = pctDiff(highs[0].price, highs[1].price);
    const lowsPct = pctDiff(lows[0].price, lows[1].price);
    const rangeFirst = highs[0].price - lows[0].price;
    const rangeLast = highs[1].price - lows[1].price;
    const converging = rangeFirst > 0 && rangeLast < rangeFirst;
    const lastPivot = d;

    if (highsPct > SLOPE_TOLERANCE_PCT && lowsPct > SLOPE_TOLERANCE_PCT && converging) {
      const breakout = findBreakout(bars, lastPivot.index, lows[1].price, 'below');
      if (!breakout) continue;
      const fit = clamp(1 - rangeLast / rangeFirst, 0, 1);
      matches.push({
        pattern: 'Rising Wedge',
        direction: 'bearish',
        confidence: Math.round(combineConfidence({
          geometricFit: fit,
          volumeConfirmation: volumeRatioAt(bars, breakout.index),
          breakoutStrength: rangeLast === 0 ? 0 : clamp((lows[1].price - breakout.close) / rangeLast, 0, 1),
        })),
        barIndex: breakout.index,
        keyLevels: { upperTrendline: highs[1].price, lowerTrendline: lows[1].price, target: lows[1].price - rangeLast },
        description: `Both trendlines rising but converging (range narrowed ${((1 - rangeLast / rangeFirst) * 100).toFixed(0)}%), confirmed breakdown below ${lows[1].price.toFixed(2)}.`,
      });
    } else if (highsPct < -SLOPE_TOLERANCE_PCT && lowsPct < -SLOPE_TOLERANCE_PCT && converging) {
      const breakout = findBreakout(bars, lastPivot.index, highs[1].price, 'above');
      if (!breakout) continue;
      const fit = clamp(1 - rangeLast / rangeFirst, 0, 1);
      matches.push({
        pattern: 'Falling Wedge',
        direction: 'bullish',
        confidence: Math.round(combineConfidence({
          geometricFit: fit,
          volumeConfirmation: volumeRatioAt(bars, breakout.index),
          breakoutStrength: rangeLast === 0 ? 0 : clamp((breakout.close - highs[1].price) / rangeLast, 0, 1),
        })),
        barIndex: breakout.index,
        keyLevels: { upperTrendline: highs[1].price, lowerTrendline: lows[1].price, target: highs[1].price + rangeLast },
        description: `Both trendlines falling but converging (range narrowed ${((1 - rangeLast / rangeFirst) * 100).toFixed(0)}%), confirmed breakout above ${highs[1].price.toFixed(2)}.`,
      });
    }
  }

  return matches;
}
