import { test, assert, run } from '../indicators/testHarness.mjs';
import { findPivots } from './pivots.mjs';
import { alternatingPivots } from './chart/helpers.mjs';
import { detectDoubleTopBottom } from './chart/doubleTopBottom.mjs';
import { detectHeadAndShoulders } from './chart/headAndShoulders.mjs';
import { detectTriangles } from './chart/triangles.mjs';
import { detectCupAndHandle } from './chart/cupAndHandle.mjs';
import { detectFlagPennant } from './chart/flagPennant.mjs';
import { detectWedges } from './chart/wedges.mjs';
import { detectRectangle } from './chart/rectangle.mjs';

function flatBars(values, volumes) {
  return values.map((v, i) => ({
    date: `d${i}`, open: v, close: v, high: v, low: v, volume: volumes ? volumes[i] : 1000,
  }));
}

function pivotsOf(bars, lookback = 2) {
  return alternatingPivots(findPivots(bars, lookback));
}

// --- Double Top / Bottom ------------------------------------------------------

test('Double Top: two equal peaks, confirmed break below the neckline', () => {
  const values = [100, 105, 110, 105, 100, 105, 110, 105, 100, 95, 90, 85];
  const bars = flatBars(values);
  const result = detectDoubleTopBottom(bars, pivotsOf(bars));
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Double Top');
  assert.equal(result[0].direction, 'bearish');
  assert.equal(result[0].barIndex, 9);
});

test('Double Bottom: two equal troughs, confirmed break above the neckline', () => {
  const values = [100, 95, 90, 95, 100, 95, 90, 95, 100, 105, 110, 115];
  const bars = flatBars(values);
  const result = detectDoubleTopBottom(bars, pivotsOf(bars));
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Double Bottom');
  assert.equal(result[0].direction, 'bullish');
  assert.equal(result[0].barIndex, 9);
});

// --- Head & Shoulders ----------------------------------------------------------

test('Head and Shoulders: taller head, matching shoulders, confirmed neckline break', () => {
  const values = [
    80, 85, 90, 95, 100, 95, 90, 85, 80, 90, 100, 110, 120, 110, 100, 90, 80,
    85, 90, 95, 100, 90, 80, 70, 60,
  ];
  const bars = flatBars(values);
  const result = detectHeadAndShoulders(bars, pivotsOf(bars));
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Head and Shoulders');
  assert.equal(result[0].direction, 'bearish');
  assert.equal(result[0].barIndex, 23);
});

test('Inverse Head and Shoulders: deeper head, matching shoulders, confirmed neckline break', () => {
  const values = [
    120, 115, 110, 105, 100, 105, 110, 115, 120, 110, 100, 90, 80, 90, 100, 110, 120,
    115, 110, 105, 100, 110, 120, 130, 140,
  ];
  const bars = flatBars(values);
  const result = detectHeadAndShoulders(bars, pivotsOf(bars));
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Inverse Head and Shoulders');
  assert.equal(result[0].direction, 'bullish');
  assert.equal(result[0].barIndex, 23);
});

// --- Triangles ------------------------------------------------------------------

test('Ascending Triangle: flat resistance, rising support, confirmed upside breakout', () => {
  const values = [
    100, 105, 108, 109, 110, 105, 100, 97, 95, 100, 105, 108, 110,
    107, 104, 101, 100, 103, 106, 109, 112,
  ];
  const bars = flatBars(values);
  const result = detectTriangles(bars, pivotsOf(bars));
  const match = result.find((r) => r.pattern === 'Ascending Triangle');
  assert.ok(match, 'expected an Ascending Triangle match');
  assert.equal(match.direction, 'bullish');
});

test('Descending Triangle: falling resistance, flat support, confirmed downside breakout', () => {
  const values = [
    100, 104, 107, 109, 110, 106, 102, 98, 95, 97, 99, 99.5, 100,
    98, 97, 96, 95, 95.5, 96, 90, 85,
  ];
  const bars = flatBars(values);
  const result = detectTriangles(bars, pivotsOf(bars));
  const match = result.find((r) => r.pattern === 'Descending Triangle');
  assert.ok(match, 'expected a Descending Triangle match');
  assert.equal(match.direction, 'bearish');
});

test('Symmetrical Triangle: converging highs/lows, confirmed breakout', () => {
  const values = [
    100, 104, 107, 109, 110, 104, 98, 93, 90, 93, 96, 98, 100,
    98, 96.5, 95.5, 95, 97, 99, 102, 105,
  ];
  const bars = flatBars(values);
  const result = detectTriangles(bars, pivotsOf(bars));
  const match = result.find((r) => r.pattern === 'Symmetrical Triangle');
  assert.ok(match, 'expected a Symmetrical Triangle match');
  assert.equal(match.direction, 'bullish');
});

// --- Wedges --------------------------------------------------------------------

test('Rising Wedge: both trendlines rising but converging, confirmed breakdown', () => {
  const values = [
    90, 95, 98, 99, 100, 96, 93, 91, 90, 95, 100, 105, 108,
    106, 104, 103, 102, 103, 104, 97, 90,
  ];
  const bars = flatBars(values);
  const result = detectWedges(bars, pivotsOf(bars));
  const match = result.find((r) => r.pattern === 'Rising Wedge');
  assert.ok(match, 'expected a Rising Wedge match');
  assert.equal(match.direction, 'bearish');
});

test('Falling Wedge: both trendlines falling but converging, confirmed breakout', () => {
  const values = [
    100, 105, 108, 109, 110, 106, 103, 101, 100, 100.5, 101, 101.5, 102,
    100, 99, 98, 97, 98, 99, 103, 110,
  ];
  const bars = flatBars(values);
  const result = detectWedges(bars, pivotsOf(bars));
  const match = result.find((r) => r.pattern === 'Falling Wedge');
  assert.ok(match, 'expected a Falling Wedge match');
  assert.equal(match.direction, 'bullish');
});

// --- Cup and Handle --------------------------------------------------------------

test('Cup and Handle: rounded cup, shallow handle, confirmed breakout above the rim', () => {
  const values = [
    90, 95, 98, 99, 100, 95, 90, 86, 83, 88, 93, 97, 100,
    97, 94, 93, 92, 95, 98, 101, 105,
  ];
  const bars = flatBars(values);
  const result = detectCupAndHandle(bars, pivotsOf(bars));
  assert.equal(result.length, 1);
  assert.equal(result[0].pattern, 'Cup and Handle');
  assert.equal(result[0].direction, 'bullish');
  assert.equal(result[0].barIndex, 19);
});

// --- Flag / Pennant ---------------------------------------------------------------

function poleThenConsolidation(consolShape) {
  const bars = [];
  for (let i = 0; i < 15; i++) bars.push({ close: 100 });
  for (let k = 1; k <= 5; k++) bars.push({ close: 100 + 2 * k }); // pole: 100 -> 110
  for (let k = 0; k < 10; k++) {
    const { high, low } = consolShape(k);
    bars.push({ high, low, close: (high + low) / 2 });
  }
  bars.push({ close: bars[bars.length - 1].close, high: bars[bars.length - 1].high, low: bars[bars.length - 1].low });
  bars.push({ close: 112, high: 112, low: 112 });
  bars.push({ close: 113, high: 113, low: 113 });
  return bars.map((b, i) => ({ date: `d${i}`, open: b.close, close: b.close, high: b.high ?? b.close, low: b.low ?? b.close, volume: 1000 }));
}

test('Flag: parallel consolidation channel after a flagpole, confirmed continuation breakout', () => {
  const bars = poleThenConsolidation((k) => ({ high: 110 - 0.35 * k, low: 110 - 0.35 * k - 3 }));
  const result = detectFlagPennant(bars);
  const match = result.find((r) => r.pattern === 'Flag');
  assert.ok(match, 'expected a Flag match');
  assert.equal(match.direction, 'bullish');
});

test('Pennant: converging consolidation after a flagpole, confirmed continuation breakout', () => {
  const bars = poleThenConsolidation((k) => ({ high: 110 - 0.2 * k, low: 110 - 0.2 * k - (4 - 0.35 * k) }));
  const result = detectFlagPennant(bars);
  const match = result.find((r) => r.pattern === 'Pennant');
  assert.ok(match, 'expected a Pennant match');
  assert.equal(match.direction, 'bullish');
});

// --- Rectangle -------------------------------------------------------------------

test('Rectangle: flat resistance and support, confirmed breakout', () => {
  const values = [
    100, 105, 108, 109, 110, 105, 100, 97, 95, 100, 105, 108, 110,
    105, 100, 97, 95, 100, 105, 110, 115,
  ];
  const bars = flatBars(values);
  const result = detectRectangle(bars, pivotsOf(bars));
  assert.ok(result.length >= 1);
  assert.equal(result[0].pattern, 'Rectangle');
});

run();
