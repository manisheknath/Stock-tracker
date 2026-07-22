import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPortfolioBacktest } from '../src/lib/backtest/engine.mjs';
import { WALK_FORWARD_WINDOWS } from '../src/lib/backtest/windows.mjs';
import { STRATEGIES, PENDING_STRATEGIES } from '../src/lib/backtest/strategies/index.mjs';
import { tickerFilename } from '../src/lib/tickerFile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UNIVERSE_PATH = path.join(ROOT, 'data', 'universe.json');
const BARS_DIR = path.join(ROOT, 'data', 'bars');
const FUNDAMENTALS_DIR = path.join(ROOT, 'data', 'fundamentals');
const OUT_PATH = path.join(ROOT, 'data', 'strategy-health.json');

const pct = (v) => `${(v * 100).toFixed(2)}%`;

async function loadMarketBars(tickers) {
  const out = [];
  for (const t of tickers) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(BARS_DIR, tickerFilename(t.ticker)), 'utf-8'));
      let fundamentals = null;
      try {
        fundamentals = JSON.parse(await fs.readFile(path.join(FUNDAMENTALS_DIR, tickerFilename(t.ticker)), 'utf-8'));
      } catch {
        // fundamentals not fetched yet for this ticker -- strategies handle null gracefully
      }
      out.push({ ticker: t.ticker, bars: raw.bars, fundamentals });
    } catch {
      // ticker has no fetched bars yet -- skip rather than fail the whole market
    }
  }
  return out;
}

async function main() {
  const universe = JSON.parse(await fs.readFile(UNIVERSE_PATH, 'utf-8'));
  const markets = [...new Set(universe.tickers.map((t) => t.market))];

  const report = { generatedAt: new Date().toISOString(), windows: WALK_FORWARD_WINDOWS, markets: {}, pendingStrategies: PENDING_STRATEGIES };

  for (const market of markets) {
    const tickers = universe.tickers.filter((t) => t.market === market);
    const tickersData = await loadMarketBars(tickers);
    if (tickersData.length === 0) continue;

    console.log(`\n=== ${market} (${tickersData.length} tickers) ===`);
    report.markets[market] = {};

    for (const strategy of STRATEGIES) {
      const windowResults = {};
      for (const [windowName, window] of Object.entries(WALK_FORWARD_WINDOWS)) {
        const result = runPortfolioBacktest({ tickersData, strategy, window });
        windowResults[windowName] = {
          cagr: result.cagr, sharpe: result.sharpe, maxDrawdown: result.maxDrawdown,
          winRate: result.winRate, profitFactor: result.profitFactor,
          expectancy: result.expectancy, tradeCount: result.tradeCount,
          equityCurve: result.equityCurve,
        };
      }

      const testEligible = windowResults.test.tradeCount > 0 && windowResults.test.cagr > 0;
      report.markets[market][strategy.name] = {
        ...windowResults,
        liveEligible: testEligible,
        ...(strategy.caveat ? { caveat: strategy.caveat } : {}),
      };

      console.log(`\n${strategy.name}${testEligible ? '' : '  [GREYED -- not test-profitable]'}`);
      for (const [windowName, m] of Object.entries(windowResults)) {
        console.log(`  ${windowName.padEnd(9)} CAGR ${pct(m.cagr).padStart(8)}  Sharpe ${m.sharpe.toFixed(2).padStart(6)}  maxDD ${pct(m.maxDrawdown).padStart(8)}  winRate ${pct(m.winRate).padStart(7)}  PF ${Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : '∞'.padStart(5)}  trades ${String(m.tradeCount).padStart(4)}`);
      }
    }
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nWritten to data/strategy-health.json`);
}

main().catch((err) => {
  console.error('Fatal error in run-backtest:', err);
  process.exit(1);
});
