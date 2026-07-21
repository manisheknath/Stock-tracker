import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchYahooDaily } from './lib/yahoo.mjs';
import { adjustAndValidate } from './lib/adjust.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UNIVERSE_PATH = path.join(ROOT, 'data', 'universe.json');
const BARS_DIR = path.join(ROOT, 'data', 'bars');
const LOG_PATH = path.join(ROOT, 'data', 'fetch-log.json');

const REQUEST_DELAY_MS = 300;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const universe = JSON.parse(await fs.readFile(UNIVERSE_PATH, 'utf-8'));
  await fs.mkdir(BARS_DIR, { recursive: true });

  const log = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const entry of universe.tickers) {
    const { ticker, name, market, yahooSymbol } = entry;
    process.stdout.write(`Fetching ${ticker} (${yahooSymbol})... `);

    try {
      const raw = await fetchYahooDaily(yahooSymbol);
      const result = adjustAndValidate(ticker, raw);

      if (result.excluded) {
        console.log(`EXCLUDED - ${result.reason}`);
        log.push({ ticker, market, status: 'excluded', reason: result.reason, flags: result.flags });
      } else {
        const outPath = path.join(BARS_DIR, `${ticker}.json`);
        const output = {
          ticker,
          name,
          market,
          yahooSymbol,
          asOf: today,
          currency: result.meta.currency,
          exchange: result.meta.exchange,
          bars: result.bars,
          corporateActions: result.corporateActions,
          dataQuality: result.dataQuality,
        };
        await fs.writeFile(outPath, JSON.stringify(output, null, 2));
        console.log(`OK - ${result.dataQuality.barsAvailable} bars, ${result.dataQuality.gaps} gaps`);
        log.push({
          ticker,
          market,
          status: 'ok',
          barsAvailable: result.dataQuality.barsAvailable,
          gaps: result.dataQuality.gaps,
        });
      }
    } catch (err) {
      console.log(`ERROR - ${err.message}`);
      log.push({ ticker, market, status: 'error', reason: err.message });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  await fs.writeFile(LOG_PATH, JSON.stringify({ ranAt: new Date().toISOString(), results: log }, null, 2));

  const ok = log.filter((l) => l.status === 'ok').length;
  const excluded = log.filter((l) => l.status === 'excluded').length;
  const errored = log.filter((l) => l.status === 'error').length;
  console.log(`\nDone: ${ok} ok, ${excluded} excluded, ${errored} errored. Log written to data/fetch-log.json`);
}

main().catch((err) => {
  console.error('Fatal error in fetch-bars:', err);
  process.exit(1);
});
