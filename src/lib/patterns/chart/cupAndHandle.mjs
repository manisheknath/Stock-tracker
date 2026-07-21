import { withinTolerance, pctDiff, findBreakout, volumeRatioAt, combineConfidence, clamp } from './helpers.mjs';

const RIM_TOLERANCE_PCT = 5;
const MIN_CUP_DEPTH_PCT = 10;
const MAX_HANDLE_RETRACE = 0.5;

export function detectCupAndHandle(bars, pivots) {
  const matches = [];

  for (let j = 0; j + 3 < pivots.length; j++) {
    const [h0, l0, h1, l1] = pivots.slice(j, j + 4);
    if (h0.type !== 'high' || l0.type !== 'low' || h1.type !== 'high' || l1.type !== 'low') continue;
    if (!withinTolerance(h0.price, h1.price, RIM_TOLERANCE_PCT)) continue;

    const depthPct = Math.abs(pctDiff(h0.price, l0.price));
    if (depthPct < MIN_CUP_DEPTH_PCT) continue;
    if (l1.price <= l0.price) continue; // handle must not undercut the cup low

    const cupDepth = h1.price - l0.price;
    const handleRetrace = cupDepth === 0 ? 1 : (h1.price - l1.price) / cupDepth;
    if (handleRetrace > MAX_HANDLE_RETRACE) continue;

    const rim = Math.max(h0.price, h1.price);
    const breakout = findBreakout(bars, l1.index, rim, 'above');
    if (!breakout) continue;

    const rimFit = clamp(1 - Math.abs(pctDiff(h0.price, h1.price)) / RIM_TOLERANCE_PCT, 0, 1);
    const depthFit = clamp((depthPct - MIN_CUP_DEPTH_PCT) / 20, 0, 1);
    const handleFit = clamp(1 - handleRetrace / MAX_HANDLE_RETRACE, 0, 1);
    const target = rim + cupDepth;

    matches.push({
      pattern: 'Cup and Handle',
      direction: 'bullish',
      confidence: Math.round(combineConfidence({
        geometricFit: (rimFit + depthFit + handleFit) / 3,
        volumeConfirmation: volumeRatioAt(bars, breakout.index),
        breakoutStrength: clamp((breakout.close - rim) / cupDepth, 0, 1),
      })),
      barIndex: breakout.index,
      keyLevels: { leftRim: h0.price, cupLow: l0.price, rightRim: h1.price, handleLow: l1.price, target },
      description: `${depthPct.toFixed(0)}% deep cup between rims near ${rim.toFixed(2)}, shallow handle retracing ${(handleRetrace * 100).toFixed(0)}% of cup depth, confirmed breakout above the rim.`,
    });
  }

  return matches;
}
