// Every detector here is confirmed on the *following* bar, never the signal
// bar itself: barIndex marks the bar whose shape completed the pattern, but
// no consumer (live signal, backtest) may act on it before bar[barIndex+1]'s
// open -- consistent with the pipeline's no-lookahead execution rule.
export { detectMarubozu } from './marubozu.mjs';
export { detectHammerShootingStar } from './hammerShootingStar.mjs';
export { detectDojiAtExtremes } from './dojiExtremes.mjs';
export { detectEngulfing } from './engulfing.mjs';
export { detectHarami } from './harami.mjs';
export { detectPiercingDarkCloud } from './piercingDarkCloud.mjs';
export { detectStar } from './star.mjs';
export { detectThreeSoldiersCrows } from './threeSoldiersCrows.mjs';

import { detectMarubozu } from './marubozu.mjs';
import { detectHammerShootingStar } from './hammerShootingStar.mjs';
import { detectDojiAtExtremes } from './dojiExtremes.mjs';
import { detectEngulfing } from './engulfing.mjs';
import { detectHarami } from './harami.mjs';
import { detectPiercingDarkCloud } from './piercingDarkCloud.mjs';
import { detectStar } from './star.mjs';
import { detectThreeSoldiersCrows } from './threeSoldiersCrows.mjs';

export function detectAllCandlestickPatterns(bars) {
  return [
    ...detectMarubozu(bars),
    ...detectHammerShootingStar(bars),
    ...detectDojiAtExtremes(bars),
    ...detectEngulfing(bars),
    ...detectHarami(bars),
    ...detectPiercingDarkCloud(bars),
    ...detectStar(bars),
    ...detectThreeSoldiersCrows(bars),
  ].sort((a, b) => a.barIndex - b.barIndex);
}
