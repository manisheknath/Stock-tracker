// Fixed calendar walk-forward split, per the spec. Train/validate/test are
// always these exact date ranges -- never a rolling fraction of whatever
// history happens to be available (see the 2020-01-01 fetch-range fix this
// depends on).
export const WALK_FORWARD_WINDOWS = {
  train: { start: '2020-01-01', end: '2022-12-31' },
  validate: { start: '2023-01-01', end: '2023-12-31' },
  test: { start: '2024-01-01', end: '2025-12-31' },
};

export function windowBarIndexRange(bars, window) {
  const startIdx = bars.findIndex((b) => b.date >= window.start);
  let endIdx = -1;
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].date <= window.end) { endIdx = i; break; }
  }
  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) return null;
  return { startIdx, endIdx };
}
