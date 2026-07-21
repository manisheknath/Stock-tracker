const dataAsOf = document.getElementById('data-as-of');

async function loadUniverse() {
  const res = await fetch('./data/universe.json');
  if (!res.ok) return null;
  return res.json();
}

const universe = await loadUniverse();
if (universe) {
  dataAsOf.textContent = `Data as of ${universe.generatedAt} (${universe.tickers.length} tickers seeded)`;
}
