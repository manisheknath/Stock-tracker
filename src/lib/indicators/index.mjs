export { computeSMA, computeEMA } from './movingAverage.mjs';
export { computeMACD } from './macd.mjs';
export { computeADX } from './adx.mjs';
export { computeSupertrend } from './supertrend.mjs';
export { computeIchimoku } from './ichimoku.mjs';
export { computeRSI } from './rsi.mjs';
export { computeStochastic } from './stochastic.mjs';
export { computeCCI } from './cci.mjs';
export { computeROC } from './roc.mjs';
export { computeWilliamsR } from './williamsR.mjs';
export { computeBollinger } from './bollinger.mjs';
export { computeATR } from './atr.mjs';
export { computeKeltner } from './keltner.mjs';
export { computeOBV } from './obv.mjs';
export { computeVWAP } from './vwap.mjs';
export { computeMFI } from './mfi.mjs';
export { computeFiftyTwoWeek } from './fiftyTwoWeek.mjs';

import { computeSMA, computeEMA } from './movingAverage.mjs';
import { computeMACD } from './macd.mjs';
import { computeADX } from './adx.mjs';
import { computeSupertrend } from './supertrend.mjs';
import { computeIchimoku } from './ichimoku.mjs';
import { computeRSI } from './rsi.mjs';
import { computeStochastic } from './stochastic.mjs';
import { computeCCI } from './cci.mjs';
import { computeROC } from './roc.mjs';
import { computeWilliamsR } from './williamsR.mjs';
import { computeBollinger } from './bollinger.mjs';
import { computeATR } from './atr.mjs';
import { computeKeltner } from './keltner.mjs';
import { computeOBV } from './obv.mjs';
import { computeVWAP } from './vwap.mjs';
import { computeMFI } from './mfi.mjs';
import { computeFiftyTwoWeek } from './fiftyTwoWeek.mjs';

// Computes every indicator required by the spec for one ticker's bar series.
export function computeAllIndicators(bars) {
  return {
    'SMA(9)': computeSMA(bars, 9),
    'SMA(20)': computeSMA(bars, 20),
    'SMA(50)': computeSMA(bars, 50),
    'SMA(200)': computeSMA(bars, 200),
    'EMA(9)': computeEMA(bars, 9),
    'EMA(20)': computeEMA(bars, 20),
    'EMA(50)': computeEMA(bars, 50),
    'EMA(200)': computeEMA(bars, 200),
    MACD: computeMACD(bars),
    'ADX(14)': computeADX(bars),
    Supertrend: computeSupertrend(bars),
    Ichimoku: computeIchimoku(bars),
    'RSI(14)': computeRSI(bars),
    Stochastic: computeStochastic(bars),
    'CCI(20)': computeCCI(bars),
    'ROC(12)': computeROC(bars),
    "Williams %R": computeWilliamsR(bars),
    Bollinger: computeBollinger(bars),
    'ATR(14)': computeATR(bars),
    Keltner: computeKeltner(bars),
    OBV: computeOBV(bars),
    VWAP: computeVWAP(bars),
    'MFI(14)': computeMFI(bars),
    '52wRange': computeFiftyTwoWeek(bars),
  };
}
