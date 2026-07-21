import { mountSignalsView } from './ui/table.mjs';
import { mountStrategyHealthView } from './ui/strategyHealth.mjs';
import { openDrawer, closeDrawer } from './ui/drawer.mjs';
import { marketFlag } from './ui/format.mjs';
import { el } from './ui/dom.mjs';

const app = document.getElementById('app');
const dataAsOf = document.getElementById('data-as-of');
const marketTimestamps = document.getElementById('market-timestamps');
const drawer = document.getElementById('drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function renderHeader(signalsData) {
  dataAsOf.textContent = `Data as of ${signalsData.asOf}`;

  const lastByMarket = new Map();
  for (const s of signalsData.signals) {
    const existing = lastByMarket.get(s.market);
    if (!existing || s.lastBarDate > existing) lastByMarket.set(s.market, s.lastBarDate);
  }

  marketTimestamps.replaceChildren(
    ...[...lastByMarket.entries()].sort().map(([market, date]) => el('span', {}, [`${marketFlag(market)} ${market}: ${date}`])),
  );
}

function setActiveTab(view) {
  document.querySelectorAll('.view-tab').forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.className = `view-tab px-3 py-1.5 text-sm rounded-md ${active ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`;
  });
}

async function main() {
  let signalsData;
  let strategyHealthData;

  try {
    [signalsData, strategyHealthData] = await Promise.all([
      fetchJson('./data/signals.json'),
      fetchJson('./data/strategy-health.json').catch(() => null),
    ]);
  } catch (err) {
    app.replaceChildren(el('p', { className: 'text-rose-400 text-sm' }, [`Failed to load signal data: ${err.message}`]));
    return;
  }

  renderHeader(signalsData);

  function showSignals() {
    setActiveTab('signals');
    mountSignalsView(app, signalsData.signals, (signal) => {
      openDrawer({ signal, drawerEl: drawer, backdropEl: drawerBackdrop, strategyHealth: strategyHealthData });
    });
  }

  function showStrategyHealth() {
    setActiveTab('strategy-health');
    mountStrategyHealthView(app, strategyHealthData);
  }

  document.querySelector('[data-view="signals"]').addEventListener('click', showSignals);
  document.querySelector('[data-view="strategy-health"]').addEventListener('click', showStrategyHealth);
  drawerBackdrop.addEventListener('click', () => closeDrawer(drawer, drawerBackdrop));

  showSignals();
}

main();
