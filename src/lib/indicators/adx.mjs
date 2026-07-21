import { highs, lows, trueRange, wilderRMA, lastValid, clamp } from './helpers.mjs';

export function computeADX(bars, period = 14) {
  const high = highs(bars);
  const low = lows(bars);
  const tr = trueRange(bars);

  const plusDM = new Array(bars.length).fill(0);
  const minusDM = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    const upMove = high[i] - high[i - 1];
    const downMove = low[i - 1] - low[i];
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  const smoothedTR = wilderRMA(tr, period);
  const smoothedPlusDM = wilderRMA(plusDM, period);
  const smoothedMinusDM = wilderRMA(minusDM, period);

  const plusDI = smoothedTR.map((t, i) => (t === null || t === 0 ? null : (100 * smoothedPlusDM[i]) / t));
  const minusDI = smoothedTR.map((t, i) => (t === null || t === 0 ? null : (100 * smoothedMinusDM[i]) / t));

  const dx = plusDI.map((p, i) => {
    if (p === null || minusDI[i] === null || p + minusDI[i] === 0) return null;
    return (100 * Math.abs(p - minusDI[i])) / (p + minusDI[i]);
  });

  const firstDxValid = dx.findIndex((v) => v !== null);
  const adxTrimmed = firstDxValid === -1 ? [] : wilderRMA(dx.slice(firstDxValid), period);
  const adxSeries = firstDxValid === -1
    ? new Array(bars.length).fill(null)
    : new Array(firstDxValid).fill(null).concat(adxTrimmed);

  const values = adxSeries.map((adx, i) => ({ adx, plusDI: plusDI[i], minusDI: minusDI[i] }));

  const adx = lastValid(adxSeries);
  const pDI = lastValid(plusDI);
  const mDI = lastValid(minusDI);
  if (adx === null || pDI === null || mDI === null) {
    return { values, signal: 'neutral', strength: 0 };
  }

  const trending = adx >= 20;
  const signal = trending ? (pDI > mDI ? 'buy' : pDI < mDI ? 'sell' : 'neutral') : 'neutral';
  return { values, signal, strength: clamp(adx, 0, 100) };
}
