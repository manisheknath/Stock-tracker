import { httpGet } from './http.mjs';

const ENTITIES = { amp: '&', quot: '"', '#39': "'", apos: "'", lt: '<', gt: '>', nbsp: ' ' };

function decodeEntities(str) {
  return str.replace(/&(#\d+|\w+);/g, (match, code) => {
    if (code.startsWith('#')) return String.fromCharCode(Number(code.slice(1)));
    return ENTITIES[code] ?? match;
  });
}

function cellText(cellHtml) {
  return decodeEntities(cellHtml.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Extracts a table's header row + data rows as plain-text cells, matched by
// its id attribute. Doesn't attempt to handle nested tables inside cells --
// none of the pages this is used against have that.
export function extractTableById(html, tableId) {
  const startMatch = html.match(new RegExp(`<table[^>]*id="${tableId}"[^>]*>`));
  if (!startMatch) return null;
  const start = startMatch.index + startMatch[0].length;
  const end = html.indexOf('</table>', start);
  if (end === -1) return null;
  const tableHtml = html.slice(start, end);

  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml))) {
    const cells = [];
    const cellRegex = /<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
      cells.push(cellText(cellMatch[1]));
    }
    if (cells.length > 0) rows.push(cells);
  }

  if (rows.length === 0) return null;
  return { headers: rows[0], rows: rows.slice(1) };
}

export function findColumnIndex(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function fetchHtml(url) {
  const { status, body } = await httpGet(url, { 'User-Agent': 'Mozilla/5.0 (Ticker-Claude research project, contact: manish.eknath@gmail.com)' });
  if (status !== 200) throw new Error(`HTTP ${status} for ${url}`);
  return body;
}
