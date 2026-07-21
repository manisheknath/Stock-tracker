# EOD Signal Screener

Static, zero-cost end-of-day stock signal screener. No backend, no API keys, no build step.

- **Data**: GitHub Actions runs nightly, fetches EOD bars, computes indicators/patterns/backtests, commits JSON to `/data`.
- **Frontend**: vanilla JS ES modules + Tailwind CDN + Lightweight Charts, reading the static `/data` JSON directly.
- **Data source**: Yahoo Finance's public chart API (`query1.finance.yahoo.com/v8/finance/chart/{symbol}`) — no key required. (Stooq was the original plan but now sits behind an IP-reputation-based anti-bot wall that blocks datacenter IPs, including GitHub Actions runners.)

## Status

Build steps 1-2 complete: repo scaffold, empty UI shell, and the bar fetcher/adjustment stage against a hand-seeded 20-ticker universe (`data/universe.json`). See build order in project notes for what's next.

## Layout

```
index.html            static shell, Tailwind CDN, dark theme
src/app.js             vanilla ES module frontend
data/universe.json      ticker universe (hand-seeded 20 for now; scraped ~900 later)
data/bars/{ticker}.json adjusted daily bars per ticker
data/fetch-log.json     per-run fetch/adjustment outcomes
scripts/fetch-bars.mjs  pipeline stage: fetch + adjust + corruption-assert
scripts/lib/yahoo.mjs   Yahoo chart API client
scripts/lib/adjust.mjs  split/dividend adjustment + >40% unexplained-jump assertion
```

No dependencies — scripts use Node's built-in `https`/`fs` modules only.
