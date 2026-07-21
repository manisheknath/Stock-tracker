import { test, assert, run } from '../indicators/testHarness.mjs';
import { findPivots } from './pivots.mjs';
import { detectMarubozu } from './candlestick/marubozu.mjs';
import { detectHammerShootingStar } from './candlestick/hammerShootingStar.mjs';
import { detectDojiAtExtremes } from './candlestick/dojiExtremes.mjs';
import { detectEngulfing } from './candlestick/engulfing.mjs';
import { detectHarami } from './candlestick/harami.mjs';
import { detectPiercingDarkCloud } from './candlestick/piercingDarkCloud.mjs';
import { detectStar } from './candlestick/star.mjs';
import { detectThreeSoldiersCrows } from './candlestick/threeSoldiersCrows.mjs';

function filler(n, price = 50) {
  return Array.from({ length: n }, (_, i) => ({
    date: `f${i}`, open: price, high: price, low: price, close: price, volume: 1000,
  }));
}

function bar({ open, close, high, low, volume = 1000 }, date = 'd') {
  return { date, open, close, high, low, volume };
}

// --- pivots ------------------------------------------------------------------

test('findPivots: detects a single unique pivot high, ignores non-extreme bars', () => {
  const highs = [10, 11, 12, 13, 12, 11, 10];
  const bars = highs.map((h) => ({ date: 'd', open: h - 5, close: h - 5, high: h, low: h - 5 }));
  const pivots = findPivots(bars, 2);
  assert.equal(pivots.length, 1);
  assert.equal(pivots[0].type, 'high');
  assert.equal(pivots[0].index, 3);
  assert.equal(pivots[0].price, 13);
});

test('findPivots: detects a single unique pivot low', () => {
  const lows = [10, 9, 8, 7, 8, 9, 10];
  const bars = lows.map((l) => ({ date: 'd', open: l + 5, close: l + 5, high: l + 5, low: l }));
  const pivots = findPivots(bars, 2);
  assert.equal(pivots.length, 1);
  assert.equal(pivots[0].type, 'low');
  assert.equal(pivots[0].index, 3);
  assert.equal(pivots[0].price, 7);
});

// --- marubozu ------------------------------------------------------------------

test('Marubozu: full body + negligible wicks detected; large-wick candle rejected', () => {
  const bullish = bar({ open: 100, close: 110, high: 110.2, low: 99.8 });
  const bearish = bar({ open: 110, close: 100, high: 110.2, low: 99.8 });
  const notMarubozu = bar({ open: 100, close: 102, high: 110, low: 90 });

  assert.equal(detectMarubozu([bullish])[0].direction, 'bullish');
  assert.equal(detectMarubozu([bearish])[0].direction, 'bearish');
  assert.equal(detectMarubozu([notMarubozu]).length, 0);
});

// --- hammer / shooting star ------------------------------------------------------

test('Hammer: small body + long lower shadow after a downtrend', () => {
  const decline = [100, 98, 96, 94, 92].map((c) => bar({ open: c + 1, close: c, high: c + 1, low: c - 1 }));
  const hammer = bar({ open: 91.8, close: 92, high: 92.2, low: 88 });
  const result = detectHammerShootingStar([...decline, hammer]);
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Hammer');
  assert.equal(result[0].direction, 'bullish');
  assert.equal(result[0].barIndex, decline.length);
});

test('Shooting Star: small body + long upper shadow after an uptrend', () => {
  const rally = [92, 94, 96, 98, 100].map((c) => bar({ open: c - 1, close: c, high: c + 1, low: c - 1 }));
  const star = bar({ open: 100.2, close: 100, high: 104, low: 99.8 });
  const result = detectHammerShootingStar([...rally, star]);
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Shooting Star');
  assert.equal(result[0].direction, 'bearish');
});

// --- doji at extremes ------------------------------------------------------------

test('Doji at extreme: tiny body at a fresh N-bar high is flagged bearish', () => {
  const rising = Array.from({ length: 9 }, (_, i) => bar({ open: 110 + i, close: 110 + i, high: 110 + i, low: 109 + i }));
  const doji = bar({ open: 118, close: 118.05, high: 120, low: 115 });
  const result = detectDojiAtExtremes([...rising, doji]);
  assert.equal(result.length, 1);
  assert.equal(result[0].direction, 'bearish');
  assert.equal(result[0].barIndex, 9);
});

// --- engulfing ---------------------------------------------------------------

test('Bullish/Bearish Engulfing: larger opposite-direction body containing the prior', () => {
  const pad = filler(6);
  const bullishPrev = bar({ open: 100, close: 95 });
  const bullishCurr = bar({ open: 94, close: 101 });
  const bullResult = detectEngulfing([...pad, bullishPrev, bullishCurr]);
  assert.equal(bullResult.length, 1);
  assert.equal(bullResult[0].pattern, 'Bullish Engulfing');

  const bearPrev = bar({ open: 95, close: 100 });
  const bearCurr = bar({ open: 101, close: 94 });
  const bearResult = detectEngulfing([...pad, bearPrev, bearCurr]);
  assert.equal(bearResult.length, 1);
  assert.equal(bearResult[0].pattern, 'Bearish Engulfing');
});

// --- harami --------------------------------------------------------------------

test('Bullish/Bearish Harami: small body contained within the prior large body', () => {
  const pad = filler(6);
  const bearPrev = bar({ open: 100, close: 90 });
  const smallInside1 = bar({ open: 93, close: 95 });
  const bullResult = detectHarami([...pad, bearPrev, smallInside1]);
  assert.equal(bullResult.length, 1);
  assert.equal(bullResult[0].pattern, 'Bullish Harami');

  const bullPrev = bar({ open: 90, close: 100 });
  const smallInside2 = bar({ open: 97, close: 95 });
  const bearResult = detectHarami([...pad, bullPrev, smallInside2]);
  assert.equal(bearResult.length, 1);
  assert.equal(bearResult[0].pattern, 'Bearish Harami');
});

// --- piercing / dark cloud -----------------------------------------------------

test('Piercing: gap-down open recovering past the prior bearish body midpoint', () => {
  const pad = filler(6);
  const prev = bar({ open: 100, close: 90, high: 101, low: 89 });
  const curr = bar({ open: 88, close: 96, high: 96.5, low: 87.5 }); // opens below prior low, closes above midpoint(95? mid=(100+90)/2=95) -> use 96>95
  const result = detectPiercingDarkCloud([...pad, prev, curr]);
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Piercing');
});

test('Dark Cloud Cover: gap-up open falling past the prior bullish body midpoint', () => {
  const pad = filler(6);
  const prev = bar({ open: 90, close: 100, high: 101, low: 89 });
  const curr = bar({ open: 102, close: 94, high: 102.5, low: 93.5 }); // opens above prior high, closes below midpoint(95)
  const result = detectPiercingDarkCloud([...pad, prev, curr]);
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Dark Cloud Cover');
});

// --- morning / evening star -----------------------------------------------------

test('Morning Star: long bearish, gapped-down star, bullish close back into first body', () => {
  const pad = filler(5);
  const c1 = bar({ open: 100, close: 80, high: 101, low: 79 });
  const c2 = bar({ open: 76.5, close: 77.5, high: 79, low: 75 }); // small star body [76.5,77.5], below c1.close(80)
  const c3 = bar({ open: 79, close: 95, high: 96, low: 78 }); // closes above midpoint (90)
  const result = detectStar([...pad, c1, c2, c3]);
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Morning Star');
});

test('Evening Star: long bullish, gapped-up star, bearish close back into first body', () => {
  const pad = filler(5);
  const c1 = bar({ open: 80, close: 100, high: 101, low: 79 });
  const c2 = bar({ open: 102.5, close: 103.5, high: 105, low: 101 }); // small star body above c1.close(100)
  const c3 = bar({ open: 101, close: 85, high: 102, low: 84 }); // closes below midpoint (90)
  const result = detectStar([...pad, c1, c2, c3]);
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Evening Star');
});

// --- three soldiers / crows -------------------------------------------------------

test('Three White Soldiers / Three Black Crows: three consecutive strong same-direction bodies', () => {
  const soldiers = [
    bar({ open: 100, close: 106, high: 106.5, low: 99.5 }),
    bar({ open: 102, close: 112, high: 112.5, low: 101.5 }),
    bar({ open: 108, close: 118, high: 118.5, low: 107.5 }),
  ];
  const soldierResult = detectThreeSoldiersCrows(soldiers);
  assert.equal(soldierResult.length, 1);
  assert.equal(soldierResult[0].pattern, 'Three White Soldiers');

  const crows = [
    bar({ open: 118, close: 108 }),
    bar({ open: 112, close: 102 }),
    bar({ open: 106, close: 96 }),
  ].map((b) => ({ ...b, high: b.open + 0.5, low: b.close - 0.5 }));
  const crowResult = detectThreeSoldiersCrows(crows);
  assert.equal(crowResult.length, 1);
  assert.equal(crowResult[0].pattern, 'Three Black Crows');
});

run();
