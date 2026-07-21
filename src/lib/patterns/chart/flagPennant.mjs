import { pctDiff, findBreakout, volumeRatioAt, combineConfidence, clamp, withinTolerance } from './helpers.mjs';

const POLE_LENGTHS = [5, 8, 10, 15];
const POLE_MIN_MOVE_PCT = 8;
const CONSOL_LEN = 10;
const CONSOL_HALF = CONSOL_LEN / 2;
const PARALLEL_SLOPE_TOLERANCE_PCT = 3;
const WIDTH_RATIO_FLAG_MIN = 0.7;
const WIDTH_RATIO_FLAG_MAX = 1.3;
const WIDTH_RATIO_PENNANT_MAX = 0.6;

function average(values) { return values.reduce((a, b) => a + b, 0) / values.length; }

// Flags (parallel consolidation channel) and Pennants (converging, small
// symmetrical-triangle-like consolidation) both follow a sharp directional
// "flagpole" move -- they're continuation patterns, confirmed only when price
// breaks out of the consolidation in the pole's own direction.
export function detectFlagPennant(bars) {
  const matches = [];

  for (let i = Math.max(...POLE_LENGTHS); i + CONSOL_LEN < bars.length; i++) {
    let pole = null;
    for (const poleLen of POLE_LENGTHS) {
      const move = pctDiff(bars[i - poleLen].close, bars[i].close);
      if (Math.abs(move) >= POLE_MIN_MOVE_PCT) { pole = { len: poleLen, move }; break; }
    }
    if (!pole) continue;

    const consolBars = bars.slice(i + 1, i + 1 + CONSOL_LEN);
    const firstHalf = consolBars.slice(0, CONSOL_HALF);
    const secondHalf = consolBars.slice(CONSOL_HALF);
    const avgHighFirst = average(firstHalf.map((b) => b.high));
    const avgHighSecond = average(secondHalf.map((b) => b.high));
    const avgLowFirst = average(firstHalf.map((b) => b.low));
    const avgLowSecond = average(secondHalf.map((b) => b.low));
    const widthFirst = avgHighFirst - avgLowFirst;
    const widthSecond = avgHighSecond - avgLowSecond;
    if (widthFirst <= 0) continue;
    const widthRatio = widthSecond / widthFirst;

    const highsSlopePct = pctDiff(avgHighFirst, avgHighSecond);
    const lowsSlopePct = pctDiff(avgLowFirst, avgLowSecond);

    const isFlag = withinTolerance(highsSlopePct, lowsSlopePct, PARALLEL_SLOPE_TOLERANCE_PCT)
      && widthRatio >= WIDTH_RATIO_FLAG_MIN && widthRatio <= WIDTH_RATIO_FLAG_MAX;
    const isPennant = widthRatio <= WIDTH_RATIO_PENNANT_MAX;

    if (!isFlag && !isPennant) continue;

    const consolHigh = Math.max(...consolBars.map((b) => b.high));
    const consolLow = Math.min(...consolBars.map((b) => b.low));
    const consolEndIndex = i + CONSOL_LEN;
    const direction = pole.move > 0 ? 'bullish' : 'bearish';
    const breakout = pole.move > 0
      ? findBreakout(bars, consolEndIndex, consolHigh, 'above')
      : findBreakout(bars, consolEndIndex, consolLow, 'below');
    if (!breakout) continue;

    const poleHeight = Math.abs(bars[i].close - bars[i - pole.len].close);
    const target = direction === 'bullish' ? consolHigh + poleHeight : consolLow - poleHeight;
    const patternName = isFlag ? 'Flag' : 'Pennant';
    const geometricFit = isFlag
      ? (clamp(1 - Math.abs(highsSlopePct - lowsSlopePct) / PARALLEL_SLOPE_TOLERANCE_PCT, 0, 1)
        + clamp(1 - Math.abs(widthRatio - 1), 0, 1)) / 2
      : clamp(1 - widthRatio / WIDTH_RATIO_PENNANT_MAX, 0, 1);

    matches.push({
      pattern: patternName,
      direction,
      confidence: Math.round(combineConfidence({
        geometricFit,
        volumeConfirmation: volumeRatioAt(bars, breakout.index),
        breakoutStrength: poleHeight === 0 ? 0 : clamp(Math.abs(breakout.close - (direction === 'bullish' ? consolHigh : consolLow)) / poleHeight, 0, 1),
      })),
      barIndex: breakout.index,
      keyLevels: { poleStart: bars[i - pole.len].close, poleEnd: bars[i].close, consolHigh, consolLow, target },
      description: `${Math.abs(pole.move).toFixed(1)}% flagpole over ${pole.len} bars, ${CONSOL_LEN}-bar ${isFlag ? 'parallel channel' : 'converging'} consolidation, breaking out ${direction === 'bullish' ? 'above' : 'below'} at ${breakout.close.toFixed(2)}.`,
    });
  }

  return matches;
}
