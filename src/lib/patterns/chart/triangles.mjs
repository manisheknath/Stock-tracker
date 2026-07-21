import { pctDiff, findBreakoutEither, volumeRatioAt, combineConfidence, clamp } from './helpers.mjs';

const FLAT_TOLERANCE_PCT = 2;

export function detectTriangles(bars, pivots) {
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
    const lastPivot = d;

    const highsFlat = Math.abs(highsPct) <= FLAT_TOLERANCE_PCT;
    const lowsFlat = Math.abs(lowsPct) <= FLAT_TOLERANCE_PCT;
    const highsFalling = highsPct < -FLAT_TOLERANCE_PCT;
    const lowsRising = lowsPct > FLAT_TOLERANCE_PCT;

    let patternName = null;
    let fit = 0;
    if (highsFlat && lowsRising) {
      patternName = 'Ascending Triangle';
      fit = (clamp(1 - Math.abs(highsPct) / FLAT_TOLERANCE_PCT, 0, 1) + clamp(lowsPct / 10, 0, 1)) / 2;
    } else if (lowsFlat && highsFalling) {
      patternName = 'Descending Triangle';
      fit = (clamp(1 - Math.abs(lowsPct) / FLAT_TOLERANCE_PCT, 0, 1) + clamp(-highsPct / 10, 0, 1)) / 2;
    } else if (highsFalling && lowsRising) {
      patternName = 'Symmetrical Triangle';
      fit = (clamp(-highsPct / 10, 0, 1) + clamp(lowsPct / 10, 0, 1)) / 2;
    } else {
      continue;
    }

    const breakout = findBreakoutEither(bars, lastPivot.index, highs[1].price, lows[1].price);
    if (!breakout) continue;

    const patternHeight = highs[1].price - lows[1].price;
    const direction = breakout.direction === 'above' ? 'bullish' : 'bearish';
    const target = breakout.direction === 'above' ? highs[1].price + patternHeight : lows[1].price - patternHeight;

    matches.push({
      pattern: patternName,
      direction,
      confidence: Math.round(combineConfidence({
        geometricFit: fit,
        volumeConfirmation: volumeRatioAt(bars, breakout.index),
        breakoutStrength: patternHeight === 0 ? 0 : clamp(Math.abs(breakout.close - (breakout.direction === 'above' ? highs[1].price : lows[1].price)) / patternHeight, 0, 1),
      })),
      barIndex: breakout.index,
      keyLevels: { resistance: highs[1].price, support: lows[1].price, target, breakoutClose: breakout.close },
      description: `${patternName} (resistance ${highs[1].price.toFixed(2)}, support ${lows[1].price.toFixed(2)}) breaking ${breakout.direction} at ${breakout.close.toFixed(2)}.`,
    });
  }

  return matches;
}
