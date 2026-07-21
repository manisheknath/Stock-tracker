import { detectAllCandlestickPatterns } from '../patterns/candlestick/index.mjs';
import { detectAllChartPatterns } from '../patterns/chart/index.mjs';

const RECENCY_BARS = 10;
const MAX_EVIDENCE_PATTERNS = 3;

// Only patterns whose confirming (barIndex) bar falls in the trailing window
// are "currently relevant" -- older ones no longer describe the stock's
// present setup. anchorDirection comes from the technical score (the highest
// -weighted component); this score measures how much pattern evidence
// *supports* that anchor, not an independent direction of its own.
export function computePatternScore(bars, anchorDirection) {
  const recentCutoff = bars.length - 1 - RECENCY_BARS;
  const all = [
    ...detectAllCandlestickPatterns(bars),
    ...detectAllChartPatterns(bars, 5),
  ].filter((p) => p.barIndex >= recentCutoff);

  const evidence = [...all]
    .sort((a, b) => b.barIndex - a.barIndex || b.confidence - a.confidence)
    .slice(0, MAX_EVIDENCE_PATTERNS)
    .map((p) => ({ pattern: p.pattern, direction: p.direction, confidence: p.confidence, keyLevels: p.keyLevels, description: p.description }));

  if (all.length === 0 || anchorDirection === 'neutral') {
    return { score: 50, patterns: evidence };
  }

  const supporting = all.filter((p) => p.direction === (anchorDirection === 'buy' ? 'bullish' : 'bearish'));
  const contradicting = all.filter((p) => p.direction === (anchorDirection === 'buy' ? 'bearish' : 'bullish'));

  const avg = (list) => list.reduce((sum, p) => sum + p.confidence, 0) / list.length;
  let score = 50;
  if (supporting.length > 0) score += (avg(supporting) / 100) * 50;
  if (contradicting.length > 0) score -= (avg(contradicting) / 100) * 50;

  return { score: Math.round(Math.max(0, Math.min(100, score))), patterns: evidence };
}
