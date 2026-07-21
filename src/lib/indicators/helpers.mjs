// Shared numeric primitives used by every indicator. Pure functions, no I/O --
// safe to import from both Node pipeline scripts and the browser.

export function closes(bars) { return bars.map((b) => b.close); }
export function highs(bars) { return bars.map((b) => b.high); }
export function lows(bars) { return bars.map((b) => b.low); }
export function volumes(bars) { return bars.map((b) => b.volume); }

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// Standard EMA: seeded with the SMA of the first `period` values, then the
// usual recursive multiplier from there on.
export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j <= i; j++) sum += values[j];
      prev = sum / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

// Wilder's smoothing (RMA): seeded with SMA(period), then alpha = 1/period.
// Used by RSI, ATR, ADX/+DI/-DI -- matches Pine Script's ta.rma / classic
// Wilder formulas exactly.
export function wilderRMA(values, period) {
  const out = new Array(values.length).fill(null);
  let prev = null;
  const alpha = 1 / period;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === null || values[i] === undefined) continue;
    if (i < period - 1) continue;
    if (prev === null) {
      let sum = 0;
      let count = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += values[j];
        count++;
      }
      prev = sum / count;
    } else {
      prev = alpha * values[i] + (1 - alpha) * prev;
    }
    out[i] = prev;
  }
  return out;
}

// Population standard deviation over a rolling window (matches TradingView's
// default ta.stdev, biased=true).
export function stdev(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    const mean = sum / period;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) sqSum += (values[j] - mean) ** 2;
    out[i] = Math.sqrt(sqSum / period);
  }
  return out;
}

export function trueRange(bars) {
  const out = new Array(bars.length).fill(null);
  for (let i = 0; i < bars.length; i++) {
    const { high, low, close } = bars[i];
    if (i === 0) {
      out[i] = high - low;
      continue;
    }
    const prevClose = bars[i - 1].close;
    out[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  return out;
}

export function rollingHighest(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let max = -Infinity;
    for (let j = i - period + 1; j <= i; j++) if (values[j] > max) max = values[j];
    out[i] = max;
  }
  return out;
}

export function rollingLowest(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let min = Infinity;
    for (let j = i - period + 1; j <= i; j++) if (values[j] < min) min = values[j];
    out[i] = min;
  }
  return out;
}

export function lastValid(values) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null && values[i] !== undefined && !Number.isNaN(values[i])) return values[i];
  }
  return null;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Maps a percentage magnitude onto 0-100, saturating at capPct (e.g. capPct=10
// means a 10%+ deviation already reads as maximum strength).
export function strengthFromPct(pct, capPct) {
  return clamp((Math.abs(pct) / capPct) * 100, 0, 100);
}
