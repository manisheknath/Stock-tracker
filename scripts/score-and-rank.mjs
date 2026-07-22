import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeRegime } from '../src/lib/scoring/regime.mjs';
import { computeConviction } from '../src/lib/scoring/conviction.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UNIVERSE_PATH = path.join(ROOT, 'data', 'universe.json');
const BARS_DIR = path.join(ROOT, 'data', 'bars');
const FUNDAMENTALS_DIR = path.join(ROOT, 'data', 'fundamentals');
const STRATEGY_HEALTH_PATH = path.join(ROOT, 'data', 'strategy-health.json');
const OUT_PATH = path.join(ROOT, 'data', 'signals.json');

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function main() {
  const universe = JSON.parse(await fs.readFile(UNIVERSE_PATH, 'utf-8'));
  const strategyHealth = await readJsonIfExists(STRATEGY_HEALTH_PATH);
  const today = new Date().toISOString().slice(0, 10);

  const barsByTicker = new Map();
  const fundamentalsByTicker = new Map();
  for (const t of universe.tickers) {
    const raw = await readJsonIfExists(path.join(BARS_DIR, `${t.ticker}.json`));
    if (raw) barsByTicker.set(t.ticker, raw);
    const fundamentals = await readJsonIfExists(path.join(FUNDAMENTALS_DIR, `${t.ticker}.json`));
    if (fundamentals) fundamentalsByTicker.set(t.ticker, fundamentals);
  }

  const markets = [...new Set(universe.tickers.map((t) => t.market))];
  const regimeByMarket = new Map();
  const marketMedianPeByMarket = new Map();
  for (const market of markets) {
    const marketTickers = universe.tickers.filter((t) => t.market === market);
    const tickersData = marketTickers
      .map((t) => ({ ticker: t.ticker, bars: barsByTicker.get(t.ticker)?.bars }))
      .filter((t) => t.bars);
    regimeByMarket.set(market, computeRegime(market, tickersData));

    const pes = marketTickers
      .map((t) => fundamentalsByTicker.get(t.ticker)?.valuation?.pe)
      .filter((pe) => typeof pe === 'number' && pe > 0);
    marketMedianPeByMarket.set(market, median(pes));
  }

  const signals = [];
  for (const entry of universe.tickers) {
    const { ticker, name, market } = entry;
    const barsData = barsByTicker.get(ticker);
    if (!barsData) {
      console.log(`${ticker}: SKIPPED -- no bars available`);
      continue;
    }

    const fundamentals = fundamentalsByTicker.get(ticker) ?? null;
    const regime = regimeByMarket.get(market);
    const marketStrategyHealth = strategyHealth?.markets?.[market] ?? null;
    const marketMedianPe = marketMedianPeByMarket.get(market) ?? null;

    try {
      const result = computeConviction({ bars: barsData.bars, fundamentals, regime, marketStrategyHealth, marketMedianPe });
      signals.push({
        ticker, name, market,
        asOf: today,
        lastBarDate: barsData.bars.at(-1).date,
        currency: barsData.currency,
        close: barsData.bars.at(-1).close,
        signal: result.signal,
        conviction: result.conviction,
        horizon: result.horizon,
        evidence: result.evidence,
        risk: result.risk,
        dataQuality: {
          barsAvailable: barsData.dataQuality?.barsAvailable ?? barsData.bars.length,
          gaps: barsData.dataQuality?.gaps ?? null,
          fundamentalSource: fundamentals?.coverage === 'full' ? 'sec_edgar' : fundamentals?.coverage === 'partial' ? 'yahoo_partial' : 'unavailable',
        },
      });
      console.log(`${ticker}: ${result.signal} conviction=${result.conviction} horizon=${result.horizon}`);
    } catch (err) {
      console.log(`${ticker}: ERROR -- ${err.message}`);
    }
  }

  signals.sort((a, b) => b.conviction - a.conviction);

  const output = {
    generatedAt: new Date().toISOString(),
    asOf: today,
    weights: { technical: 0.40, pattern: 0.25, strategy_edge: 0.20, fundamental: 0.15 },
    regimes: Object.fromEntries(regimeByMarket),
    signals,
  };

  await fs.writeFile(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWritten ${signals.length} ranked signals to data/signals.json`);
}

main().catch((err) => {
  console.error('Fatal error in score-and-rank:', err);
  process.exit(1);
});
