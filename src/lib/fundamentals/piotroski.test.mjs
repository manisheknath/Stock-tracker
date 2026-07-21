import { test, assert, run } from '../indicators/testHarness.mjs';
import { computePiotroski } from './piotroski.mjs';

test('Piotroski: perfect-improvement year scores 9/9', () => {
  const prior = {
    netIncome: 80, assets: 1000, liabilities: 500, currentAssets: 300, currentLiabilities: 250,
    cashFlowOps: 70, sharesOutstanding: 100, revenue: 900, grossProfit: 300,
  };
  const current = {
    netIncome: 120, assets: 1100, liabilities: 500, currentAssets: 400, currentLiabilities: 250,
    cashFlowOps: 150, sharesOutstanding: 100, revenue: 1000, grossProfit: 400,
  };
  assert.equal(computePiotroski(current, prior), 9);
});

test('Piotroski: all-deteriorating year scores 0/9 (before the two always-checkable profitability points)', () => {
  const prior = {
    netIncome: 100, assets: 1000, liabilities: 400, currentAssets: 400, currentLiabilities: 200,
    cashFlowOps: 120, sharesOutstanding: 100, revenue: 1000, grossProfit: 400,
  };
  const current = {
    netIncome: -50, assets: 1000, liabilities: 600, currentAssets: 300, currentLiabilities: 250,
    cashFlowOps: -60, sharesOutstanding: 120, revenue: 900, grossProfit: 270,
  };
  // netIncome negative -> ROA<=0 (0 pts), cashFlowOps negative (0 pts), ROA declined (0),
  // accruals CFO<NI still false since both negative but cfo(-60)<ni(-50) (0), leverage worse (0),
  // current ratio worse (0), shares increased/diluted (0), gross margin 270/900=0.30 < prior 0.40 (0),
  // asset turnover 900/1000=0.9 < prior 1000/1000=1.0 (0)
  assert.equal(computePiotroski(current, prior), 0);
});

test('Piotroski: missing prior-year data degrades gracefully instead of throwing', () => {
  const current = { netIncome: 50, assets: 500, cashFlowOps: 60, liabilities: 200 };
  const score = computePiotroski(current, null);
  assert.ok(score >= 0 && score <= 9);
});

run();
