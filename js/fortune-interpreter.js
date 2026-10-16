import { ANNUAL_DETAILS, DETAIL_AREAS, DETAIL_VERSION } from './content/annual-details.js';
import { MONTHLY_DETAILS, MONTHLY_BRIDGES, MONTHLY_FIELDS } from './content/monthly-details.js';
import { tenGodForStems } from './saju-calculator.js';

const DEFAULT_CONTENT = { annual: ANNUAL_DETAILS, monthly: MONTHLY_DETAILS, bridges: MONTHLY_BRIDGES, version: DETAIL_VERSION };
const UNAVAILABLE = '이 해석을 준비하지 못했어요.';
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

function matches(entry, id, annual, monthly) {
  return entry?.id === id
    && (annual === undefined || entry.requires?.annualTenGod === annual)
    && (monthly === undefined || entry.requires?.monthlyTenGod === monthly);
}

function validAnnual(entry, id, key) {
  return matches(entry, id, key) && ['title', 'summary', 'opportunity', 'caution', 'action'].every((field) => hasText(entry[field]))
    && Array.isArray(entry.paragraphs) && entry.paragraphs.length >= 2 && entry.paragraphs.every(hasText);
}

function basis(dayMaster, annual, segment = null) {
  return {
    dayMaster,
    annualTenGod: annual.tenGod,
    monthlyTenGod: segment?.tenGod ?? null,
    annualPillar: annual.pillar.hanja,
    monthlyPillar: segment?.pillar.hanja ?? null,
    cycleYear: annual.cycleYear,
    start: (segment || annual).start,
    end: (segment || annual).end,
  };
}

// Optional catalog supports previewing edited data without mutating module globals.
// No clock, DOM, random choice or storage: periods already contains the temporal policy.
export function interpretDetailedFortune(result, periods, catalog = DEFAULT_CONTENT) {
  if (result == null || periods == null) return null;
  const output = structuredClone(periods);
  const dayMaster = result.pillars?.day?.stem?.hanja;
  const common = {
    ...output,
    version: catalog.version,
    contentStatus: 'unavailable', annualReadings: [], monthlyReadings: [], contentIds: [],
    note: '확정된 일간과 연·월 천간의 십성을 생활 주제로 풀었어요. 같은 일간과 같은 기간에는 같은 문구가 반복될 수 있어요. 원국 전체·대운·용신을 종합한 풀이가 아니에요.',
  };
  if (periods.partial) common.note = '미확정 기둥을 제외하고 일간 중심으로 설명해요. ' + common.note;
  if (periods.status === 'unavailable-day-master' || !dayMaster) return common;
  if (dayMaster !== periods.dayMaster?.hanja || !Array.isArray(periods.annualPeriods) || !Array.isArray(periods.months)
    || periods.months.length !== 12 || !Number.isInteger(periods.year) || periods.year < 1901 || periods.year > 2050) {
    throw new RangeError('출생 정보와 기간 계산 결과가 일치하지 않아요.');
  }
  const solar = result.dates?.solar;
  const start = Math.max(Date.UTC(periods.year, 0, 1), Date.UTC(solar?.year, solar?.month - 1, solar?.day)) - 9 * 3600000;
  const end = Date.UTC(periods.year + 1, 0, 1) - 9 * 3600000;
  if (!Number.isFinite(start) || start !== Date.parse(periods.range?.start) || end !== Date.parse(periods.range?.end)
    || solar.year > periods.year) {
    throw new RangeError('출생 정보에 맞는 기간을 다시 계산해 주세요.');
  }
  const annualById = new Map();
  for (const annual of output.annualPeriods) {
    if (annual.tenGod !== tenGodForStems(dayMaster, annual.pillar.stem.hanja) || annualById.has(annual.id)) {
      throw new RangeError('올바른 연간 계산 결과가 필요해요.');
    }
    annualById.set(annual.id, annual);
  }
  const annualReadings = output.annualPeriods.map((annual) => {
    const areas = Object.fromEntries(DETAIL_AREAS.map((area) => {
      const id = `annual.${annual.tenGod}.${area}`;
      const entry = catalog.annual?.[annual.tenGod]?.[area];
      return [area, validAnnual(entry, id, annual.tenGod)
        ? { ...structuredClone(entry), status: 'available' }
        : { id, status: 'unavailable-content', message: UNAVAILABLE }];
    }));
    const contentIds = Object.values(areas).filter((entry) => entry.status === 'available').map((entry) => entry.id);
    return {
      ...annual, status: contentIds.length === DETAIL_AREAS.length ? 'available' : 'partial-content',
      areas, contentIds, basis: basis(dayMaster, annual),
    };
  });
  let previousSource = null;
  const monthlyReadings = output.months.map((month) => {
    if (month.status !== 'available') return { ...month, segments: [] };
    const segments = month.segments.map((segment) => {
      const annual = annualById.get(segment.annualPeriodId);
      if (!annual || segment.tenGod !== tenGodForStems(dayMaster, segment.pillar.stem.hanja)
        || segment.start < annual.start || segment.end > annual.end) {
        throw new RangeError('올바른 월간 계산 결과가 필요해요.');
      }
      const monthly = catalog.monthly?.[segment.tenGod];
      const bridge = catalog.bridges?.[annual.tenGod]?.[segment.tenGod];
      const continuedFromPreviousMonth = previousSource === segment.sourceStart;
      previousSource = segment.sourceStart;
      const context = { ...segment, basis: basis(dayMaster, annual, segment), continuedFromPreviousMonth };
      if (!hasText(monthly?.title) || !MONTHLY_FIELDS.every((field) => {
        const entry = monthly[field];
        return matches(entry, `monthly.${segment.tenGod}.${field}`, undefined, segment.tenGod) && hasText(entry?.text);
      }) || !matches(bridge, `bridge.${annual.tenGod}.${segment.tenGod}`, annual.tenGod, segment.tenGod) || !hasText(bridge?.text)) {
        return { ...context, status: 'unavailable-content', message: UNAVAILABLE, contentIds: [] };
      }
      return {
        ...context, status: 'available', reading: structuredClone(monthly), bridge: structuredClone(bridge),
        contentIds: [...MONTHLY_FIELDS.map((field) => monthly[field].id), bridge.id],
      };
    });
    return { ...month, status: segments.some((s) => s.status !== 'available') ? 'partial-content' : 'available', segments };
  });
  const contentIds = [...new Set([
    ...annualReadings.flatMap((annual) => annual.contentIds),
    ...monthlyReadings.flatMap((month) => month.segments.flatMap((segment) => segment.contentIds)),
  ])];
  const incomplete = periods.status !== 'available' || annualReadings.some((a) => a.status !== 'available')
    || monthlyReadings.some((m) => !['available', 'before-birth'].includes(m.status));
  return { ...common, annualReadings, monthlyReadings, contentIds, contentStatus: incomplete ? 'partial' : 'complete' };
}
