export const FORTUNE_VIEW_KEY = 'luck.fortuneView.v1';

export function koreaClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric' }).formatToParts(now);
  return Object.fromEntries(parts.filter((part) => ['year', 'month'].includes(part.type)).map((part) => [part.type, Number(part.value)]));
}

export function validYear(year, result) {
  return Number.isInteger(year) && year >= Math.max(1901, result?.dates?.solar?.year ?? 1901) && year <= 2050;
}

export function validSelection(selection, periods) {
  return !!selection && selection.year === periods.year && Number.isInteger(selection.month)
    && selection.month >= 1 && selection.month <= 12 && Number.isInteger(selection.cycleYear)
    && periods.annualPeriods.some((period) => period.cycleYear === selection.cycleYear);
}

export function defaultSelection(periods, now = new Date()) {
  const clock = koreaClock(now);
  const time = now.getTime();
  const springNear = periods.annualPeriods.some((period) => Math.abs(Date.parse(period.sourceStart) - time) <= 60000);
  const current = periods.annualPeriods.find((period) => Date.parse(period.start) <= time && time < Date.parse(period.end));
  return {
    year: periods.year,
    cycleYear: periods.year === clock.year && springNear ? null
      : (periods.year === clock.year ? current?.cycleYear : periods.year) ?? periods.annualPeriods.at(-1)?.cycleYear ?? null,
    month: periods.year === clock.year ? clock.month : 1,
  };
}

export function formatFortuneTime(instant) {
  return new Date(Date.parse(instant) + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
}

export function formatFortuneRange(period) {
  return `${formatFortuneTime(period.start)}부터 ${formatFortuneTime(period.end)} 직전까지 (UTC+9)`;
}
