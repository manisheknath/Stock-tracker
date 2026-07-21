import { detectAllChartPatterns } from '../../patterns/chart/index.mjs';

export const name = 'Pattern-confirmed breakout';

const MAX_HOLD_BARS = 30;
const PIVOT_LOOKBACK = 5;

// Long entries at a confirmed bullish chart-pattern breakout bar (barIndex is
// already the confirmed breakout, per the pattern library's own no-lookahead
// rule); exits at the pattern's own price target or a max-hold safety net.
// The engine's ATR stop (applied uniformly to every strategy) is the downside
// safety net, so this strategy doesn't need its own stop logic.
export function generateSignals(bars) {
  const patterns = detectAllChartPatterns(bars, PIVOT_LOOKBACK)
    .filter((p) => p.direction === 'bullish' && typeof p.keyLevels?.target === 'number');

  const targetByIndex = new Map();
  for (const p of patterns) {
    if (!targetByIndex.has(p.barIndex)) targetByIndex.set(p.barIndex, p.keyLevels.target);
  }

  const signals = [];
  let inPosition = false;
  let entryIndex = null;
  let target = null;

  for (let i = 0; i < bars.length; i++) {
    if (!inPosition) {
      if (targetByIndex.has(i)) {
        signals.push({ index: i, type: 'enter' });
        inPosition = true;
        entryIndex = i;
        target = targetByIndex.get(i);
      }
    } else if (bars[i].close >= target || i - entryIndex >= MAX_HOLD_BARS) {
      signals.push({ index: i, type: 'exit' });
      inPosition = false;
    }
  }

  return signals;
}
