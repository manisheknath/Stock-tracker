import { test, assert, run } from './indicators/testHarness.mjs';
import { tickerFilename } from './tickerFile.mjs';

test('tickerFilename: normal tickers are unchanged', () => {
  assert.equal(tickerFilename('AAPL.us'), 'AAPL.us.json');
  assert.equal(tickerFilename('RELIANCE.in'), 'RELIANCE.in.json');
  assert.equal(tickerFilename('BRK-B.us'), 'BRK-B.us.json');
});

test('tickerFilename: Windows reserved device names get the stem escaped', () => {
  assert.equal(tickerFilename('CON.de'), 'CON_.de.json'); // Continental
  assert.equal(tickerFilename('PRN.us'), 'PRN_.us.json');
  assert.equal(tickerFilename('AUX.uk'), 'AUX_.uk.json');
  assert.equal(tickerFilename('NUL.fr'), 'NUL_.fr.json');
  assert.equal(tickerFilename('COM1.de'), 'COM1_.de.json');
  assert.equal(tickerFilename('LPT9.es'), 'LPT9_.es.json');
});

test('tickerFilename: matching is case-insensitive and only on the exact stem', () => {
  assert.equal(tickerFilename('con.de'), 'con_.de.json');
  assert.equal(tickerFilename('CONE.us'), 'CONE.us.json'); // CONE is not reserved
  assert.equal(tickerFilename('CONN.us'), 'CONN.us.json');
});

run();
