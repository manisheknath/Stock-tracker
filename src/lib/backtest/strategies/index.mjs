import * as goldenDeathCross from './goldenDeathCross.mjs';
import * as donchianAdxBreakout from './donchianAdxBreakout.mjs';
import * as rsi2MeanReversion from './rsi2MeanReversion.mjs';
import * as macdSupertrendConfluence from './macdSupertrendConfluence.mjs';
import * as bollingerSqueeze from './bollingerSqueeze.mjs';
import * as patternBreakout from './patternBreakout.mjs';
import * as valueMomentum from './valueMomentum.mjs';

export const STRATEGIES = [
  goldenDeathCross,
  donchianAdxBreakout,
  rsi2MeanReversion,
  macdSupertrendConfluence,
  bollingerSqueeze,
  patternBreakout,
  valueMomentum,
];

// Nothing pending currently -- all 7 spec'd strategies are active. Kept as
// an exported list (rather than removed) so the strategy health page has a
// stable place to show any future strategy that's built but not yet
// backtestable.
export const PENDING_STRATEGIES = [];
