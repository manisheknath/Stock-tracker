import { closes, highs, lows, rollingHighest, rollingLowest, lastValid, strengthFromPct } from './helpers.mjs';

function midpointChannel(bars, period) {
  const highN = rollingHighest(highs(bars), period);
  const lowN = rollingLowest(lows(bars), period);
  return highN.map((h, i) => (h === null || lowN[i] === null ? null : (h + lowN[i]) / 2));
}

// senkouA/B are the cloud edges as computed at bar i -- classic Ichimoku plots
// them 26 bars *ahead*, so the cloud value applicable to bar i's own price is
// senkouA/B computed `displacement` bars earlier. Both series are returned;
// signal/strength use that lagged alignment.
export function computeIchimoku(bars, conversionPeriod = 9, basePeriod = 26, spanBPeriod = 52, displacement = 26) {
  const close = closes(bars);
  const tenkan = midpointChannel(bars, conversionPeriod);
  const kijun = midpointChannel(bars, basePeriod);
  const senkouA = tenkan.map((t, i) => (t === null || kijun[i] === null ? null : (t + kijun[i]) / 2));
  const senkouB = midpointChannel(bars, spanBPeriod);

  const values = close.map((_, i) => ({
    tenkan: tenkan[i],
    kijun: kijun[i],
    senkouA: senkouA[i],
    senkouB: senkouB[i],
  }));

  const n = close.length;
  const lastIdx = n - 1;
  const cloudIdx = lastIdx - displacement;
  const price = close[lastIdx];
  const cloudA = cloudIdx >= 0 ? senkouA[cloudIdx] : null;
  const cloudB = cloudIdx >= 0 ? senkouB[cloudIdx] : null;
  const t = tenkan[lastIdx];
  const k = kijun[lastIdx];

  if (price === undefined || cloudA === null || cloudB === null || t === null || k === null) {
    return { values, signal: 'neutral', strength: 0 };
  }

  const cloudTop = Math.max(cloudA, cloudB);
  const cloudBottom = Math.min(cloudA, cloudB);
  const aboveCloud = price > cloudTop;
  const belowCloud = price < cloudBottom;

  let signal = 'neutral';
  if (aboveCloud && t > k) signal = 'buy';
  else if (belowCloud && t < k) signal = 'sell';

  const refCloudEdge = aboveCloud ? cloudTop : belowCloud ? cloudBottom : (cloudTop + cloudBottom) / 2;
  const pctDist = ((price - refCloudEdge) / refCloudEdge) * 100;
  return { values, signal, strength: strengthFromPct(pctDist, 8) };
}
