import { el } from './dom.mjs';
import { formatPct, formatNumber } from './format.mjs';

const WINDOWS = ['train', 'validate', 'test'];

function metricCells(m) {
  if (!m) return WINDOWS.flatMap(() => [el('td', {}, ['—'])]);
  return [
    el('td', { className: 'px-2 py-1 tabular-nums' }, [formatPct(m.cagr * 100)]),
    el('td', { className: 'px-2 py-1 tabular-nums' }, [formatNumber(m.sharpe)]),
    el('td', { className: 'px-2 py-1 tabular-nums' }, [formatPct(m.maxDrawdown * 100)]),
    el('td', { className: 'px-2 py-1 tabular-nums' }, [formatPct(m.winRate * 100, 0)]),
    el('td', { className: 'px-2 py-1 tabular-nums' }, [Number.isFinite(m.profitFactor) ? formatNumber(m.profitFactor) : '∞']),
    el('td', { className: 'px-2 py-1 tabular-nums' }, [String(m.tradeCount)]),
  ];
}

function buildHeader() {
  const sub = ['CAGR', 'Sharpe', 'Max DD', 'Win rate', 'P.Factor', 'Trades'];
  return el('thead', {}, [
    el('tr', {}, [
      el('th', { className: 'px-2 py-1 text-left', rowspan: '2' }, ['Strategy']),
      ...WINDOWS.map((w) => el('th', { className: 'px-2 py-1 text-center border-l border-slate-800', colspan: '6' }, [w[0].toUpperCase() + w.slice(1)])),
    ]),
    el('tr', {}, WINDOWS.flatMap(() => sub.map((s, i) => el('th', { className: `px-2 py-1 text-xs text-slate-500 font-normal ${i === 0 ? 'border-l border-slate-800' : ''}` }, [s])))),
  ]);
}

function buildStrategyRow(name, strategyData) {
  const eligible = strategyData?.liveEligible;
  return el('tr', { className: `border-t border-slate-800 ${eligible ? '' : 'opacity-40'}` }, [
    el('td', { className: 'px-2 py-2 font-medium whitespace-nowrap' }, [
      name,
      eligible
        ? el('span', { className: 'ml-2 text-xs text-emerald-400' }, ['live-eligible'])
        : el('span', { className: 'ml-2 text-xs text-slate-500' }, ['not test-profitable']),
      ...(strategyData?.caveat
        ? [el('span', { className: 'ml-2 text-xs text-amber-400 cursor-help', title: strategyData.caveat }, ['⚠ backtest caveat'])]
        : []),
    ]),
    ...WINDOWS.flatMap((w) => metricCells(strategyData?.[w])),
  ]);
}

function buildPendingRow(pending) {
  return el('tr', { className: 'border-t border-slate-800 opacity-40' }, [
    el('td', { className: 'px-2 py-2 font-medium whitespace-nowrap' }, [
      pending.name,
      el('span', { className: 'ml-2 text-xs text-slate-500' }, ['pending']),
    ]),
    el('td', { className: 'px-2 py-2 text-xs text-slate-500', colspan: '18' }, [pending.reason]),
  ]);
}

export function mountStrategyHealthView(container, strategyHealthData) {
  if (!strategyHealthData) {
    container.replaceChildren(el('p', { className: 'text-sm text-slate-500' }, ['No strategy health data available.']));
    return;
  }

  const markets = Object.keys(strategyHealthData.markets).sort();
  let selectedMarket = markets[0];

  function render() {
    const marketData = strategyHealthData.markets[selectedMarket];
    const table = el('table', { className: 'w-full text-sm border-collapse' }, [
      buildHeader(),
      el('tbody', {}, [
        ...Object.entries(marketData).map(([name, data]) => buildStrategyRow(name, data)),
        ...(strategyHealthData.pendingStrategies ?? []).map(buildPendingRow),
      ]),
    ]);

    const select = el('select', {
      className: 'bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm mb-4',
      onchange: (e) => { selectedMarket = e.target.value; render(); },
    }, markets.map((m) => el('option', { value: m, ...(m === selectedMarket ? { selected: 'selected' } : {}) }, [m])));

    container.replaceChildren(
      el('div', { className: 'flex items-center gap-2 mb-4' }, [el('label', { className: 'text-sm text-slate-400' }, ['Market']), select]),
      el('div', { className: 'overflow-x-auto rounded-lg border border-slate-800' }, [table]),
      el('p', { className: 'text-xs text-slate-500 mt-3' }, ['Greyed strategies were not profitable in the 2024-2025 test window and do not contribute to live signals.']),
    );
  }

  render();
}
