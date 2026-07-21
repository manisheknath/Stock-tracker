import { closes, ema, lastValid, strengthFromPct } from './helpers.mjs';

// EMA of a series that has leading nulls (e.g. the MACD line itself), padding
// the result back out to the original length.
function emaWithLeadingNulls(values, period) {
  const firstValid = values.findIndex((v) => v !== null);
  if (firstValid === -1) return new Array(values.length).fill(null);
  const trimmed = values.slice(firstValid);
  const emaTrimmed = ema(trimmed, period);
  return new Array(firstValid).fill(null).concat(emaTrimmed);
}

export function computeMACD(bars, fast = 12, slow = 26, signalPeriod = 9) {
  const close = closes(bars);
  const emaFast = ema(close, fast);
  const emaSlow = ema(close, slow);
  const macdLine = close.map((_, i) => (
    emaFast[i] === null || emaSlow[i] === null ? null : emaFast[i] - emaSlow[i]
  ));
  const signalLine = emaWithLeadingNulls(macdLine, signalPeriod);
  const histogram = macdLine.map((v, i) => (
    v === null || signalLine[i] === null ? null : v - signalLine[i]
  ));

  const values = macdLine.map((v, i) => ({ macd: v, signal: signalLine[i], histogram: histogram[i] }));

  const lastHist = lastValid(histogram);
  const price = lastValid(close);
  if (lastHist === null || price === null) {
    return { values, signal: 'neutral', strength: 0 };
  }

  const lastIdx = histogram.map((v) => v !== null).lastIndexOf(true);
  const prevHist = lastIdx > 0 ? histogram[lastIdx - 1] : null;
  let signal = lastHist > 0 ? 'buy' : lastHist < 0 ? 'sell' : 'neutral';
  if (prevHist !== null) {
    if (prevHist <= 0 && lastHist > 0) signal = 'buy';
    if (prevHist >= 0 && lastHist < 0) signal = 'sell';
  }

  const strength = strengthFromPct((lastHist / price) * 100, 1.5);
  return { values, signal, strength };
}
