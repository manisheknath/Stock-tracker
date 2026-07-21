import { closes, sma } from '../indicators/helpers.mjs';

const RISK_ON_THRESHOLD = 60;
const RISK_OFF_THRESHOLD = 40;

// Simple, documented breadth classifier: % of the market's tickers trading
// above their own 200DMA, plus today's advance/decline split. Not a
// statistical model -- a transparent rule in the same spirit as the classic
// "% above 200-day MA" breadth indicators used for market regime reads.
export function computeRegime(market, tickersData) {
  let aboveCount = 0;
  let validCount = 0;
  let advancing = 0;
  let declining = 0;

  for (const { bars } of tickersData) {
    if (bars.length < 2) continue;
    const close = closes(bars);
    const sma200 = sma(close, 200);
    const last = close.length - 1;

    if (sma200[last] !== null) {
      validCount++;
      if (close[last] > sma200[last]) aboveCount++;
    }

    if (bars[last].close > bars[last - 1].close) advancing++;
    else if (bars[last].close < bars[last - 1].close) declining++;
  }

  const pctAbove200dma = validCount === 0 ? null : Math.round((aboveCount / validCount) * 100);
  const advDecline = advancing === declining ? 'neutral' : advancing > declining ? 'positive' : 'negative';

  let state = 'NEUTRAL';
  if (pctAbove200dma !== null) {
    if (pctAbove200dma >= RISK_ON_THRESHOLD) state = 'RISK_ON';
    else if (pctAbove200dma <= RISK_OFF_THRESHOLD) state = 'RISK_OFF';
  }

  return { market, state, pctAbove200dma, advDecline };
}

// Regime only dampens signals running counter to the prevailing breadth --
// a bullish signal in RISK_ON (or bearish in RISK_OFF) is left unmodified,
// matching the spec example's "signal weight unmodified" note.
export function regimeModulation(regime, signalDirection) {
  if (regime.state === 'RISK_ON' && signalDirection === 'sell') {
    return { multiplier: 0.9, note: 'bearish signal dampened -- market breadth is RISK_ON' };
  }
  if (regime.state === 'RISK_OFF' && signalDirection === 'buy') {
    return { multiplier: 0.85, note: 'bullish signal dampened -- market breadth is RISK_OFF' };
  }
  return { multiplier: 1.0, note: 'signal weight unmodified' };
}
