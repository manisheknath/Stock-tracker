import * as goldenDeathCross from './goldenDeathCross.mjs';
import * as donchianAdxBreakout from './donchianAdxBreakout.mjs';
import * as rsi2MeanReversion from './rsi2MeanReversion.mjs';
import * as macdSupertrendConfluence from './macdSupertrendConfluence.mjs';
import * as bollingerSqueeze from './bollingerSqueeze.mjs';
import * as patternBreakout from './patternBreakout.mjs';

export const STRATEGIES = [
  goldenDeathCross,
  donchianAdxBreakout,
  rsi2MeanReversion,
  macdSupertrendConfluence,
  bollingerSqueeze,
  patternBreakout,
];

// "Value + 12m Momentum" needs fundamentals (P/E vs sector median, etc.) that
// don't exist until build step 7 (SEC EDGAR fundamentals). Listed here so the
// strategy health page can show it as pending rather than silently missing.
export const PENDING_STRATEGIES = [
  { name: 'Value + 12m Momentum', status: 'pending', reason: 'requires fundamentals data (build step 7)' },
];
