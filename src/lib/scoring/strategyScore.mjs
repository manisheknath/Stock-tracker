import { STRATEGIES } from '../backtest/strategies/index.mjs';

// All 6 backtested strategies are long-only, so they can only ever supply
// *bullish* live evidence. A 'sell' anchor gets no help or hindrance from
// this component (documented limitation, not an oversight) -- it stays
// neutral (50) until a short/bearish strategy exists to test against it.
export function computeStrategyScore(bars, anchorDirection, marketStrategyHealth) {
  const lastIndex = bars.length - 1;
  const triggered = [];

  for (const strategy of STRATEGIES) {
    const health = marketStrategyHealth?.[strategy.name];
    if (!health?.liveEligible) continue;

    const signals = strategy.generateSignals(bars);
    const firesToday = signals.some((s) => s.index === lastIndex && s.type === 'enter');
    if (!firesToday) continue;

    const test = health.test;
    triggered.push({
      name: strategy.name,
      triggered: true,
      testCagr: test.cagr,
      testSharpe: test.sharpe,
      testMaxDD: test.maxDrawdown,
      winRate: test.winRate,
      profitFactor: test.profitFactor,
      tradeCount: test.tradeCount,
    });
  }

  let score = 50;
  if (anchorDirection === 'buy' && triggered.length > 0) {
    score = 50 + 25 * Math.min(triggered.length, 2);
  }

  return { score, strategies: triggered };
}
