import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test, assert, closeTo, run } from './testHarness.mjs';
import { sma, ema, wilderRMA, stdev, trueRange, rollingHighest, rollingLowest } from './helpers.mjs';
import { computeSMA, computeEMA } from './movingAverage.mjs';
import { computeRSI } from './rsi.mjs';
import { computeMACD } from './macd.mjs';
import { computeBollinger } from './bollinger.mjs';
import { computeATR } from './atr.mjs';
import { computeStochastic } from './stochastic.mjs';
import { computeCCI } from './cci.mjs';
import { computeROC } from './roc.mjs';
import { computeWilliamsR } from './williamsR.mjs';
import { computeMFI } from './mfi.mjs';
import { computeOBV } from './obv.mjs';
import { computeVWAP } from './vwap.mjs';
import { computeADX } from './adx.mjs';
import { computeSupertrend } from './supertrend.mjs';
import { computeKeltner } from './keltner.mjs';
import { computeIchimoku } from './ichimoku.mjs';
import { computeFiftyTwoWeek } from './fiftyTwoWeek.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function mkBars(closes, { highs, lows, volumes } = {}) {
  return closes.map((c, i) => ({
    date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    open: c,
    high: highs ? highs[i] : c,
    low: lows ? lows[i] : c,
    close: c,
    volume: volumes ? volumes[i] : 1,
  }));
}

// --- core helpers -----------------------------------------------------------

test('sma: rolling average with correct warm-up nulls', () => {
  assert.deepEqual(sma([1, 2, 3], 3), [null, null, 2]);
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test('ema: seeded with SMA, then recursive multiplier', () => {
  const result = ema([1, 2, 3, 4, 5], 3);
  assert.equal(result[0], null);
  assert.equal(result[1], null);
  closeTo(result[2], 2);
  closeTo(result[3], 3);
  closeTo(result[4], 4);
});

test('wilderRMA: seeded with SMA(period), then alpha=1/period recursion', () => {
  const result = wilderRMA([0, 0, 0, 0, 0, 10, 10, 10, 10, 10], 5);
  closeTo(result[4], 0);
  closeTo(result[5], 2);
  closeTo(result[6], 3.6);
  closeTo(result[7], 4.88);
  closeTo(result[8], 5.904);
  closeTo(result[9], 6.7232);
});

test('stdev: classic population-stdev textbook example (mean=5, stdev=2)', () => {
  const result = stdev([2, 4, 4, 4, 5, 5, 7, 9], 8);
  closeTo(result[7], 2);
});

test('trueRange: matches max(H-L, |H-prevC|, |L-prevC|)', () => {
  const bars = [
    { high: 10, low: 8, close: 9 },
    { high: 11, low: 9, close: 10 },
    { high: 9, low: 7, close: 8 },
  ];
  assert.deepEqual(trueRange(bars), [2, 2, 3]);
});

test('rollingHighest/rollingLowest: correct windowed extrema', () => {
  const values = [1, 3, 2, 5, 4];
  assert.deepEqual(rollingHighest(values, 3), [null, null, 3, 5, 5]);
  assert.deepEqual(rollingLowest(values, 3), [null, null, 1, 2, 2]);
});

// --- indicators --------------------------------------------------------------

test('SMA/EMA indicator: signal follows price vs MA', () => {
  const bars = mkBars([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = computeSMA(bars, 3);
  closeTo(r.values[9], 9); // avg(8,9,10)
  assert.equal(r.signal, 'buy'); // price 10 > MA 9
});

test('RSI: all-gains series saturates at 100, all-losses at 0', () => {
  const up = mkBars(Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(computeRSI(up, 14).signal, 'sell'); // RSI=100 -> overbought
  closeTo(computeRSI(up, 14).values.at(-1), 100);

  const down = mkBars(Array.from({ length: 20 }, (_, i) => 20 - i));
  assert.equal(computeRSI(down, 14).signal, 'buy'); // RSI=0 -> oversold
  closeTo(computeRSI(down, 14).values.at(-1), 0);
});

test('MACD: sustained uptrend/downtrend produce matching histogram sign', () => {
  // A linear ramp converges MACD to a flat histogram (MACD reflects trend
  // *acceleration*, not just direction) -- use a quadratic profile so the
  // fast/slow EMA gap keeps widening in one direction.
  const n = 60;
  const up = mkBars(Array.from({ length: n }, (_, i) => 100 + 0.05 * i * i));
  assert.equal(computeMACD(up).signal, 'buy');
  assert.ok(computeMACD(up).values.at(-1).histogram > 0);

  const down = mkBars(Array.from({ length: n }, (_, i) => 300 - 0.05 * i * i));
  assert.equal(computeMACD(down).signal, 'sell');
  assert.ok(computeMACD(down).values.at(-1).histogram < 0);
});

test('Bollinger: classic stdev dataset (mean=5, stdev=2) gives bands [1,9]', () => {
  const bars = mkBars([2, 4, 4, 4, 5, 5, 7, 9]);
  const r = computeBollinger(bars, 8, 2);
  closeTo(r.values.at(-1).middle, 5);
  closeTo(r.values.at(-1).upper, 9);
  closeTo(r.values.at(-1).lower, 1);
  assert.equal(r.signal, 'sell'); // close (9) touches upper band
  closeTo(r.strength, 100);
});

test('ATR: matches Wilder-smoothed true range', () => {
  const bars = [
    { high: 10, low: 8, close: 9, volume: 1 },
    { high: 11, low: 9, close: 10, volume: 1 },
    { high: 9, low: 7, close: 8, volume: 1 },
  ];
  const r = computeATR(bars, 3);
  closeTo(r.values[2], (2 + 2 + 3) / 3);
});

test('Stochastic: %K reflects position within the rolling high/low range', () => {
  const bars = mkBars([10, 20, 30], { highs: [10, 20, 30], lows: [10, 20, 30] });
  const r = computeStochastic(bars, 3, 1, 1);
  closeTo(r.values.at(-1).k, 100); // close == rolling high
});

test('CCI: hand-computed against a small crafted series', () => {
  const bars = mkBars([10, 12, 11, 13, 15], { highs: [10, 12, 11, 13, 15], lows: [10, 12, 11, 13, 15] });
  const r = computeCCI(bars, 5);
  closeTo(r.values.at(-1), (15 - 12.2) / (0.015 * 1.44), 1e-3);
  assert.equal(r.signal, 'sell');
});

test('ROC: 12% gain over 12 periods reads exactly 12', () => {
  const bars = mkBars(Array.from({ length: 13 }, (_, i) => 100 + i));
  const r = computeROC(bars, 12);
  closeTo(r.values.at(-1), 12);
  assert.equal(r.signal, 'buy');
});

test('Williams %R: matches (highN-close)/(highN-lowN) * -100', () => {
  const values = [1, 3, 2, 5, 4];
  const bars = mkBars(values, { highs: values, lows: values });
  const r = computeWilliamsR(bars, 3);
  closeTo(r.values.at(-1), ((5 - 4) / (5 - 2)) * -100);
});

test('MFI: strictly rising typical price with volume saturates at 100', () => {
  const values = [1, 2, 3, 4, 5];
  const bars = mkBars(values, { highs: values, lows: values, volumes: [10, 10, 10, 10, 10] });
  const r = computeMFI(bars, 4);
  closeTo(r.values.at(-1), 100);
  assert.equal(r.signal, 'sell');
});

test('OBV: cumulative up/down/flat volume matches by hand', () => {
  const bars = mkBars([10, 11, 10, 12, 12], { volumes: [100, 200, 150, 300, 50] });
  const r = computeOBV(bars, 20);
  assert.deepEqual(r.values, [100, 300, 150, 450, 450]);
});

test('VWAP: rolling volume-weighted average matches hand calc', () => {
  const values = [10, 20, 30];
  const bars = mkBars(values, { highs: values, lows: values, volumes: [1, 1, 1] });
  const r = computeVWAP(bars, 3);
  closeTo(r.values.at(-1), 20);
  assert.equal(r.signal, 'buy');
});

test('ADX: a clean persistent uptrend eventually reads trending + buy', () => {
  const n = 60;
  const highs = Array.from({ length: n }, (_, i) => 100 + i);
  const lows = Array.from({ length: n }, (_, i) => 98 + i);
  const closes = Array.from({ length: n }, (_, i) => 99 + i);
  const bars = mkBars(closes, { highs, lows });
  const r = computeADX(bars, 14);
  assert.equal(r.signal, 'buy');
  assert.ok(r.strength >= 20);
});

test('Supertrend: flips direction after a sharp reversal', () => {
  // Intrabar range must be small relative to the daily close-to-close move,
  // or ATR inflates the bands so far that price never crosses them.
  const rising = Array.from({ length: 20 }, (_, i) => ({ high: 101 + i, low: 99 + i, close: 100 + i }));
  const drop = Array.from({ length: 10 }, (_, i) => ({ high: 122 - i * 6, low: 118 - i * 6, close: 120 - i * 6 }));
  const bars = [...rising, ...drop].map((b, i) => ({ ...b, date: `d${i}`, volume: 1 }));
  const r = computeSupertrend(bars, 10, 3);
  const directions = r.values.map((v) => v.direction);
  assert.ok(directions.slice(0, 20).includes('up'));
  assert.equal(directions.at(-1), 'down');
});

test('Keltner: %K-style position between EMA+/-ATR bands', () => {
  const bars = mkBars([2, 4, 4, 4, 5, 5, 7, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]);
  const r = computeKeltner(bars, 20, 10, 2);
  assert.ok(['buy', 'sell', 'neutral'].includes(r.signal));
  assert.ok(r.values.at(-1).upper > r.values.at(-1).lower);
});

test('Ichimoku: tenkan/kijun midpoints and cloud alignment match hand calc', () => {
  const values = [1, 3, 2, 5, 4, 6, 3, 7, 2, 8];
  const bars = mkBars(values, { highs: values, lows: values });
  const r = computeIchimoku(bars, 3, 5, 8, 2);
  closeTo(r.values[9].tenkan, 5);
  closeTo(r.values[9].kijun, 5);
  closeTo(r.values[7].senkouA, 5);
  assert.equal(r.signal, 'neutral'); // above cloud but tenkan == kijun (tie)
  closeTo(r.strength, 100);
});

test('52-week range: position within the rolling high/low band', () => {
  const values = [1, 3, 2, 5, 4];
  const bars = mkBars(values, { highs: values, lows: values });
  const r = computeFiftyTwoWeek(bars, 3);
  closeTo(r.values.at(-1).high52w, 5);
  closeTo(r.values.at(-1).low52w, 2);
  assert.equal(r.signal, 'neutral');
  closeTo(r.strength, (2 / 3 - 0.5) * 200, 1e-3);

  const breakout = mkBars([1, 3, 2, 5, 6], { highs: [1, 3, 2, 5, 6], lows: [1, 3, 2, 5, 6] });
  const rb = computeFiftyTwoWeek(breakout, 3);
  assert.equal(rb.signal, 'buy');
  closeTo(rb.strength, 100);
});

// --- live TradingView cross-check --------------------------------------------
// Reference values pulled from https://www.tradingview.com/symbols/NASDAQ-AAPL/technicals/
// on 2026-07-21 (1-day timeframe). The bars fixture is a frozen snapshot from
// that same date so this test stays stable as data/bars/ gets overwritten
// nightly. Tolerances account for TradingView's live intraday snapshot
// (price 327.57) vs our fetch's daily close (327.60) -- not a formula error.
test('TradingView cross-check: AAPL indicators match published reference values', () => {
  const fixturePath = path.join(__dirname, '__fixtures__', 'AAPL.2026-07-21.json');
  const bars = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')).bars;

  closeTo(computeRSI(bars, 14).values.at(-1), 64.19, 0.5, 'RSI(14)');
  closeTo(computeMACD(bars).values.at(-1).macd, 8.88, 0.1, 'MACD(12,26)');
  closeTo(computeSMA(bars, 50).values.at(-1), 304.22, 0.1, 'SMA(50)');
  closeTo(computeSMA(bars, 200).values.at(-1), 274.93, 0.1, 'SMA(200)');
  closeTo(computeEMA(bars, 20).values.at(-1), 314.40, 0.1, 'EMA(20)');
  closeTo(computeADX(bars, 14).values.at(-1).adx, 27.08, 0.05, 'ADX(14)');
  closeTo(computeStochastic(bars).values.at(-1).k, 88.37, 1, 'Stochastic %K(14,3,3)');
  closeTo(computeCCI(bars, 20).values.at(-1), 84.92, 2, 'CCI(20)');
  closeTo(computeWilliamsR(bars, 14).values.at(-1), -17.14, 2, 'Williams %R(14)');
});

run();
