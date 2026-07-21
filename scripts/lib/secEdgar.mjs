import { httpGetJson } from './http.mjs';
import { computePiotroski } from '../../src/lib/fundamentals/piotroski.mjs';

// SEC requires a descriptive User-Agent identifying the requester (fair-access
// policy) -- no API key, but this header is mandatory or requests get blocked.
const USER_AGENT = 'Ticker-Claude EOD-screener (research project, contact: manish.eknath@gmail.com)';

const TAGS = {
  netIncome: { tags: ['NetIncomeLoss', 'ProfitLoss'], unit: 'USD' },
  assets: { tags: ['Assets'], unit: 'USD' },
  liabilities: { tags: ['Liabilities'], unit: 'USD' },
  currentAssets: { tags: ['AssetsCurrent'], unit: 'USD' },
  currentLiabilities: { tags: ['LiabilitiesCurrent'], unit: 'USD' },
  cashFlowOps: { tags: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'], unit: 'USD' },
  sharesOutstanding: { tags: ['CommonStockSharesOutstanding', 'CommonStockSharesIssued'], unit: 'shares' },
  revenue: { tags: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax'], unit: 'USD' },
  grossProfit: { tags: ['GrossProfit'], unit: 'USD' },
  epsDiluted: { tags: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'], unit: 'USD/shares' },
};

let cikMapCache = null;

export async function fetchTickerCikMap() {
  if (cikMapCache) return cikMapCache;
  const json = await httpGetJson('https://www.sec.gov/files/company_tickers.json', { 'User-Agent': USER_AGENT });
  const map = new Map();
  for (const entry of Object.values(json)) {
    map.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, '0'));
  }
  cikMapCache = map;
  return map;
}

export async function fetchCompanyFacts(cik) {
  return httpGetJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { 'User-Agent': USER_AGENT });
}

export async function fetchSubmissions(cik) {
  const json = await httpGetJson(`https://data.sec.gov/submissions/CIK${cik}.json`, { 'User-Agent': USER_AGENT });
  return { sic: json.sic, sicDescription: json.sicDescription, name: json.name };
}

function isAnnualDuration(entry) {
  if (!entry.start) return true; // instant (balance-sheet) fact -- no duration to check
  const days = (Date.parse(entry.end) - Date.parse(entry.start)) / 86400000;
  return days >= 350 && days <= 380;
}

// Merges across every candidate tag (by fiscal period end date) rather than
// stopping at the first tag with any data. Companies routinely switch XBRL
// tags over the years (e.g. `Revenues` -> `RevenueFromContractWithCustomer...`
// after ASC 606 adoption ~2018) -- "first non-empty tag wins" would silently
// keep only the stale tag's years and drop everything recent.
function extractAnnualSeries(facts, tagCandidates, unit) {
  const usGaap = facts?.facts?.['us-gaap'];
  if (!usGaap) return [];

  const byEnd = new Map(); // end -> { val, filed, priority }
  tagCandidates.forEach((tag, priority) => {
    const entries = usGaap[tag]?.units?.[unit];
    if (!entries) return;
    const annual = entries.filter((e) => e.form === '10-K' && isAnnualDuration(e));
    for (const e of annual) {
      const existing = byEnd.get(e.end);
      if (!existing || priority < existing.priority || (priority === existing.priority && e.filed > existing.filed)) {
        byEnd.set(e.end, { val: e.val, filed: e.filed, priority });
      }
    }
  });

  return [...byEnd.entries()]
    .map(([end, v]) => ({ end, val: v.val }))
    .sort((a, b) => b.end.localeCompare(a.end));
}

function valueAt(series, endDate) {
  const entry = series.find((e) => e.end === endDate);
  return entry ? entry.val : null;
}

// Builds a per-fiscal-year financials table, anchored on whichever end dates
// the net-income series reports (the most universally-present tag), with
// every other metric looked up at that same period end.
function buildAnnualTable(facts) {
  const series = {};
  for (const [key, { tags, unit }] of Object.entries(TAGS)) {
    series[key] = extractAnnualSeries(facts, tags, unit);
  }

  const anchorEnds = series.netIncome.map((e) => e.end);
  return anchorEnds.map((end) => ({
    end,
    netIncome: valueAt(series.netIncome, end),
    assets: valueAt(series.assets, end),
    liabilities: valueAt(series.liabilities, end),
    currentAssets: valueAt(series.currentAssets, end),
    currentLiabilities: valueAt(series.currentLiabilities, end),
    cashFlowOps: valueAt(series.cashFlowOps, end),
    sharesOutstanding: valueAt(series.sharesOutstanding, end),
    revenue: valueAt(series.revenue, end),
    grossProfit: valueAt(series.grossProfit, end),
    epsDiluted: valueAt(series.epsDiluted, end),
  }));
}

function cagr(latest, past, years) {
  if (latest === null || past === null || past <= 0 || latest <= 0) return null;
  return (latest / past) ** (1 / years) - 1;
}

export async function computeUSFundamentals(ticker, cik, currentPrice) {
  const [facts, submission] = await Promise.all([fetchCompanyFacts(cik), fetchSubmissions(cik)]);
  const annual = buildAnnualTable(facts);

  if (annual.length === 0) {
    return { ticker, coverage: 'full', dataAvailable: false, sic: submission.sic, sicDescription: submission.sicDescription };
  }

  const [latest, prior, threeYearsAgo] = [annual[0], annual[1], annual[3]];
  const pe = latest.epsDiluted && latest.epsDiluted > 0 && currentPrice ? currentPrice / latest.epsDiluted : null;
  const roe = latest.netIncome != null && latest.assets != null && latest.liabilities != null
    ? latest.netIncome / (latest.assets - latest.liabilities) : null;
  const debtEquity = latest.liabilities != null && latest.assets != null && (latest.assets - latest.liabilities) !== 0
    ? latest.liabilities / (latest.assets - latest.liabilities) : null;

  return {
    ticker,
    coverage: 'full',
    dataAvailable: true,
    sic: submission.sic,
    sicDescription: submission.sicDescription,
    fiscalYearEnd: latest.end,
    valuation: { pe },
    quality: {
      roe,
      debtEquity,
      piotroski: computePiotroski(latest, prior),
    },
    growth: {
      revCagr3y: cagr(latest.revenue, threeYearsAgo?.revenue ?? null, 3),
      epsCagr3y: cagr(latest.epsDiluted, threeYearsAgo?.epsDiluted ?? null, 3),
    },
  };
}
