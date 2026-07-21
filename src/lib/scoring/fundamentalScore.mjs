function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function average(values) {
  const defined = values.filter((v) => v !== null && v !== undefined);
  if (defined.length === 0) return null;
  return defined.reduce((a, b) => a + b, 0) / defined.length;
}

// Builds a 0-100 "how good are these fundamentals" raw score from whatever
// fields are actually available (gracefully skipping missing ones -- partial
// EU/IN coverage routinely lacks piotroski, sometimes roe or sectorMedianPe
// too), then reframes it as *consistency with the anchor direction*: good
// fundamentals support a 'buy' anchor, and by the same logic support the
// bear case's absence for a 'sell' anchor (i.e. inverted).
export function computeFundamentalScore(fundamentals, anchorDirection) {
  if (!fundamentals?.dataAvailable) {
    return { score: 50, valuation: {}, quality: {}, growth: {}, coverage: fundamentals?.coverage ?? 'unavailable' };
  }

  const { valuation = {}, quality = {}, growth = {}, coverage } = fundamentals;

  const valuationComponent = (valuation.pe && valuation.sectorMedianPe)
    ? 50 + clamp(((valuation.sectorMedianPe - valuation.pe) / valuation.sectorMedianPe) * 100, -50, 50)
    : null;

  const qualityParts = [];
  if (quality.piotroski !== null && quality.piotroski !== undefined) qualityParts.push((quality.piotroski / 9) * 100);
  if (quality.roe !== null && quality.roe !== undefined) qualityParts.push(clamp(quality.roe * 100, 0, 100));
  if (quality.debtEquity !== null && quality.debtEquity !== undefined) qualityParts.push(100 - clamp(quality.debtEquity * 20, 0, 100));
  const qualityComponent = average(qualityParts);

  const growthComponent = (() => {
    const avgGrowth = average([growth.revCagr3y, growth.epsCagr3y]);
    return avgGrowth === null ? null : 50 + clamp(avgGrowth * 200, -50, 50);
  })();

  const rawScore = average([valuationComponent, qualityComponent, growthComponent]) ?? 50;
  const score = anchorDirection === 'buy' ? rawScore : anchorDirection === 'sell' ? 100 - rawScore : 50;

  const verdict = valuation.pe && valuation.sectorMedianPe
    ? (valuation.pe < valuation.sectorMedianPe ? 'below sector' : valuation.pe > valuation.sectorMedianPe ? 'above sector' : 'in line with sector')
    : 'n/a (no sector benchmark)';

  return {
    score: Math.round(clamp(score, 0, 100)),
    valuation: { pe: valuation.pe ?? null, sectorMedianPe: valuation.sectorMedianPe ?? null, verdict },
    quality: { roe: quality.roe ?? null, debtEquity: quality.debtEquity ?? null, piotroski: quality.piotroski ?? null },
    growth: { revCagr3y: growth.revCagr3y ?? null, epsCagr3y: growth.epsCagr3y ?? null },
    coverage,
    ...(fundamentals.note ? { note: fundamentals.note } : {}),
  };
}
