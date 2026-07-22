import { closes, volumes, trueRange, wilderRMA } from '../indicators/helpers.mjs';
import { computeTechnicalScore } from './technicalScore.mjs';
import { computePatternScore } from './patternScore.mjs';
import { computeStrategyScore } from './strategyScore.mjs';
import { computeFundamentalScore } from './fundamentalScore.mjs';
import { regimeModulation } from './regime.mjs';

const WEIGHTS = { technical: 0.40, pattern: 0.25, strategy: 0.20, fundamental: 0.15 };
const SIGNAL_THRESHOLD = 60;
const MIN_LIQUIDITY_NOTIONAL = 100000; // avg 20d dollar/local-currency volume floor
const TARGET_REWARD_RISK = 2; // when no pattern target exists, target = 2x the stop distance

// Maps a triggering strategy to how long its edge typically plays out.
// Priority order matters when multiple strategies fire the same night --
// the shortest horizon wins (most conservative/actionable).
const STRATEGY_HORIZON = {
  'RSI(2) Mean Reversion above 200DMA': 'SHORT_TERM',
  'Pattern-confirmed breakout': 'SHORT_TERM',
  'Donchian 20 Breakout + ADX filter': 'MEDIUM_TERM',
  'MACD + Supertrend confluence': 'MEDIUM_TERM',
  'Bollinger Squeeze release': 'MEDIUM_TERM',
  'Golden/Death Cross (50/200)': 'LONG_TERM',
  'Value + 12m Momentum': 'LONG_TERM',
};
const HORIZON_RANK = { SHORT_TERM: 0, MEDIUM_TERM: 1, LONG_TERM: 2 };
const ADX_TREND_THRESHOLD = 25;

// A triggering strategy is the strongest evidence and wins outright. Absent
// that (the common case -- strategy triggers are a narrow, same-night
// condition), horizon falls back to what's actually driving the technical
// picture: a recent supporting pattern implies a tactical, short-lived setup;
// a strong ADX-confirmed trend aligned with the 200DMA implies a durable,
// long-running one; otherwise it's a medium-term swing call. Without this
// fallback, nearly every signal defaulted to MEDIUM_TERM regardless of what
// was actually going on, since strategy triggers are rare.
function deriveHorizon(triggeredStrategies, { patterns, indicators, anchorDirection }) {
  if (triggeredStrategies.length > 0) {
    return triggeredStrategies
      .map((s) => STRATEGY_HORIZON[s.name] ?? 'MEDIUM_TERM')
      .sort((a, b) => HORIZON_RANK[a] - HORIZON_RANK[b])[0];
  }

  if (anchorDirection !== 'neutral') {
    const wantDirection = anchorDirection === 'buy' ? 'bullish' : 'bearish';
    if (patterns.some((p) => p.direction === wantDirection)) return 'SHORT_TERM';

    const sma200 = indicators.find((i) => i.name === 'Price vs SMA(200)');
    const adx = indicators.find((i) => i.name === 'ADX(14)');
    const adxValue = typeof adx?.value === 'string' ? parseFloat(adx.value) : adx?.value;
    const trendAligned = sma200?.signal === anchorDirection;
    if (trendAligned && Number.isFinite(adxValue) && adxValue >= ADX_TREND_THRESHOLD) return 'LONG_TERM';
  }

  return 'MEDIUM_TERM';
}

function computeRisk(bars, direction, patterns) {
  const close = closes(bars);
  const volume = volumes(bars);
  const price = close.at(-1);
  const atr14 = wilderRMA(trueRange(bars), 14).at(-1);

  const window = volume.slice(-20).filter((v) => v != null);
  const avgVolume20d = window.length ? window.reduce((a, b) => a + b, 0) / window.length : null;
  const notional = avgVolume20d != null ? avgVolume20d * price : null;

  const suggestedStop = atr14 == null ? null : direction === 'sell' ? price + 2 * atr14 : price - 2 * atr14;
  const distanceToStopPct = suggestedStop == null ? null : (Math.abs(price - suggestedStop) / price) * 100;

  // Suggested entry is the last close -- this system executes at the *next*
  // session's open (no lookahead), so the close is the most recent honest
  // reference point, not a promise of the actual fill price.
  const suggestedEntry = direction === 'neutral' ? null : price;

  // Target prefers a real pattern's own price target (if one matches this
  // direction); otherwise falls back to a 2:1 reward:risk projection off the
  // same ATR stop distance, so every directional signal has one, not just
  // the minority with an active chart/candlestick pattern.
  let target = null;
  if (direction !== 'neutral') {
    const wantDirection = direction === 'buy' ? 'bullish' : 'bearish';
    const patternTarget = patterns.find((p) => p.direction === wantDirection && typeof p.keyLevels?.target === 'number')?.keyLevels?.target;
    if (patternTarget != null) {
      target = patternTarget;
    } else if (suggestedStop != null) {
      const stopDistance = Math.abs(price - suggestedStop);
      target = direction === 'buy' ? price + TARGET_REWARD_RISK * stopDistance : price - TARGET_REWARD_RISK * stopDistance;
    }
  }

  return {
    atr14: atr14 ?? null,
    suggestedEntry,
    suggestedStop,
    target,
    distanceToStopPct,
    avgVolume20d,
    liquidityOk: notional != null ? notional >= MIN_LIQUIDITY_NOTIONAL : false,
  };
}

export function computeConviction({ bars, fundamentals, regime, marketStrategyHealth, marketMedianPe }) {
  const technical = computeTechnicalScore(bars);
  const pattern = computePatternScore(bars, technical.direction);
  const strategy = computeStrategyScore(bars, technical.direction, marketStrategyHealth, { fundamentals, marketMedianPe });
  const fundamental = computeFundamentalScore(fundamentals, technical.direction);

  const rawConviction = WEIGHTS.technical * technical.score
    + WEIGHTS.pattern * pattern.score
    + WEIGHTS.strategy * strategy.score
    + WEIGHTS.fundamental * fundamental.score;

  const modulation = regimeModulation(regime, technical.direction);
  const conviction = Math.round(Math.max(0, Math.min(100, rawConviction * modulation.multiplier)));

  const signal = technical.direction === 'neutral' || conviction < SIGNAL_THRESHOLD
    ? 'HOLD'
    : technical.direction === 'buy' ? 'BUY' : 'SELL';

  return {
    conviction,
    signal,
    horizon: deriveHorizon(strategy.strategies, { patterns: pattern.patterns, indicators: technical.indicators, anchorDirection: technical.direction }),
    evidence: {
      technical: { score: technical.score, indicators: technical.indicators },
      patterns: pattern.patterns,
      strategies: strategy.strategies,
      fundamental,
      regime: { market: regime.market, state: regime.state, pctAbove200dma: regime.pctAbove200dma, advDecline: regime.advDecline, note: modulation.note },
    },
    risk: computeRisk(bars, technical.direction, pattern.patterns),
  };
}
