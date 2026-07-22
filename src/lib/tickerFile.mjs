// Windows reserves certain device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
// as filenames -- "CON.de.json" is a legal filename on the Linux GitHub
// Actions runner but illegal on a Windows checkout, and (worse) our own
// pipeline can't read it back on Windows. Continental's DAX ticker is
// literally "CON", so its per-ticker data files (bars, fundamentals) need the
// stem escaped. The mapping is deterministic and shared by every reader and
// writer -- Node pipeline scripts and the browser UI alike -- so a ticker
// always resolves to exactly one filename on every platform.
const RESERVED = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;

export function tickerFilename(ticker) {
  const firstDot = ticker.indexOf('.');
  const stem = firstDot === -1 ? ticker : ticker.slice(0, firstDot);
  const rest = firstDot === -1 ? '' : ticker.slice(firstDot);
  const safeStem = RESERVED.test(stem) ? `${stem}_` : stem;
  return `${safeStem}${rest}.json`;
}
