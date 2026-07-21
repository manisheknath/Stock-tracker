# EOD Signal Screener

Static, zero-cost end-of-day stock signal screener. No backend, no API keys, no build step.

- **Data**: GitHub Actions runs nightly (22:00 UTC), fetches EOD bars, computes indicators/patterns/backtests/fundamentals, scores and ranks signals, commits static JSON to `/data`.
- **Frontend**: vanilla JS ES modules + Tailwind CDN + Lightweight Charts, reading the static `/data` JSON directly. No `innerHTML` on fetched data.
- **Universe**: ~900 tickers across US (S&P 500 + Nasdaq 100), UK (FTSE 100), France (CAC 40), Germany (DAX 40), Netherlands (AEX), Spain (IBEX 35), and India (NIFTY 50 + NIFTY Next 50) — scraped weekly from Wikipedia (Nasdaq-100 via a stockanalysis.com fallback since Wikipedia dropped its own inline constituents table).
- **Price data**: Yahoo Finance's public chart API — no key required. (Stooq was the original plan but sits behind an IP-reputation-based anti-bot wall that blocks datacenter IPs, including GitHub Actions runners.)
- **Fundamentals**: SEC EDGAR XBRL company facts for US (official, free, unlimited — `coverage: "full"`); Yahoo's `quoteSummary` endpoint for EU/IN (`coverage: "partial"`, explicitly flagged, growth figures are trailing YoY not a true 3y CAGR).

## Status

Build steps 1-10 complete (see project notes for the full build order):

1. Repo scaffold + Pages shell
2. Yahoo bar fetcher + split/dividend adjustment + >40%-unexplained-move corruption assertion
3. Indicator library (24 instances across 18 families), tested against synthetic references + live TradingView values
4. Pivot detection + 10 candlestick patterns
5. 9 chart patterns expressed as pivot sequences (Double Top/Bottom, H&S, triangles, Cup & Handle, Flag/Pennant, wedges, rectangle)
6. Walk-forward backtest engine (train 2020-2022 / validate 2023 / test 2024-2025) + 6 of 7 spec'd strategies (Value + 12m Momentum deferred — needs fundamentals)
7. Fundamentals stage (SEC EDGAR + Yahoo quoteSummary)
8. Regime detection (per-market breadth) + conviction scoring + `signals.json`
9. UI: signal table, detail drawer, strategy health page
10. Scaled ticker universe to ~900 (Wikipedia scraper); nightly Actions workflow runs incremental bar fetches + backtest + scoring every night, full universe/bar/fundamentals refresh weekly (Sundays)

Not yet done: "Value + 12m Momentum" strategy (blocked on fundamentals being wired into a value filter), and the spec's "monthly history squash" for repo size — that needs a force-push-style history rewrite on `main`, which wants an explicit decision rather than living inside an unattended cron job.

## Layout

```
index.html                    static shell, Tailwind CDN, dark theme, Lightweight Charts CDN
src/app.js                    frontend entry point
src/ui/                       table, detail drawer, strategy health page, DOM/format helpers
src/lib/indicators/           24 indicator instances, portable (Node + browser)
src/lib/patterns/             pivot detection + candlestick/chart pattern detectors, portable
src/lib/backtest/             walk-forward engine, metrics, 6 strategies, portable
src/lib/scoring/              regime, technical/pattern/strategy/fundamental scoring, conviction combiner
src/lib/fundamentals/         Piotroski F-Score (pure calculation)

data/universe.json             ~900-ticker universe (weekly Wikipedia scrape)
data/bars/{ticker}.json        adjusted daily bars
data/fundamentals/{ticker}.json fundamentals per ticker
data/strategy-health.json      per-strategy per-market train/validate/test metrics
data/signals.json              ranked signals with full evidence chain

scripts/refresh-universe.mjs   pipeline stage: scrape Wikipedia (+ stockanalysis.com fallback) for constituents
scripts/fetch-bars.mjs         pipeline stage: fetch + adjust + corruption-assert (incremental or full via FULL_REFETCH)
scripts/fetch-fundamentals.mjs pipeline stage: SEC EDGAR (US) / Yahoo quoteSummary (EU/IN)
scripts/run-backtest.mjs       pipeline stage: walk-forward backtest, all strategies x markets x windows
scripts/score-and-rank.mjs     pipeline stage: regime + conviction scoring -> signals.json
scripts/lib/                   Node-only fetch clients (Yahoo, SEC EDGAR, Wikipedia/HTML table scraper, http)
scripts/dev-server.mjs         zero-dependency static file server for local testing only
```

No dependencies — scripts use Node's built-in `https`/`fs` modules only; the frontend uses Tailwind and Lightweight Charts via CDN `<script>` tags (both named in the original spec).
