import { trueRange, wilderRMA } from '../indicators/helpers.mjs';
import { windowBarIndexRange } from './windows.mjs';
import { computeMetrics } from './metrics.mjs';

const DEFAULTS = {
  initialCapital: 100000,
  riskPerTradePct: 0.01,
  atrStopMultiple: 2,
  maxConcurrentPositions: 10,
  slippageBps: 10,
  commissionBps: 5,
};

// Per-ticker candidate trades within one window, generated in isolation
// (no capital/position-cap constraints yet -- that's a portfolio-level
// concern applied afterward in runPortfolioBacktest). Enforces next-open
// execution for every signal (entry, strategy exit, and ATR stop), and
// force-closes any position still open at the window's last bar (using that
// bar's close as a mark-to-market price, not a signal execution) so every
// window's report is self-contained.
export function generateTickerTrades(ticker, bars, signals, atrSeries, window, atrStopMultiple = DEFAULTS.atrStopMultiple) {
  const range = windowBarIndexRange(bars, window);
  if (!range) return [];
  const { startIdx, endIdx } = range;
  const signalByIndex = new Map(signals.map((s) => [s.index, s.type]));

  const trades = [];
  let inPosition = false;
  let entryFillIndex = null;
  let entryPrice = null;
  let atrAtEntry = null;
  let stopPrice = null;

  for (let i = startIdx; i <= endIdx; i++) {
    if (!inPosition) {
      if (signalByIndex.get(i) === 'enter' && i + 1 <= endIdx) {
        entryFillIndex = i + 1;
        entryPrice = bars[entryFillIndex].open;
        atrAtEntry = atrSeries[i] ?? null;
        stopPrice = atrAtEntry ? entryPrice - atrStopMultiple * atrAtEntry : null;
        inPosition = true;
      }
      continue;
    }

    const stopHit = stopPrice !== null && bars[i].low <= stopPrice;
    const signalExit = signalByIndex.get(i) === 'exit';

    if ((stopHit || signalExit) && i + 1 <= endIdx) {
      const exitFillIndex = i + 1;
      trades.push({
        ticker, direction: 'long',
        entryDate: bars[entryFillIndex].date, entryPrice,
        exitDate: bars[exitFillIndex].date, exitPrice: bars[exitFillIndex].open,
        exitReason: stopHit ? 'stop' : 'signal', atrAtEntry,
      });
      inPosition = false;
    } else if (i === endIdx) {
      trades.push({
        ticker, direction: 'long',
        entryDate: bars[entryFillIndex].date, entryPrice,
        exitDate: bars[i].date, exitPrice: bars[i].close,
        exitReason: 'window-end', atrAtEntry,
      });
      inPosition = false;
    }
  }

  return trades;
}

// Admits candidate trades in chronological entry order, rejecting any that
// would exceed maxConcurrentPositions at the moment they'd open. Rejected
// trades simply never happen (no queueing) -- a documented simplification.
function admitByConcurrency(candidateTrades, maxConcurrentPositions) {
  const sorted = [...candidateTrades].sort((a, b) => (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : a.ticker.localeCompare(b.ticker)));
  const admitted = [];
  const openExitDates = [];

  for (const trade of sorted) {
    for (let i = openExitDates.length - 1; i >= 0; i--) {
      if (openExitDates[i] <= trade.entryDate) openExitDates.splice(i, 1);
    }
    if (openExitDates.length < maxConcurrentPositions) {
      admitted.push(trade);
      openExitDates.push(trade.exitDate);
    }
  }
  return admitted;
}

// Sizes each admitted trade off running equity (realized P&L from trades
// already closed strictly before this one's entry), applies slippage as
// price impact and commission as a separate bps fee on notional at both
// legs, and returns priced trades plus a step-function equity curve that
// updates on trade-close events. (Equity only reflects realized P&L, not
// daily mark-to-market of open positions -- a scoped-down but honest
// simplification given this engine doesn't track intraday portfolio value.)
function sizeAndPrice(admittedTrades, opts) {
  const { initialCapital, riskPerTradePct, atrStopMultiple, slippageBps, commissionBps } = opts;
  const byEntry = [...admittedTrades].sort((a, b) => (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : 0));

  const priced = [];
  for (const trade of byEntry) {
    if (!trade.atrAtEntry || trade.atrAtEntry <= 0) continue;

    const equityAtEntry = initialCapital + priced
      .filter((t) => t.exitDate <= trade.entryDate)
      .reduce((sum, t) => sum + t.pnl, 0);

    const stopDistance = atrStopMultiple * trade.atrAtEntry;
    const shares = Math.floor((equityAtEntry * riskPerTradePct) / stopDistance);
    if (shares <= 0) continue;

    const entryFill = trade.entryPrice * (1 + slippageBps / 10000);
    const exitFill = trade.exitPrice * (1 - slippageBps / 10000);
    const commissionEntry = shares * trade.entryPrice * (commissionBps / 10000);
    const commissionExit = shares * trade.exitPrice * (commissionBps / 10000);
    const pnl = shares * (exitFill - entryFill) - commissionEntry - commissionExit;
    const notional = shares * entryFill;

    priced.push({
      ...trade, shares, entryFill, exitFill, pnl,
      pnlPct: notional > 0 ? pnl / notional : 0,
    });
  }
  return priced;
}

function buildEquityCurve(pricedTrades, window, initialCapital) {
  const byExit = [...pricedTrades].sort((a, b) => (a.exitDate < b.exitDate ? -1 : a.exitDate > b.exitDate ? 1 : 0));
  const curve = [{ date: window.start, equity: initialCapital }];
  let equity = initialCapital;
  for (const trade of byExit) {
    equity += trade.pnl;
    curve.push({ date: trade.exitDate, equity });
  }
  if (curve[curve.length - 1].date < window.end) {
    curve.push({ date: window.end, equity });
  }
  return curve;
}

// Full pipeline for one strategy, one market, one walk-forward window:
// per-ticker candidate trades -> portfolio admission under the concurrency
// cap -> ATR-sized/costed fills -> equity curve -> metrics.
export function runPortfolioBacktest({ tickersData, strategy, window, ...overrides }) {
  const opts = { ...DEFAULTS, ...overrides };

  const allCandidates = [];
  for (const { ticker, bars } of tickersData) {
    const atrSeries = wilderRMA(trueRange(bars), 14);
    const signals = strategy.generateSignals(bars);
    allCandidates.push(...generateTickerTrades(ticker, bars, signals, atrSeries, window, opts.atrStopMultiple));
  }

  const admitted = admitByConcurrency(allCandidates, opts.maxConcurrentPositions);
  const priced = sizeAndPrice(admitted, opts);
  const equityCurve = buildEquityCurve(priced, window, opts.initialCapital);

  return {
    trades: priced,
    ...computeMetrics(equityCurve, priced),
  };
}
