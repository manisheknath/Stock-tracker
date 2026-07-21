import { withinTolerance, pctDiff, findBreakout, volumeRatioAt, combineConfidence, clamp } from './helpers.mjs';

const SHOULDER_TOLERANCE_PCT = 5;
const MIN_HEAD_PROMINENCE_PCT = 2;

export function detectHeadAndShoulders(bars, pivots) {
  const matches = [];

  for (let j = 0; j + 4 < pivots.length; j++) {
    const [p0, p1, p2, p3, p4] = pivots.slice(j, j + 5);

    if (p0.type === 'high' && p1.type === 'low' && p2.type === 'high' && p3.type === 'low' && p4.type === 'high') {
      const headAboveLeft = pctDiff(p0.price, p2.price);
      const headAboveRight = pctDiff(p4.price, p2.price);
      const shouldersMatch = withinTolerance(p0.price, p4.price, SHOULDER_TOLERANCE_PCT);

      if (headAboveLeft >= MIN_HEAD_PROMINENCE_PCT && headAboveRight >= MIN_HEAD_PROMINENCE_PCT && shouldersMatch) {
        const neckline = (p1.price + p3.price) / 2;
        const breakout = findBreakout(bars, p4.index, neckline, 'below');
        if (breakout) {
          const patternHeight = p2.price - neckline;
          const shoulderFit = clamp(1 - Math.abs(pctDiff(p0.price, p4.price)) / SHOULDER_TOLERANCE_PCT, 0, 1);
          const prominenceFit = clamp((Math.min(headAboveLeft, headAboveRight) - MIN_HEAD_PROMINENCE_PCT) / 10, 0, 1);
          matches.push({
            pattern: 'Head and Shoulders',
            direction: 'bearish',
            confidence: Math.round(combineConfidence({
              geometricFit: (shoulderFit + prominenceFit) / 2,
              volumeConfirmation: volumeRatioAt(bars, breakout.index),
              breakoutStrength: patternHeight === 0 ? 0 : clamp((neckline - breakout.close) / patternHeight, 0, 1),
            })),
            barIndex: breakout.index,
            keyLevels: { leftShoulder: p0.price, head: p2.price, rightShoulder: p4.price, neckline, target: neckline - patternHeight },
            description: `Head at ${p2.price.toFixed(2)} with shoulders near ${p0.price.toFixed(2)}/${p4.price.toFixed(2)}, confirmed close below the ${neckline.toFixed(2)} neckline.`,
          });
        }
      }
    }

    if (p0.type === 'low' && p1.type === 'high' && p2.type === 'low' && p3.type === 'high' && p4.type === 'low') {
      const headBelowLeft = pctDiff(p2.price, p0.price);
      const headBelowRight = pctDiff(p2.price, p4.price);
      const shouldersMatch = withinTolerance(p0.price, p4.price, SHOULDER_TOLERANCE_PCT);

      if (headBelowLeft >= MIN_HEAD_PROMINENCE_PCT && headBelowRight >= MIN_HEAD_PROMINENCE_PCT && shouldersMatch) {
        const neckline = (p1.price + p3.price) / 2;
        const breakout = findBreakout(bars, p4.index, neckline, 'above');
        if (breakout) {
          const patternHeight = neckline - p2.price;
          const shoulderFit = clamp(1 - Math.abs(pctDiff(p0.price, p4.price)) / SHOULDER_TOLERANCE_PCT, 0, 1);
          const prominenceFit = clamp((Math.min(headBelowLeft, headBelowRight) - MIN_HEAD_PROMINENCE_PCT) / 10, 0, 1);
          matches.push({
            pattern: 'Inverse Head and Shoulders',
            direction: 'bullish',
            confidence: Math.round(combineConfidence({
              geometricFit: (shoulderFit + prominenceFit) / 2,
              volumeConfirmation: volumeRatioAt(bars, breakout.index),
              breakoutStrength: patternHeight === 0 ? 0 : clamp((breakout.close - neckline) / patternHeight, 0, 1),
            })),
            barIndex: breakout.index,
            keyLevels: { leftShoulder: p0.price, head: p2.price, rightShoulder: p4.price, neckline, target: neckline + patternHeight },
            description: `Head at ${p2.price.toFixed(2)} with shoulders near ${p0.price.toFixed(2)}/${p4.price.toFixed(2)}, confirmed close above the ${neckline.toFixed(2)} neckline.`,
          });
        }
      }
    }
  }

  return matches;
}
