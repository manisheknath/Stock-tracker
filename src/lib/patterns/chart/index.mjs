import { findPivots } from '../pivots.mjs';
import { alternatingPivots } from './helpers.mjs';
import { detectDoubleTopBottom } from './doubleTopBottom.mjs';
import { detectHeadAndShoulders } from './headAndShoulders.mjs';
import { detectTriangles } from './triangles.mjs';
import { detectCupAndHandle } from './cupAndHandle.mjs';
import { detectFlagPennant } from './flagPennant.mjs';
import { detectWedges } from './wedges.mjs';
import { detectRectangle } from './rectangle.mjs';

export { detectDoubleTopBottom } from './doubleTopBottom.mjs';
export { detectHeadAndShoulders } from './headAndShoulders.mjs';
export { detectTriangles } from './triangles.mjs';
export { detectCupAndHandle } from './cupAndHandle.mjs';
export { detectFlagPennant } from './flagPennant.mjs';
export { detectWedges } from './wedges.mjs';
export { detectRectangle } from './rectangle.mjs';

// barIndex marks the confirmed breakout bar; per the pipeline's no-lookahead
// rule, no consumer may act before bar[barIndex+1]'s open.
export function detectAllChartPatterns(bars, lookback = 5) {
  const pivots = alternatingPivots(findPivots(bars, lookback));
  return [
    ...detectDoubleTopBottom(bars, pivots),
    ...detectHeadAndShoulders(bars, pivots),
    ...detectTriangles(bars, pivots),
    ...detectCupAndHandle(bars, pivots),
    ...detectFlagPennant(bars),
    ...detectWedges(bars, pivots),
    ...detectRectangle(bars, pivots),
  ].sort((a, b) => a.barIndex - b.barIndex);
}
