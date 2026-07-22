import { marketFlag, SIGNAL_STYLES, convictionBarColor, formatPct, formatNumber, formatPrice } from './format.mjs';
import { el } from './dom.mjs';

const SORT_ACCESSORS = {
  ticker: (s) => s.ticker,
  market: (s) => s.market,
  signal: (s) => s.signal,
  conviction: (s) => s.conviction,
  horizon: (s) => s.horizon,
  close: (s) => s.close,
  entry: (s) => s.risk?.suggestedEntry ?? -Infinity,
  target: (s) => s.risk?.target ?? -Infinity,
  distanceToStop: (s) => s.risk?.distanceToStopPct ?? -Infinity,
};

const COLUMNS = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'market', label: 'Market' },
  { key: 'signal', label: 'Signal' },
  { key: 'conviction', label: 'Conviction' },
  { key: 'horizon', label: 'Horizon' },
  { key: 'close', label: 'Close' },
  { key: 'entry', label: 'Entry' },
  { key: 'target', label: 'Target' },
  { key: 'distanceToStop', label: '% from stop' },
  { key: 'strategy', label: 'Triggering strategy' },
];

export function mountSignalsView(container, allSignals, onRowClick) {
  const state = {
    sortKey: 'conviction',
    sortDir: 'desc',
    market: 'ALL',
    signal: 'ALL',
    horizon: 'ALL',
    convictionFloor: 0,
  };

  const markets = [...new Set(allSignals.map((s) => s.market))].sort();
  const horizons = [...new Set(allSignals.map((s) => s.horizon))].sort();

  function filtered() {
    return allSignals.filter((s) => (
      (state.market === 'ALL' || s.market === state.market)
      && (state.signal === 'ALL' || s.signal === state.signal)
      && (state.horizon === 'ALL' || s.horizon === state.horizon)
      && s.conviction >= state.convictionFloor
    ));
  }

  function sorted(list) {
    const accessor = SORT_ACCESSORS[state.sortKey];
    const dir = state.sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function buildFilterBar() {
    const select = (name, options, value, onChange) => el('select', {
      className: 'bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm',
      onchange: (e) => onChange(e.target.value),
    }, [
      el('option', { value: 'ALL' }, [name === 'market' ? 'All markets' : name === 'signal' ? 'All signals' : 'All horizons']),
      ...options.map((o) => el('option', { value: o }, [o])),
    ]);

    const floorInput = el('input', {
      type: 'number', min: '0', max: '100', value: String(state.convictionFloor),
      className: 'bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm w-20',
      onchange: (e) => { state.convictionFloor = Number(e.target.value) || 0; render(); },
    });

    return el('div', { className: 'flex flex-wrap items-center gap-2 mb-4' }, [
      select('market', markets, state.market, (v) => { state.market = v; render(); }),
      select('signal', ['BUY', 'SELL', 'HOLD'], state.signal, (v) => { state.signal = v; render(); }),
      select('horizon', horizons, state.horizon, (v) => { state.horizon = v; render(); }),
      el('label', { className: 'text-sm text-slate-400 flex items-center gap-1.5' }, ['Min conviction', floorInput]),
    ]);
  }

  function buildHeaderRow() {
    return el('tr', {}, COLUMNS.map((col) => {
      const active = state.sortKey === col.key;
      const arrow = active ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      return el('th', {
        className: 'text-left text-xs font-medium text-slate-400 uppercase tracking-wide px-3 py-2 cursor-pointer select-none hover:text-slate-200',
        onclick: () => {
          if (SORT_ACCESSORS[col.key] === undefined) return;
          if (state.sortKey === col.key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          else { state.sortKey = col.key; state.sortDir = 'desc'; }
          render();
        },
      }, [col.label + arrow]);
    }));
  }

  function buildRow(s) {
    const style = SIGNAL_STYLES[s.signal] ?? SIGNAL_STYLES.HOLD;
    const badge = el('span', { className: `inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${style.classes}` }, [style.label]);

    const barTrack = el('div', { className: 'w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden' }, [
      el('div', { className: `h-full ${convictionBarColor(s.conviction)}`, style: `width: ${s.conviction}%` }),
    ]);
    const convictionCell = el('div', { className: 'flex items-center gap-2' }, [barTrack, el('span', { className: 'text-xs text-slate-300 tabular-nums' }, [String(s.conviction)])]);

    const triggeringStrategy = s.evidence?.strategies?.[0]?.name ?? '—';
    const stopPct = s.risk?.distanceToStopPct;

    const row = el('tr', { className: 'border-t border-slate-800 hover:bg-slate-900/60 cursor-pointer' }, [
      el('td', { className: 'px-3 py-2 font-medium' }, [s.ticker]),
      el('td', { className: 'px-3 py-2' }, [`${marketFlag(s.market)} ${s.market}`]),
      el('td', { className: 'px-3 py-2' }, [badge]),
      el('td', { className: 'px-3 py-2' }, [convictionCell]),
      el('td', { className: 'px-3 py-2 text-slate-300' }, [s.horizon.replace('_', ' ')]),
      el('td', { className: 'px-3 py-2 tabular-nums' }, [formatPrice(s.close, s.currency)]),
      el('td', { className: 'px-3 py-2 tabular-nums' }, [s.risk?.suggestedEntry != null ? formatPrice(s.risk.suggestedEntry, s.currency) : '—']),
      el('td', { className: 'px-3 py-2 tabular-nums' }, [s.risk?.target != null ? formatPrice(s.risk.target, s.currency) : '—']),
      el('td', { className: 'px-3 py-2 tabular-nums' }, [stopPct != null ? formatPct(stopPct) : 'n/a']),
      el('td', { className: 'px-3 py-2 text-slate-400 text-sm' }, [triggeringStrategy]),
    ]);
    row.addEventListener('click', () => onRowClick(s));
    return row;
  }

  function render() {
    const rows = sorted(filtered());
    const table = el('table', { className: 'w-full text-sm border-collapse' }, [
      el('thead', {}, [buildHeaderRow()]),
      el('tbody', {}, rows.map(buildRow)),
    ]);

    container.replaceChildren(
      buildFilterBar(),
      el('div', { className: 'text-xs text-slate-500 mb-2' }, [`${rows.length} of ${allSignals.length} signals`]),
      el('div', { className: 'overflow-x-auto rounded-lg border border-slate-800' }, [table]),
    );
  }

  render();
}
