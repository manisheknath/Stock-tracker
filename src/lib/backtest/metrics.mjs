// All metrics computed from a self-contained window: an equity curve (daily
// marks) and the list of trades admitted within that window. No knowledge of
// what happened before/after the window is assumed.

function stdev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function dailyReturns(equityCurve) {
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    if (prev > 0) returns.push((equityCurve[i].equity - prev) / prev);
  }
  return returns;
}

function maxDrawdown(equityCurve) {
  let peak = -Infinity;
  let maxDD = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = peak > 0 ? (point.equity - peak) / peak : 0;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

function cagr(equityCurve) {
  if (equityCurve.length < 2) return 0;
  const start = equityCurve[0];
  const end = equityCurve[equityCurve.length - 1];
  if (start.equity <= 0) return 0;
  const days = (Date.parse(end.date) - Date.parse(start.date)) / 86400000;
  if (days <= 0) return 0;
  const years = days / 365.25;
  return (end.equity / start.equity) ** (1 / years) - 1;
}

// Annualized Sharpe from daily equity returns. Risk-free rate assumed 0
// (documented simplification -- reasonable for relative strategy comparison,
// not for absolute risk-adjusted-return claims).
function sharpe(equityCurve) {
  const returns = dailyReturns(equityCurve);
  const sd = stdev(returns);
  if (sd === 0 || returns.length === 0) return 0;
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  return (meanReturn / sd) * Math.sqrt(252);
}

export function computeMetrics(equityCurve, trades) {
  if (equityCurve.length === 0) {
    return {
      cagr: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0,
      expectancy: 0, tradeCount: 0, equityCurve: [],
    };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

  return {
    cagr: cagr(equityCurve),
    sharpe: sharpe(equityCurve),
    maxDrawdown: maxDrawdown(equityCurve),
    winRate: trades.length === 0 ? 0 : wins.length / trades.length,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss,
    expectancy: trades.length === 0 ? 0 : trades.reduce((sum, t) => sum + t.pnlPct, 0) / trades.length,
    tradeCount: trades.length,
    equityCurve,
  };
}
