import { Solar } from './vendor/lunar-javascript/lunar.mjs';
import { annualPillar, describePillar, tenGodForStems } from './saju-calculator.js';

const HOUR = 3600000;
const MARGIN = 60000;
const TERM_KEYS = ['DA_XUE', '小寒', '立春', '惊蛰', '清明', '立夏', '芒种',
  '小暑', '立秋', '白露', '寒露', '立冬', '大雪', 'XIAO_HAN'];
const iso = (time) => new Date(time).toISOString();
const monthStart = (year, month) => Date.UTC(year, month - 1, 1) - 9 * HOUR;

function monthPillar(time) {
  const wall = new Date(time + 8 * HOUR);
  const lunar = Solar.fromYmdHms(wall.getUTCFullYear(), wall.getUTCMonth() + 1,
    wall.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds()).getLunar();
  return describePillar(lunar.getMonthInGanZhiExact());
}

function currentPeriod(segments, boundaries, time, range) {
  const empty = { nearBoundary: false, activeSegmentId: null, candidateSegmentIds: [] };
  if (time < range.start || time >= range.end) return empty;
  const boundary = boundaries.find((value) => Math.abs(value - time) <= MARGIN);
  if (boundary !== undefined) {
    return {
      ...empty,
      nearBoundary: true,
      candidateSegmentIds: segments.filter((segment) =>
        Date.parse(segment.end) === boundary || Date.parse(segment.start) === boundary)
        .map((segment) => segment.id),
    };
  }
  return {
    ...empty,
    activeSegmentId: segments.find((segment) =>
      Date.parse(segment.start) <= time && time < Date.parse(segment.end))?.id ?? null,
  };
}

// Accepts the validated calculateSaju result. No DOM, storage or interpretation content.
export function calculateFortunePeriods(result, year, now = new Date()) {
  if (result == null) return null;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new RangeError('올바른 조회 시각을 지정해 주세요.');
  }
  const solar = result.dates?.solar;
  if (!solar || ![solar.year, solar.month, solar.day].every(Number.isInteger)) {
    throw new RangeError('검증된 양력 출생 날짜가 필요해요.');
  }
  const birthWall = new Date(Date.UTC(solar.year, solar.month - 1, solar.day));
  if (solar.year < 1900 || solar.year > 2050 || birthWall.getUTCFullYear() !== solar.year
    || birthWall.getUTCMonth() + 1 !== solar.month || birthWall.getUTCDate() !== solar.day) {
    throw new RangeError('올바른 양력 출생 날짜가 필요해요.');
  }
  if (!Number.isInteger(year) || year < Math.max(1901, solar.year) || year > 2050) {
    throw new RangeError('상세 운세는 출생 연도 이후의 1901~2050년을 선택해 주세요.');
  }
  const dayMaster = result.pillars?.day?.stem;
  const excludedPillars = ['year', 'month', 'day', 'hour'].filter((key) => !result.pillars?.[key]);
  const range = { start: Math.max(monthStart(year, 1), birthWall.getTime() - 9 * HOUR), end: monthStart(year + 1, 1) };
  const base = {
    year, range: { start: iso(range.start), end: iso(range.end) },
    dayMaster: dayMaster ? { ...dayMaster } : null,
    partial: excludedPillars.length > 0, excludedPillars,
    annualPeriods: [], months: [],
    current: { nearBoundary: false, activeSegmentId: null, candidateSegmentIds: [] },
  };
  if (!dayMaster || ![...'甲乙丙丁戊己庚辛壬癸'].includes(dayMaster.hanja)) {
    return { ...base, status: 'unavailable-day-master' };
  }

  const annualPeriods = [year - 1, year].flatMap((cycleYear) => {
    const annual = annualPillar(cycleYear);
    const start = Math.max(range.start, Date.parse(annual.start.instant));
    const end = Math.min(range.end, Date.parse(annual.end.instant));
    if (start >= end) return [];
    return [{ id: `annual-${cycleYear}`, cycleYear, pillar: annual.pillar,
      tenGod: tenGodForStems(dayMaster.hanja, annual.pillar.stem.hanja),
      sourceStart: annual.start.instant, sourceEnd: annual.end.instant,
      start: iso(start), end: iso(end) }];
  });
  const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable();
  const boundaries = TERM_KEYS.map((key) => Date.parse(table[key].toYmdHms().replace(' ', 'T') + '+08:00'));
  if (boundaries.some((value, index) => !Number.isFinite(value) || (index > 0 && value <= boundaries[index - 1]))
    || boundaries[0] > range.start || boundaries.at(-1) < range.end) {
    throw new Error('절기 구간을 계산하지 못했어요.');
  }
  const sourcePeriods = boundaries.slice(0, -1).map((start, index) => ({
    start, end: boundaries[index + 1],
    pillar: monthPillar(start + HOUR),
  }));
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const start = Math.max(range.start, monthStart(year, month));
    const end = Math.min(range.end, monthStart(year, month + 1));
    if (start >= end) return { month, status: 'before-birth', segments: [] };
    const segments = [];
    for (const source of sourcePeriods) {
      for (const annual of annualPeriods) {
        const segmentStart = Math.max(start, source.start, Date.parse(annual.start));
        const segmentEnd = Math.min(end, source.end, Date.parse(annual.end));
        if (segmentStart >= segmentEnd) continue;
        segments.push({
          id: `month-${iso(source.start)}-${iso(segmentStart)}`,
          annualPeriodId: annual.id, pillar: structuredClone(source.pillar),
          tenGod: tenGodForStems(dayMaster.hanja, source.pillar.stem.hanja),
          sourceStart: iso(source.start), sourceEnd: iso(source.end),
          start: iso(segmentStart), end: iso(segmentEnd),
        });
      }
    }
    segments.sort((a, b) => a.start.localeCompare(b.start));
    if (!segments.length || Date.parse(segments[0].start) !== start || Date.parse(segments.at(-1).end) !== end
      || segments.some((segment, i) => i > 0 && segments[i - 1].end !== segment.start)) {
      return { month, status: 'calculation-error', segments: [] };
    }
    return { month, status: 'available', segments };
  });
  return {
    ...base, status: months.some((month) => month.status === 'calculation-error') ? 'calculation-error' : 'available',
    annualPeriods, months,
    current: currentPeriod(months.flatMap((month) => month.segments), boundaries, now.getTime(), range),
  };
}
