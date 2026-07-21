import { pctDiff, findBreakoutEither, volumeRatioAt, combineConfidence, clamp } from './helpers.mjs';

const FLAT_TOLERANCE_PCT = 3;

export function detectRectangle(bars, pivots) {
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
    if (Math.abs(highsPct) > FLAT_TOLERANCE_PCT || Math.abs(lowsPct) > FLAT_TOLERANCE_PCT) continue;

    const resistance = (highs[0].price + highs[1].price) / 2;
    const support = (lows[0].price + lows[1].price) / 2;
    if (resistance <= support) continue;

    const lastPivot = d;
    const breakout = findBreakoutEither(bars, lastPivot.index, resistance, support);
    if (!breakout) continue;

    const patternHeight = resistance - support;
    const direction = breakout.direction === 'above' ? 'bullish' : 'bearish';
    const target = direction === 'bullish' ? resistance + patternHeight : support - patternHeight;
    const fit = (clamp(1 - Math.abs(highsPct) / FLAT_TOLERANCE_PCT, 0, 1) + clamp(1 - Math.abs(lowsPct) / FLAT_TOLERANCE_PCT, 0, 1)) / 2;

    matches.push({
      pattern: 'Rectangle',
      direction,
      confidence: Math.round(combineConfidence({
        geometricFit: fit,
        volumeConfirmation: volumeRatioAt(bars, breakout.index),
        breakoutStrength: patternHeight === 0 ? 0 : clamp(Math.abs(breakout.close - (direction === 'bullish' ? resistance : support)) / patternHeight, 0, 1),
      })),
      barIndex: breakout.index,
      keyLevels: { resistance, support, target, breakoutClose: breakout.close },
      description: `Horizontal channel between ${support.toFixed(2)} and ${resistance.toFixed(2)}, breaking ${breakout.direction} at ${breakout.close.toFixed(2)}.`,
    });
  }

  return matches;
}
