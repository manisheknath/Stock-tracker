const MOVE_THRESHOLD = 0.40;
const SPLIT_DATE_SLACK_DAYS = 1;

function daysBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  return Math.abs(a - b) / 86400000;
}

/**
 * Walks the bar series looking for single-bar closes moves bigger than MOVE_THRESHOLD.
 * Yahoo's `close` series is already split-adjusted, so a real, recorded split should
 * never produce a jump here -- any large jump that isn't within a day of a known split
 * is treated as suspect data (bad print, unrecorded corporate action, feed glitch) rather
 * than silently ingested.
 */
export function findUnexplainedJumps(bars, corporateActions) {
  const splitDates = corporateActions.splits.map((s) => s.date);
  const flags = [];

  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    if (!prev.close || prev.close <= 0 || !curr.close) continue;

    const pctChange = (curr.close - prev.close) / prev.close;
    if (Math.abs(pctChange) <= MOVE_THRESHOLD) continue;

    const explainedBySplit = splitDates.some(
      (sd) => daysBetween(sd, curr.date) <= SPLIT_DATE_SLACK_DAYS
    );
    if (explainedBySplit) continue;

    flags.push({
      date: curr.date,
      prevClose: prev.close,
      currClose: curr.close,
      pctChange: Number((pctChange * 100).toFixed(2)),
      message: `Unexplained ${(pctChange * 100).toFixed(1)}% single-bar move not matched to a recorded split within ${SPLIT_DATE_SLACK_DAYS} day(s)`,
    });
  }

  return flags;
}

/**
 * Applies the adjustment/corruption-assertion stage to one ticker's raw fetch result.
 * Returns either a clean adjusted record or an excluded record -- never a silently
 * ingested one.
 */
export function adjustAndValidate(ticker, rawResult) {
  const { bars, corporateActions, meta } = rawResult;

  if (bars.length === 0) {
    return {
      ticker,
      excluded: true,
      reason: 'No bars returned',
    };
  }

  const jumps = findUnexplainedJumps(bars, corporateActions);
  if (jumps.length > 0) {
    return {
      ticker,
      excluded: true,
      reason: 'Unexplained single-bar move(s) exceeding 40% threshold',
      flags: jumps,
    };
  }

  const gaps = countCalendarGaps(bars);

  return {
    ticker,
    excluded: false,
    meta,
    bars,
    corporateActions,
    dataQuality: {
      barsAvailable: bars.length,
      firstDate: bars[0].date,
      lastDate: bars[bars.length - 1].date,
      gaps,
    },
  };
}

/**
 * Rough gap count: business days between first and last bar vs bars actually present.
 * Not exact (doesn't account for local holidays), just a coarse data-quality signal.
 */
function countCalendarGaps(bars) {
  let businessDays = 0;
  const start = Date.parse(bars[0].date);
  const end = Date.parse(bars[bars.length - 1].date);
  for (let t = start; t <= end; t += 86400000) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) businessDays++;
  }
  return Math.max(0, businessDays - bars.length);
}
