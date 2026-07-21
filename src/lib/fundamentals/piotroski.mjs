// Classic 9-point Piotroski F-Score. Takes two consecutive annual periods
// (current + prior) of the underlying figures and returns 0-9. Any criterion
// whose inputs are missing scores 0 for that point rather than throwing --
// coverage gaps are common outside the US, so partial data should degrade the
// score gracefully, not crash the pipeline.
export function computePiotroski(current, prior) {
  if (!current) return null;
  let score = 0;
  const has = (v) => v !== null && v !== undefined && Number.isFinite(v);

  // Profitability
  const roaCurrent = has(current.netIncome) && has(current.assets) && current.assets !== 0
    ? current.netIncome / current.assets : null;
  if (has(roaCurrent) && roaCurrent > 0) score++; // 1: positive ROA

  if (has(current.cashFlowOps) && current.cashFlowOps > 0) score++; // 2: positive CFO

  const roaPrior = prior && has(prior.netIncome) && has(prior.assets) && prior.assets !== 0
    ? prior.netIncome / prior.assets : null;
  if (has(roaCurrent) && has(roaPrior) && roaCurrent > roaPrior) score++; // 3: improving ROA

  if (has(current.cashFlowOps) && has(current.netIncome) && current.cashFlowOps > current.netIncome) score++; // 4: accruals (CFO > NI)

  // Leverage / liquidity
  const leverageCurrent = has(current.liabilities) && has(current.assets) && current.assets !== 0
    ? current.liabilities / current.assets : null;
  const leveragePrior = prior && has(prior.liabilities) && has(prior.assets) && prior.assets !== 0
    ? prior.liabilities / prior.assets : null;
  if (has(leverageCurrent) && has(leveragePrior) && leverageCurrent < leveragePrior) score++; // 5: lower leverage

  const currentRatioCurrent = has(current.currentAssets) && has(current.currentLiabilities) && current.currentLiabilities !== 0
    ? current.currentAssets / current.currentLiabilities : null;
  const currentRatioPrior = prior && has(prior.currentAssets) && has(prior.currentLiabilities) && prior.currentLiabilities !== 0
    ? prior.currentAssets / prior.currentLiabilities : null;
  if (has(currentRatioCurrent) && has(currentRatioPrior) && currentRatioCurrent > currentRatioPrior) score++; // 6: improving current ratio

  if (has(current.sharesOutstanding) && prior && has(prior.sharesOutstanding) && current.sharesOutstanding <= prior.sharesOutstanding) score++; // 7: no dilution

  // Operating efficiency
  const grossMarginCurrent = has(current.grossProfit) && has(current.revenue) && current.revenue !== 0
    ? current.grossProfit / current.revenue : null;
  const grossMarginPrior = prior && has(prior.grossProfit) && has(prior.revenue) && prior.revenue !== 0
    ? prior.grossProfit / prior.revenue : null;
  if (has(grossMarginCurrent) && has(grossMarginPrior) && grossMarginCurrent > grossMarginPrior) score++; // 8: improving gross margin

  const assetTurnoverCurrent = has(current.revenue) && has(current.assets) && current.assets !== 0
    ? current.revenue / current.assets : null;
  const assetTurnoverPrior = prior && has(prior.revenue) && has(prior.assets) && prior.assets !== 0
    ? prior.revenue / prior.assets : null;
  if (has(assetTurnoverCurrent) && has(assetTurnoverPrior) && assetTurnoverCurrent > assetTurnoverPrior) score++; // 9: improving asset turnover

  return score;
}
