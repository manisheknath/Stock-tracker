// Shared toolkit every chart-pattern detector builds on: clean alternating
// pivot sequences, percentage-based (scale-invariant) comparisons, and a
// forward scan for the breakout/confirmation bar. Nothing here works in raw
// index or pixel space.

// Collapses consecutive same-type pivots down to the single most extreme one,
// so the sequence always alternates high/low/high/low.
export function alternatingPivots(pivots) {
  const out = [];
  for (const p of pivots) {
    const last = out[out.length - 1];
    if (!last || last.type !== p.type) {
      out.push(p);
    } else if (p.type === 'high' && p.price > last.price) {
      out[out.length - 1] = p;
    } else if (p.type === 'low' && p.price < last.price) {
      out[out.length - 1] = p;
    }
  }
  return out;
}

export function pctDiff(from, to) {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

export function withinTolerance(a, b, tolerancePct) {
  return Math.abs(pctDiff(a, b)) <= tolerancePct;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Scans forward from `fromIndex` (exclusive) for the first bar whose close
// crosses `level` in the given direction. Returns null if no breakout occurs
// within the available bars -- an unconfirmed pattern is not reported.
export function findBreakout(bars, fromIndex, level, direction) {
  for (let i = fromIndex + 1; i < bars.length; i++) {
    if (direction === 'above' && bars[i].close > level) {
      return { index: i, date: bars[i].date, close: bars[i].close };
    }
    if (direction === 'below' && bars[i].close < level) {
      return { index: i, date: bars[i].date, close: bars[i].close };
    }
  }
  return null;
}

// Like findBreakout, but for patterns where either boundary could break first
// (triangles, wedges, rectangles) -- returns whichever crosses earliest.
export function findBreakoutEither(bars, fromIndex, upperLevel, lowerLevel) {
  for (let i = fromIndex + 1; i < bars.length; i++) {
    if (bars[i].close > upperLevel) return { index: i, date: bars[i].date, close: bars[i].close, direction: 'above' };
    if (bars[i].close < lowerLevel) return { index: i, date: bars[i].date, close: bars[i].close, direction: 'below' };
  }
  return null;
}

export function volumeRatioAt(bars, i, window = 20) {
  const start = Math.max(0, i - window);
  if (start >= i || !bars[i].volume) return 1;
  let sum = 0;
  let count = 0;
  for (let j = start; j < i; j++) {
    if (bars[j].volume) { sum += bars[j].volume; count++; }
  }
  if (count === 0 || sum === 0) return 1;
  return bars[i].volume / (sum / count);
}

// Same weighting scheme as candlestick patterns: geometric fit + volume +
// (here) breakout strength, in place of trend alignment.
export function combineConfidence({ geometricFit, volumeConfirmation = 1, breakoutStrength = 1 }) {
  const volFactor = clamp(0.85 + 0.15 * clamp(volumeConfirmation, 0, 2) / 2, 0.85, 1.0);
  const breakoutFactor = clamp(0.85 + 0.15 * clamp(breakoutStrength, 0, 1), 0.85, 1.0);
  return clamp(geometricFit * 100 * volFactor * breakoutFactor, 0, 100);
}
