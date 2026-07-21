import { computeAllIndicators } from '../indicators/index.mjs';
import { closes } from '../indicators/helpers.mjs';

function lastValid(values) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null && values[i] !== undefined) return values[i];
  }
  return null;
}

function signAt(values, i) {
  for (let j = i; j >= 0; j--) {
    const v = values[j];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

// Formats each indicator's own {values, signal, strength} into a compact,
// human-readable evidence entry -- shape and formulas here aren't specified
// by the spec beyond the worked JSON example, so this is a documented,
// reasonable design choice, not a literal spec requirement.
function formatIndicator(name, result, bars) {
  const price = lastValid(closes(bars));

  if (/^SMA|^EMA/.test(name)) {
    const ma = lastValid(result.values);
    const pct = ma ? ((price - ma) / ma) * 100 : null;
    return { name: `Price vs ${name}`, value: pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : 'n/a', signal: result.signal };
  }
  if (name === 'MACD') {
    const last = result.values.at(-1);
    let note;
    for (let i = result.values.length - 1, ago = 0; i >= 1 && ago < 10; i--, ago++) {
      const h = result.values[i]?.histogram;
      const prevH = result.values[i - 1]?.histogram;
      if (h == null || prevH == null) continue;
      if (prevH <= 0 && h > 0) { note = `bullish crossover ${ago} bar(s) ago`; break; }
      if (prevH >= 0 && h < 0) { note = `bearish crossover ${ago} bar(s) ago`; break; }
    }
    return { name: 'MACD', value: last?.macd?.toFixed(2) ?? 'n/a', signal: result.signal, note };
  }
  if (name === 'ADX(14)') {
    const vals = result.values.map((v) => v?.adx).filter((v) => v != null);
    const trending = vals.length >= 2 ? vals.at(-1) > vals.at(-2) : null;
    return { name: 'ADX(14)', value: lastValid(result.values.map((v) => v?.adx))?.toFixed(1) ?? 'n/a', signal: result.signal, note: trending === null ? undefined : trending ? 'trend strengthening' : 'trend weakening' };
  }
  if (name === 'Bollinger' || name === 'Keltner') {
    const last = result.values.at(-1);
    if (last && last.upper != null && last.lower != null && last.upper !== last.lower) {
      const percentB = (price - last.lower) / (last.upper - last.lower);
      return { name, value: `${(percentB * 100).toFixed(0)}% of band`, signal: result.signal };
    }
    return { name, value: 'n/a', signal: result.signal };
  }
  if (name === 'Stochastic') {
    const last = result.values.at(-1);
    return { name, value: last?.k?.toFixed(1) ?? 'n/a', signal: result.signal };
  }
  if (name === 'Supertrend') {
    const last = result.values.at(-1);
    return { name, value: last?.direction ?? 'n/a', signal: result.signal };
  }
  if (name === 'Ichimoku') {
    const last = result.values.at(-1);
    return { name, value: last?.tenkan != null ? `tenkan ${last.tenkan.toFixed(2)} / kijun ${last.kijun.toFixed(2)}` : 'n/a', signal: result.signal };
  }
  if (name === '52wRange') {
    const last = result.values.at(-1);
    if (last && last.high52w != null && last.low52w != null && last.high52w !== last.low52w) {
      const position = (price - last.low52w) / (last.high52w - last.low52w);
      return { name: '52-week range position', value: `${(position * 100).toFixed(0)}%`, signal: result.signal };
    }
    return { name: '52-week range position', value: 'n/a', signal: result.signal };
  }

  const value = lastValid(result.values);
  return { name, value: value != null ? Number(value.toFixed(2)) : 'n/a', signal: result.signal };
}

export function computeTechnicalScore(bars) {
  const all = computeAllIndicators(bars);
  const indicators = [];
  let weightedSum = 0;
  let count = 0;

  for (const [name, result] of Object.entries(all)) {
    indicators.push(formatIndicator(name, result, bars));
    const sign = result.signal === 'buy' ? 1 : result.signal === 'sell' ? -1 : 0;
    weightedSum += sign * result.strength;
    count++;
  }

  const directionalScore = count === 0 ? 0 : weightedSum / count; // [-100, 100]
  const score = Math.round(50 + directionalScore / 2); // [0, 100], 50 = neutral
  const direction = directionalScore > 5 ? 'buy' : directionalScore < -5 ? 'sell' : 'neutral';

  return { score, direction, indicators };
}
