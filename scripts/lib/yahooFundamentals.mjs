import { httpGet } from './http.mjs';

// Yahoo's quoteSummary endpoint (unlike the chart API used for price bars)
// requires a session cookie + crumb. Fetched once per run and reused across
// tickers; if Yahoo changes this auth flow, fundamentals fetches for
// EU/IN tickers fail loudly rather than silently returning wrong data (see
// coverage: "partial" on every record this module produces).
let sessionCache = null;

async function getSession() {
  if (sessionCache) return sessionCache;
  const cookieRes = await httpGet('https://fc.yahoo.com', { 'User-Agent': 'Mozilla/5.0' });
  const cookie = (cookieRes.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  const crumbRes = await httpGet('https://query2.finance.yahoo.com/v1/test/getcrumb', { 'User-Agent': 'Mozilla/5.0', Cookie: cookie });
  const crumb = crumbRes.body.trim();
  sessionCache = { cookie, crumb };
  return sessionCache;
}

export async function computeYahooFundamentals(ticker, yahooSymbol, currentPrice) {
  const { cookie, crumb } = await getSession();
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}`
    + `?modules=defaultKeyStatistics,financialData,summaryDetail&crumb=${encodeURIComponent(crumb)}`;
  const { status, body } = await httpGet(url, { 'User-Agent': 'Mozilla/5.0', Cookie: cookie });
  if (status !== 200) throw new Error(`HTTP ${status} for ${yahooSymbol}`);

  const json = JSON.parse(body);
  if (json.finance?.error) throw new Error(`${yahooSymbol}: ${json.finance.error.description}`);

  const result = json.quoteSummary?.result?.[0];
  if (!result) throw new Error(`${yahooSymbol}: no quoteSummary result`);

  const stats = result.defaultKeyStatistics || {};
  const financials = result.financialData || {};
  const summary = result.summaryDetail || {};

  const raw = (field) => (field && typeof field.raw === 'number' ? field.raw : null);

  return {
    ticker,
    coverage: 'partial',
    dataAvailable: true,
    valuation: { pe: raw(summary.trailingPE) ?? raw(stats.forwardPE) },
    quality: {
      roe: raw(financials.returnOnEquity),
      debtEquity: raw(financials.debtToEquity),
      piotroski: null, // needs multi-year annual statements Yahoo's quoteSummary doesn't expose
    },
    growth: {
      // Yahoo exposes trailing year-over-year growth, not a true 3y CAGR --
      // kept in the same field names for schema consistency, but this is a
      // materially different (shorter, noisier) measure than the US SEC path.
      revCagr3y: raw(financials.revenueGrowth),
      epsCagr3y: raw(financials.earningsGrowth),
    },
    note: 'growth figures are trailing YoY (Yahoo quoteSummary), not a true 3-year CAGR like the US/SEC path',
  };
}
