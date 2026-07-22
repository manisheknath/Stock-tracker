import { el } from './dom.mjs';
import { marketFlag, SIGNAL_STYLES, formatPct, formatNumber, formatPrice } from './format.mjs';
import { computeRSI } from '../lib/indicators/rsi.mjs';
import { computeMACD } from '../lib/indicators/macd.mjs';
import { computeADX } from '../lib/indicators/adx.mjs';
import { tickerFilename } from '../lib/tickerFile.mjs';

const OVERLAY_COLORS = {
  target: '#34d399', invalidation: '#fb7185', neckline: '#fbbf24',
  resistance: '#fbbf24', support: '#fbbf24', upperTrendline: '#fbbf24', lowerTrendline: '#fbbf24',
};

function toChartTime(dateStr) {
  return dateStr; // 'YYYY-MM-DD' -- Lightweight Charts accepts business-day strings directly
}

function renderCandlestickChart(container, bars, pattern, risk) {
  const chart = window.LightweightCharts.createChart(container, {
    width: container.clientWidth, height: 320,
    layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
    grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
    timeScale: { borderColor: '#334155' },
    rightPriceScale: { borderColor: '#334155' },
  });
  const series = chart.addCandlestickSeries({
    upColor: '#34d399', downColor: '#fb7185', borderVisible: false,
    wickUpColor: '#34d399', wickDownColor: '#fb7185',
  });
  series.setData(bars.map((b) => ({ time: toChartTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close })));

  if (pattern?.keyLevels) {
    for (const [key, value] of Object.entries(pattern.keyLevels)) {
      if (typeof value !== 'number') continue;
      series.createPriceLine({
        price: value,
        color: OVERLAY_COLORS[key] ?? '#64748b',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: key,
      });
    }
  }

  // Trade levels as solid overlay lines. When a pattern already drew its own
  // target, this still adds entry + stop; when there's no pattern at all,
  // these are the only overlays -- so every directional signal shows its
  // actionable levels on the chart, not just the minority with a pattern.
  if (risk) {
    const levels = [
      { price: risk.suggestedEntry, color: '#94a3b8', title: 'entry' },
      { price: risk.suggestedStop, color: '#fb7185', title: 'stop' },
      { price: risk.target, color: '#34d399', title: 'target' },
    ];
    for (const { price, color, title } of levels) {
      if (typeof price !== 'number') continue;
      series.createPriceLine({ price, color, lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title });
    }
  }

  chart.timeScale().fitContent();
  return chart;
}

function renderLineSubpane(container, label, series1, series2) {
  const chart = window.LightweightCharts.createChart(container, {
    width: container.clientWidth, height: 100,
    layout: { background: { color: 'transparent' }, textColor: '#94a3b8', fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { color: '#1e293b' } },
    timeScale: { borderColor: '#334155', visible: false },
    rightPriceScale: { borderColor: '#334155' },
  });
  const line1 = chart.addLineSeries({ color: '#60a5fa', lineWidth: 1 });
  line1.setData(series1);
  if (series2) {
    const line2 = chart.addLineSeries({ color: '#fbbf24', lineWidth: 1 });
    line2.setData(series2);
  }
  chart.timeScale().fitContent();
  return chart;
}

function seriesFromValues(bars, values, pick = (v) => v) {
  return bars
    .map((b, i) => ({ time: toChartTime(b.date), value: values[i] }))
    .filter((p) => p.value !== null && p.value !== undefined)
    .map((p) => ({ time: p.time, value: pick(p.value) }));
}

function fundamentalScorecard(fundamental) {
  const row = (label, value) => el('div', { className: 'flex justify-between py-1 text-sm border-b border-slate-800/60' }, [
    el('span', { className: 'text-slate-400' }, [label]),
    el('span', { className: 'tabular-nums' }, [value]),
  ]);

  return el('div', { className: 'grid grid-cols-1 gap-1' }, [
    row('P/E', formatNumber(fundamental.valuation?.pe)),
    row('Sector median P/E', fundamental.valuation?.sectorMedianPe != null ? formatNumber(fundamental.valuation.sectorMedianPe) : 'n/a'),
    row('Valuation verdict', fundamental.valuation?.verdict ?? 'n/a'),
    row('ROE', fundamental.quality?.roe != null ? formatPct(fundamental.quality.roe * 100) : 'n/a'),
    row('Debt/Equity', formatNumber(fundamental.quality?.debtEquity)),
    row('Piotroski F-Score', fundamental.quality?.piotroski != null ? `${fundamental.quality.piotroski}/9` : 'n/a'),
    row('Revenue CAGR (3y)', fundamental.growth?.revCagr3y != null ? formatPct(fundamental.growth.revCagr3y * 100) : 'n/a'),
    row('EPS CAGR (3y)', fundamental.growth?.epsCagr3y != null ? formatPct(fundamental.growth.epsCagr3y * 100) : 'n/a'),
    row('Coverage', fundamental.coverage ?? 'n/a'),
    ...(fundamental.note ? [el('p', { className: 'text-xs text-amber-400/80 mt-2' }, [fundamental.note])] : []),
  ]);
}

function equityCurveChart(container, equityCurve) {
  const chart = window.LightweightCharts.createChart(container, {
    width: container.clientWidth, height: 160,
    layout: { background: { color: 'transparent' }, textColor: '#94a3b8', fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { color: '#1e293b' } },
    timeScale: { borderColor: '#334155' },
    rightPriceScale: { borderColor: '#334155' },
  });
  const line = chart.addLineSeries({ color: '#34d399', lineWidth: 2 });
  line.setData(equityCurve.map((p) => ({ time: toChartTime(p.date), value: p.equity })));
  chart.timeScale().fitContent();
  return chart;
}

export async function openDrawer({ signal, drawerEl, backdropEl, strategyHealth }) {
  drawerEl.replaceChildren(el('div', { className: 'p-6 text-slate-400 text-sm' }, ['Loading...']));
  backdropEl.classList.remove('hidden');
  drawerEl.classList.remove('translate-x-full');

  const res = await fetch(`./data/bars/${tickerFilename(signal.ticker)}`);
  const barsData = await res.json();
  const bars = barsData.bars;

  const style = SIGNAL_STYLES[signal.signal] ?? SIGNAL_STYLES.HOLD;
  const primaryPattern = signal.evidence?.patterns?.[0];

  const header = el('div', { className: 'flex items-start justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10' }, [
    el('div', {}, [
      el('div', { className: 'flex items-center gap-2' }, [
        el('h2', { className: 'text-xl font-semibold' }, [signal.ticker]),
        el('span', { className: `inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${style.classes}` }, [style.label]),
      ]),
      el('p', { className: 'text-sm text-slate-400 mt-0.5' }, [`${signal.name} · ${marketFlag(signal.market)} ${signal.market} · close ${formatPrice(signal.close, signal.currency)} · conviction ${signal.conviction}`]),
    ]),
    el('button', { className: 'text-slate-400 hover:text-slate-100 text-xl leading-none px-2', onclick: () => closeDrawer(drawerEl, backdropEl) }, ['×']),
  ]);

  const chartSection = el('section', { className: 'p-5' }, [
    el('h3', { className: 'text-sm font-medium text-slate-300 mb-2' }, ['Price']),
    el('div', { className: 'chart-candles' }),
    ...(primaryPattern ? [el('p', { className: 'text-xs text-slate-400 mt-2' }, [`${primaryPattern.pattern} (${primaryPattern.direction}, confidence ${primaryPattern.confidence}): ${primaryPattern.description}`])] : []),
  ]);

  const risk = signal.risk ?? {};
  const tradeLevelRow = (label, value, colorClass) => el('div', { className: 'flex justify-between py-1 text-sm border-b border-slate-800/60' }, [
    el('span', { className: `${colorClass}` }, [label]),
    el('span', { className: 'tabular-nums' }, [value != null ? formatPrice(value, signal.currency) : 'n/a']),
  ]);
  const tradeLevelsSection = el('section', { className: 'p-5 border-t border-slate-800' }, [
    el('h3', { className: 'text-sm font-medium text-slate-300 mb-2' }, ['Trade levels']),
    signal.signal === 'HOLD'
      ? el('p', { className: 'text-xs text-slate-500' }, ['No directional signal — entry/stop/target apply to BUY/SELL signals only.'])
      : el('div', {}, [
        tradeLevelRow('Suggested entry (next open)', risk.suggestedEntry, 'text-slate-400'),
        tradeLevelRow('Suggested stop (2× ATR)', risk.suggestedStop, 'text-rose-400'),
        tradeLevelRow('Target', risk.target, 'text-emerald-400'),
        el('p', { className: 'text-xs text-slate-500 mt-2' }, [
          `ATR(14) ${formatPrice(risk.atr14, signal.currency)} · ${risk.distanceToStopPct != null ? formatPct(risk.distanceToStopPct) : 'n/a'} to stop · ${risk.liquidityOk ? 'liquidity OK' : 'thin liquidity'}`,
        ]),
      ]),
  ]);

  const rsiValues = computeRSI(bars, 14).values;
  const macdValues = computeMACD(bars).values;
  const adxValues = computeADX(bars, 14).values.map((v) => v?.adx ?? null);

  const indicatorSection = el('section', { className: 'p-5 border-t border-slate-800 grid grid-cols-1 gap-4' }, [
    el('div', {}, [el('h4', { className: 'text-xs font-medium text-slate-400 mb-1' }, ['RSI(14)']), el('div', { className: 'chart-rsi' })]),
    el('div', {}, [el('h4', { className: 'text-xs font-medium text-slate-400 mb-1' }, ['MACD']), el('div', { className: 'chart-macd' })]),
    el('div', {}, [el('h4', { className: 'text-xs font-medium text-slate-400 mb-1' }, ['ADX(14)']), el('div', { className: 'chart-adx' })]),
  ]);

  const fundamentalSection = el('section', { className: 'p-5 border-t border-slate-800' }, [
    el('h3', { className: 'text-sm font-medium text-slate-300 mb-2' }, ['Fundamental scorecard']),
    fundamentalScorecard(signal.evidence?.fundamental ?? {}),
  ]);

  const triggeringStrategy = signal.evidence?.strategies?.[0];
  const strategySection = el('section', { className: 'p-5 border-t border-slate-800 pb-10' }, [
    el('h3', { className: 'text-sm font-medium text-slate-300 mb-2' }, ['Strategy test-window equity curve']),
    triggeringStrategy
      ? el('div', {}, [
        el('p', { className: 'text-xs text-slate-400 mb-2' }, [`${triggeringStrategy.name} — test CAGR ${formatPct(triggeringStrategy.testCagr * 100)}, Sharpe ${formatNumber(triggeringStrategy.testSharpe)}, win rate ${formatPct(triggeringStrategy.winRate * 100, 0)}, ${triggeringStrategy.tradeCount} trades`]),
        el('div', { className: 'chart-equity' }),
      ])
      : el('p', { className: 'text-xs text-slate-500' }, ['No live-eligible strategy is currently triggered on this ticker.']),
  ]);

  drawerEl.replaceChildren(header, chartSection, tradeLevelsSection, indicatorSection, fundamentalSection, strategySection);

  renderCandlestickChart(drawerEl.querySelector('.chart-candles'), bars, primaryPattern, signal.risk);
  renderLineSubpane(drawerEl.querySelector('.chart-rsi'), 'RSI', seriesFromValues(bars, rsiValues));
  renderLineSubpane(drawerEl.querySelector('.chart-macd'), 'MACD', seriesFromValues(bars, macdValues, (v) => v.histogram));
  renderLineSubpane(drawerEl.querySelector('.chart-adx'), 'ADX', seriesFromValues(bars, adxValues));

  if (triggeringStrategy) {
    const market = strategyHealth?.markets?.[signal.market];
    const strategyData = market?.[triggeringStrategy.name];
    if (strategyData?.test?.equityCurve) {
      equityCurveChart(drawerEl.querySelector('.chart-equity'), strategyData.test.equityCurve);
    }
  }
}

export function closeDrawer(drawerEl, backdropEl) {
  drawerEl.classList.add('translate-x-full');
  backdropEl.classList.add('hidden');
}
