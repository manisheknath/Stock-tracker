import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTickerCikMap, computeUSFundamentals } from './lib/secEdgar.mjs';
import { computeYahooFundamentals } from './lib/yahooFundamentals.mjs';
import { tickerFilename } from '../src/lib/tickerFile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UNIVERSE_PATH = path.join(ROOT, 'data', 'universe.json');
const BARS_DIR = path.join(ROOT, 'data', 'bars');
const OUT_DIR = path.join(ROOT, 'data', 'fundamentals');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const REQUEST_DELAY_MS = 200;

async function latestClose(ticker) {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(BARS_DIR, tickerFilename(ticker)), 'utf-8'));
    return raw.bars.at(-1)?.close ?? null;
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
  await fs.mkdir(OUT_DIR, { recursive: true });

  const cikMap = await fetchTickerCikMap();
  const results = [];

  for (const entry of universe.tickers) {
    const { ticker, market, yahooSymbol } = entry;
    const currentPrice = await latestClose(ticker);
    process.stdout.write(`Fetching fundamentals for ${ticker}... `);

    try {
      let fundamentals;
      if (market === 'US') {
        const symbol = ticker.replace(/\.us$/i, '').toUpperCase();
        const cik = cikMap.get(symbol);
        if (!cik) throw new Error(`no CIK found for ${symbol}`);
        fundamentals = await computeUSFundamentals(ticker, cik, currentPrice);
      } else {
        fundamentals = await computeYahooFundamentals(ticker, yahooSymbol, currentPrice);
      }
      results.push({ ticker, market, fundamentals });
      console.log(`OK - coverage=${fundamentals.coverage}, pe=${fundamentals.valuation?.pe?.toFixed(2) ?? 'n/a'}`);
    } catch (err) {
      console.log(`ERROR - ${err.message}`);
      results.push({ ticker, market, fundamentals: { ticker, coverage: market === 'US' ? 'full' : 'partial', dataAvailable: false, error: err.message } });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  // Best-effort sector-median PE: grouped by SIC among the US tickers we
  // actually have data for right now. A meaningful sector median needs the
  // full ~900-ticker universe (build step 10, not yet built) -- this is
  // documented via sectorMedianBasis on every US record.
  const usBySic = new Map();
  for (const r of results) {
    if (r.market === 'US' && r.fundamentals.sic && r.fundamentals.valuation?.pe) {
      const list = usBySic.get(r.fundamentals.sic) || [];
      list.push(r.fundamentals.valuation.pe);
      usBySic.set(r.fundamentals.sic, list);
    }
  }

  for (const r of results) {
    if (r.market === 'US' && r.fundamentals.sic) {
      const peers = usBySic.get(r.fundamentals.sic) || [];
      r.fundamentals.valuation.sectorMedianPe = median(peers);
      r.fundamentals.valuation.sectorMedianBasis = `n=${peers.length} US ticker(s) sharing SIC ${r.fundamentals.sic} in the current ${universe.tickers.length}-ticker seed universe (full sector classification arrives with the ~900-ticker universe, build step 10)`;
    }
    await fs.writeFile(path.join(OUT_DIR, tickerFilename(r.ticker)), JSON.stringify(r.fundamentals, null, 2));
  }

  const ok = results.filter((r) => r.fundamentals.dataAvailable).length;
  console.log(`\nDone: ${ok}/${results.length} fundamentals fetched successfully.`);
}

main().catch((err) => {
  console.error('Fatal error in fetch-fundamentals:', err);
  process.exit(1);
});
