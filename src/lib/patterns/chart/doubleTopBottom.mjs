import { withinTolerance, pctDiff, findBreakout, volumeRatioAt, combineConfidence, clamp } from './helpers.mjs';

const PEAK_TOLERANCE_PCT = 3;

// `pivots` is the alternating high/low pivot sequence (see alternatingPivots
// in ./helpers.mjs), computed once and shared across all chart detectors.
export function detectDoubleTopBottom(bars, pivots) {
  const matches = [];

  for (let j = 0; j + 2 < pivots.length; j++) {
    const [p0, p1, p2] = [pivots[j], pivots[j + 1], pivots[j + 2]];

    if (p0.type === 'high' && p1.type === 'low' && p2.type === 'high'
      && withinTolerance(p0.price, p2.price, PEAK_TOLERANCE_PCT)) {
      const neckline = p1.price;
      const breakout = findBreakout(bars, p2.index, neckline, 'below');
      if (!breakout) continue;
      const patternHeight = p0.price - neckline;
      const breakoutStrength = patternHeight === 0 ? 0 : clamp((neckline - breakout.close) / patternHeight, 0, 1);
      matches.push({
        pattern: 'Double Top',
        direction: 'bearish',
        confidence: Math.round(combineConfidence({
          geometricFit: clamp(1 - Math.abs(pctDiff(p0.price, p2.price)) / PEAK_TOLERANCE_PCT, 0, 1),
          volumeConfirmation: volumeRatioAt(bars, breakout.index),
          breakoutStrength,
        })),
        barIndex: breakout.index,
        keyLevels: { peak1: p0.price, neckline, peak2: p2.price, target: neckline - patternHeight, breakoutClose: breakout.close },
        description: `Two peaks near ${p2.price.toFixed(2)} (${Math.abs(pctDiff(p0.price, p2.price)).toFixed(1)}% apart) with confirmed close below the ${neckline.toFixed(2)} neckline.`,
      });
    }

    if (p0.type === 'low' && p1.type === 'high' && p2.type === 'low'
      && withinTolerance(p0.price, p2.price, PEAK_TOLERANCE_PCT)) {
      const neckline = p1.price;
      const breakout = findBreakout(bars, p2.index, neckline, 'above');
      if (!breakout) continue;
      const patternHeight = neckline - p0.price;
      const breakoutStrength = patternHeight === 0 ? 0 : clamp((breakout.close - neckline) / patternHeight, 0, 1);
      matches.push({
        pattern: 'Double Bottom',
        direction: 'bullish',
        confidence: Math.round(combineConfidence({
          geometricFit: clamp(1 - Math.abs(pctDiff(p0.price, p2.price)) / PEAK_TOLERANCE_PCT, 0, 1),
          volumeConfirmation: volumeRatioAt(bars, breakout.index),
          breakoutStrength,
        })),
        barIndex: breakout.index,
        keyLevels: { trough1: p0.price, neckline, trough2: p2.price, target: neckline + patternHeight, breakoutClose: breakout.close },
        description: `Two troughs near ${p2.price.toFixed(2)} (${Math.abs(pctDiff(p0.price, p2.price)).toFixed(1)}% apart) with confirmed close above the ${neckline.toFixed(2)} neckline.`,
      });
    }
  }

  return matches;
}
