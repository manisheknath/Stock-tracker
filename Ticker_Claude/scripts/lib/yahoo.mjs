import https from 'node:https';

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('request timed out')));
  });
}

function toISODate(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Fetches 5y daily bars for a Yahoo chart symbol, plus split/dividend events.
 * Throws on network/HTTP failure or malformed payload; callers decide how to record that.
 */
export async function fetchYahooDaily(yahooSymbol, { rangeYears = 5 } = {}) {
  const url = `${BASE}${encodeURIComponent(yahooSymbol)}?range=${rangeYears}y&interval=1d&events=div,splits`;
  const { status, body } = await httpGet(url);
  if (status !== 200) {
    throw new Error(`HTTP ${status} for ${yahooSymbol}`);
  }

  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`non-JSON response for ${yahooSymbol}`);
  }

  const result = json?.chart?.result?.[0];
  if (!result) {
    const errMsg = json?.chart?.error?.description || 'no result in chart response';
    throw new Error(`${yahooSymbol}: ${errMsg}`);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const adjcloseArr = result.indicators?.adjclose?.[0]?.adjclose || [];

  const bars = timestamps.map((ts, i) => ({
    date: toISODate(ts),
    open: quote.open?.[i] ?? null,
    high: quote.high?.[i] ?? null,
    low: quote.low?.[i] ?? null,
    close: quote.close?.[i] ?? null,
    adjClose: adjcloseArr[i] ?? null,
    volume: quote.volume?.[i] ?? null,
  })).filter((bar) => bar.close !== null);

  const splits = Object.values(result.events?.splits || {}).map((s) => ({
    date: toISODate(s.date),
    numerator: s.numerator,
    denominator: s.denominator,
    ratio: s.splitRatio,
  }));

  const dividends = Object.values(result.events?.dividends || {}).map((d) => ({
    date: toISODate(d.date),
    amount: d.amount,
  }));

  return {
    meta: {
      currency: result.meta.currency,
      exchange: result.meta.fullExchangeName,
      timezone: result.meta.exchangeTimezoneName,
    },
    bars,
    corporateActions: { splits, dividends },
  };
}
