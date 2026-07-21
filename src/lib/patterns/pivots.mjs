// Fractal swing-point detection: bar i is a pivot high if its high is the
// strict max within [i-lookback, i+lookback], and a pivot low if its low is
// the strict min in that window. This is the foundation every chart pattern
// (double top/bottom, H&S, triangles, ...) gets expressed on top of as a
// sequence of pivots with scale-invariant price ratios -- never raw index or
// pixel positions.
export function findPivots(bars, lookback = 5) {
  const pivots = [];
  const n = bars.length;

  for (let i = lookback; i < n - lookback; i++) {
    const windowHighs = [];
    const windowLows = [];
    for (let j = i - lookback; j <= i + lookback; j++) {
      windowHighs.push(bars[j].high);
      windowLows.push(bars[j].low);
    }

    const isHigh = bars[i].high === Math.max(...windowHighs)
      && windowHighs.filter((h) => h === bars[i].high).length === 1;
    const isLow = bars[i].low === Math.min(...windowLows)
      && windowLows.filter((l) => l === bars[i].low).length === 1;

    if (isHigh) {
      pivots.push({ index: i, date: bars[i].date, type: 'high', price: bars[i].high });
    }
    if (isLow) {
      pivots.push({ index: i, date: bars[i].date, type: 'low', price: bars[i].low });
    }
  }

  return pivots.sort((a, b) => a.index - b.index);
}
