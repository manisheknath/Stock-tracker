import { closes } from '../../indicators/helpers.mjs';

export const name = 'Value + 12m Momentum';
export const caveat = 'Value gate uses a current-day fundamentals snapshot applied across the whole historical window (no point-in-time fundamentals available for 2020-2025) -- train/validate/test backtest results are look-ahead biased and should be read with that caveat. Live signals are unaffected.';

const MOMENTUM_LOOKBACK = 252; // ~12 months of trading days
const MOMENTUM_ENTRY_THRESHOLD = 5; // % trailing 12m return
const MAX_HOLD_BARS = 252;

// IMPORTANT CAVEAT: the value gate below uses a single CURRENT-day
// fundamentals snapshot (P/E vs sector or market median), not a historical
// time series -- point-in-time fundamentals for 2020-2025 aren't available
// from our data sources (SEC EDGAR / Yahoo quoteSummary only expose the
// latest figures). That means the train/validate/test backtest for this
// strategy is look-ahead biased: the value gate reflects whether the stock
// is cheap *today*, applied uniformly across the whole historical window,
// not whether it was actually cheap at each past date. Its backtest metrics
// should be read with that caveat -- unlike the other 6 strategies, which
// have no such lookahead. Live signals going forward don't have this
// problem (today's snapshot genuinely is today's snapshot); only the
// historical backtest results are affected. Surfaced in strategy-health.json
// via the `caveat` field (see run-backtest.mjs).
function isValueEligible(fundamentals, marketMedianPe) {
  if (!fundamentals?.dataAvailable || !fundamentals.valuation?.pe) return false;
  const { pe, sectorMedianPe } = fundamentals.valuation;
  if (sectorMedianPe) return pe < sectorMedianPe;
  if (marketMedianPe) return pe < marketMedianPe;
  return false; // no peer benchmark at all -- can't confirm the value leg, so don't trigger
}

export function generateSignals(bars, context = {}) {
  if (!isValueEligible(context.fundamentals, context.marketMedianPe)) return [];

  const close = closes(bars);
  const signals = [];
  let inPosition = false;
  let entryIndex = null;

  for (let i = MOMENTUM_LOOKBACK; i < bars.length; i++) {
    const momentum = ((close[i] - close[i - MOMENTUM_LOOKBACK]) / close[i - MOMENTUM_LOOKBACK]) * 100;

    if (!inPosition) {
      if (momentum > MOMENTUM_ENTRY_THRESHOLD) {
        signals.push({ index: i, type: 'enter' });
        inPosition = true;
        entryIndex = i;
      }
    } else if (momentum <= 0 || i - entryIndex >= MAX_HOLD_BARS) {
      signals.push({ index: i, type: 'exit' });
      inPosition = false;
    }
  }

  return signals;
}
