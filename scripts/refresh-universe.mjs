import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchHtml, extractTableById, findColumnIndex } from './lib/htmlTable.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'universe.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Wikipedia tables for CAC40/DAX/AEX/IBEX35 already embed the Yahoo suffix in
// their ticker column (e.g. "AC.PA"); FTSE100/NIFTY50/NIFTYNext50 give bare
// exchange tickers that need one appended. US tickers take no suffix at all.
const WIKI_SOURCES = [
  {
    market: 'US', index: 'SP500', url: 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies',
    tableId: 'constituents', tickerCandidates: ['symbol'], nameCandidates: ['security', 'company'],
    yahooSuffix: null, embedsSuffix: false,
  },
  {
    market: 'UK', index: 'FTSE100', url: 'https://en.wikipedia.org/wiki/FTSE_100_Index',
    tableId: 'constituents', tickerCandidates: ['ticker'], nameCandidates: ['company'],
    yahooSuffix: '.L', embedsSuffix: false,
  },
  {
    market: 'FR', index: 'CAC40', url: 'https://en.wikipedia.org/wiki/CAC_40',
    tableId: 'constituents', tickerCandidates: ['ticker'], nameCandidates: ['company'],
    yahooSuffix: '.PA', embedsSuffix: true,
  },
  {
    market: 'DE', index: 'DAX40', url: 'https://en.wikipedia.org/wiki/DAX',
    tableId: 'constituents', tickerCandidates: ['ticker'], nameCandidates: ['company'],
    yahooSuffix: '.DE', embedsSuffix: true,
  },
  {
    market: 'NL', index: 'AEX', url: 'https://en.wikipedia.org/wiki/AEX_index',
    tableId: 'constituents', tickerCandidates: ['ticker'], nameCandidates: ['company'],
    yahooSuffix: '.AS', embedsSuffix: true,
  },
  {
    market: 'ES', index: 'IBEX35', url: 'https://en.wikipedia.org/wiki/IBEX_35',
    tableId: 'components', tickerCandidates: ['ticker'], nameCandidates: ['company'],
    yahooSuffix: '.MC', embedsSuffix: true,
  },
  {
    market: 'IN', index: 'NIFTY50', url: 'https://en.wikipedia.org/wiki/NIFTY_50',
    tableId: 'constituents', tickerCandidates: ['symbol'], nameCandidates: ['company name', 'company'],
    yahooSuffix: '.NS', embedsSuffix: false,
  },
  {
    market: 'IN', index: 'NIFTYNEXT50', url: 'https://en.wikipedia.org/wiki/NIFTY_Next_50',
    tableId: 'constituents', tickerCandidates: ['symbol'], nameCandidates: ['company name', 'company'],
    yahooSuffix: '.NS', embedsSuffix: false,
  },
];

function scrapeWikiSource(html, source) {
  const table = extractTableById(html, source.tableId);
  if (!table) throw new Error(`no table#${source.tableId} found on ${source.url}`);

  const tickerCol = findColumnIndex(table.headers, source.tickerCandidates);
  const nameCol = findColumnIndex(table.headers, source.nameCandidates);
  if (tickerCol === -1 || nameCol === -1) {
    throw new Error(`couldn't locate ticker/name columns on ${source.url} (headers: ${table.headers.join(', ')})`);
  }

  return table.rows
    .filter((row) => row[tickerCol] && row[nameCol])
    .map((row) => {
      const rawTicker = row[tickerCol].trim().replace(/\.$/, ''); // strip stray trailing dot (e.g. "BP.")

      let yahooSymbol;
      let bareSymbol;
      if (source.embedsSuffix) {
        // Some constituents are cross-listed under a different exchange's
        // suffix than the index's home market (e.g. ArcelorMittal appears in
        // CAC40 as "MT.AS", not "MT.PA") -- strip whichever suffix is
        // actually present rather than assuming the source's own.
        yahooSymbol = rawTicker;
        const dotIndex = rawTicker.lastIndexOf('.');
        bareSymbol = dotIndex === -1 ? rawTicker : rawTicker.slice(0, dotIndex);
      } else {
        // Dual-class US/UK tickers use a literal dot (e.g. "BRK.B", "BT.A")
        // that Yahoo represents with a hyphen instead ("BRK-B", "BT-A.L").
        // Converting here also keeps our own ticker id unambiguous -- a dot
        // inside the bare symbol would otherwise be indistinguishable from
        // the market-suffix separator.
        bareSymbol = rawTicker.replace(/\./g, '-');
        yahooSymbol = `${bareSymbol}${source.yahooSuffix ?? ''}`;
      }

      return {
        ticker: `${bareSymbol}.${source.market.toLowerCase()}`,
        // Strip trailing Wikipedia language-link annotations like "[ es ]"
        name: row[nameCol].trim().replace(/\s*\[\s*[a-z]{2,3}\s*\]\s*$/i, ''),
        market: source.market,
        index: source.index,
        yahooSymbol,
      };
    });
}

// Nasdaq-100's own Wikipedia page no longer carries an inline constituents
// table (just links out to Nasdaq's site) -- stockanalysis.com's
// server-rendered list is used as a documented fallback for this one index.
async function scrapeNasdaq100() {
  const html = await fetchHtml('https://stockanalysis.com/list/nasdaq-100-stocks/');
  const tickers = [...html.matchAll(/<td class="sym[^"]*">(?:<!---->)?<a href="\/stocks\/[^"]+\/">([A-Z0-9.\-]+)<\/a>/g)].map((m) => m[1]);
  const names = [...html.matchAll(/<td class="slw[^"]*">([^<]+)<\/td>/g)].map((m) => m[1].trim());
  if (tickers.length === 0 || tickers.length !== names.length) {
    throw new Error(`Nasdaq-100 fallback scrape mismatch: ${tickers.length} tickers vs ${names.length} names`);
  }
  return tickers.map((ticker, i) => ({
    ticker: `${ticker}.us`, name: names[i], market: 'US', index: 'NASDAQ100', yahooSymbol: ticker,
  }));
}

async function main() {
  const all = [];

  for (const source of WIKI_SOURCES) {
    process.stdout.write(`Scraping ${source.index} (${source.market}) from Wikipedia... `);
    try {
      const html = await fetchHtml(source.url);
      const entries = scrapeWikiSource(html, source);
      all.push(...entries);
      console.log(`OK - ${entries.length} tickers`);
    } catch (err) {
      console.log(`ERROR - ${err.message}`);
    }
    await sleep(300);
  }

  process.stdout.write('Scraping NASDAQ100 (US) from stockanalysis.com fallback... ');
  try {
    const entries = await scrapeNasdaq100();
    all.push(...entries);
    console.log(`OK - ${entries.length} tickers`);
  } catch (err) {
    console.log(`ERROR - ${err.message}`);
  }

  // Dedupe by yahooSymbol -- a company can legitimately sit in two indices
  // (e.g. many Nasdaq-100 names are also in the S&P 500). First occurrence
  // wins; its `index` tag reflects whichever source was scraped first.
  const seen = new Map();
  for (const entry of all) {
    if (!seen.has(entry.yahooSymbol)) seen.set(entry.yahooSymbol, entry);
  }
  const deduped = [...seen.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));

  const output = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'wikipedia-weekly-scrape (Nasdaq-100 via stockanalysis.com fallback -- see refresh-universe.mjs)',
    tickers: deduped,
  };

  await fs.writeFile(OUT_PATH, JSON.stringify(output, null, 2));

  const byMarket = {};
  for (const t of deduped) byMarket[t.market] = (byMarket[t.market] || 0) + 1;
  console.log(`\nWritten ${deduped.length} tickers to data/universe.json`);
  console.log('By market:', JSON.stringify(byMarket));
}

main().catch((err) => {
  console.error('Fatal error in refresh-universe:', err);
  process.exit(1);
});
