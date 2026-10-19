import { describePillar, tenGodForStems } from './saju-calculator.js';
import { HIDDEN_STEMS, HIDDEN_STEM_ROLES, HIDDEN_STEMS_TABLE_ID, MONTH_SEASONS, NATAL_TABLE_VERSION } from './content/natal-tables.js';

export const NATAL_FEATURE_VERSION = '1.0.0';
export const NATAL_AREAS = Object.freeze(['overview', 'temperament', 'workResources', 'relationships', 'dailyBalance']);
const KEYS = ['year', 'month', 'day', 'hour'];
const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];
const CYCLE = new Set(Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]));
const ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'];
const POLICY = { timeZone: 'UTC+09:00', dayBoundary: '00:00', solarTimeCorrection: false, termMarginSeconds: 60 };
const object = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => { throw new RangeError(message); };

function sameLetter(actual, expected) {
  return object(actual) && ['hanja', 'hangul', 'element'].every((key) => actual[key] === expected[key]);
}

function checkPillar(pillar) {
  if (!object(pillar) || !CYCLE.has(pillar.hanja)) fail('올바른 60갑자 기둥이 필요해요.');
  const canonical = describePillar(pillar.hanja);
  if (pillar.hangul !== canonical.hangul || !sameLetter(pillar.stem, canonical.stem)
    || !sameLetter(pillar.branch, canonical.branch)) fail('기둥의 간지와 설명이 일치하지 않아요.');
}

function validate(result) {
  if (!object(result) || !object(result.pillars) || !object(result.features)
    || !object(result.policy) || !object(result.uncertainty) || !object(result.profile)) {
    fail('검증된 사주 계산 결과가 필요해요.');
  }
  if (Object.entries(POLICY).some(([key, value]) => result.policy[key] !== value)) fail('지원하는 출생 계산 정책이 아니에요.');
  const solar = result.dates?.solar;
  if (!solar || ![solar.year, solar.month, solar.day].every(Number.isInteger)) fail('양력 출생 날짜가 필요해요.');
  const date = new Date(Date.UTC(solar.year, solar.month - 1, solar.day));
  if (solar.year < 1900 || solar.year > 2050 || date.getUTCFullYear() !== solar.year
    || date.getUTCMonth() + 1 !== solar.month || date.getUTCDate() !== solar.day) fail('양력 출생 날짜를 확인해 주세요.');
  if (typeof result.profile.unknownTime !== 'boolean' || (result.profile.unknownTime && result.pillars.hour !== null)) {
    fail('시간 미상 결과에 시주를 포함할 수 없어요.');
  }
  const counts = Object.fromEntries(ELEMENTS.map((element) => [element, 0]));
  for (const key of KEYS) {
    if (!Object.hasOwn(result.pillars, key)) fail('네 기둥의 상태를 모두 지정해 주세요.');
    const pillar = result.pillars[key];
    if (pillar === null) continue;
    checkPillar(pillar);
    counts[pillar.stem.element] += 1;
    counts[pillar.branch.element] += 1;
  }
  const excluded = KEYS.filter((key) => result.pillars[key] === null);
  if (!object(result.features.elements) || ELEMENTS.some((key) => result.features.elements[key] !== counts[key])
    || Object.keys(result.features.elements).length !== ELEMENTS.length
    || result.features.elementCount !== Object.values(counts).reduce((sum, count) => sum + count, 0)
    || result.features.partial !== (excluded.length > 0)) fail('표면 오행 집계와 확정 기둥이 일치하지 않아요.');
  if (!Object.hasOwn(result.features, 'dayMaster')) fail('일간 확인 상태가 필요해요.');
  if (result.features.dayMaster !== null && (!result.pillars.day
    || !sameLetter(result.features.dayMaster, result.pillars.day.stem))) fail('일간과 일주가 일치하지 않아요.');
  const uncertainty = result.uncertainty;
  if (!Array.isArray(uncertainty.pillars) || !object(uncertainty.alternatives)
    || new Set(uncertainty.pillars).size !== uncertainty.pillars.length
    || ![null, 'unknown-time-on-term-day', 'near-term-boundary'].includes(uncertainty.reason)
    || (uncertainty.reason === null) !== (uncertainty.pillars.length === 0)
    || Object.keys(uncertainty.alternatives).length !== uncertainty.pillars.length) fail('절입 불확실성 정보를 확인해 주세요.');
  for (const key of uncertainty.pillars) {
    const alternatives = uncertainty.alternatives[key];
    if (!['year', 'month'].includes(key) || result.pillars[key] !== null || !Array.isArray(alternatives)
      || alternatives.length !== 2) fail('미확정 기둥과 후보 정보가 일치하지 않아요.');
    alternatives.forEach(checkPillar);
    if (alternatives[0].hanja === alternatives[1].hanja) fail('서로 다른 절입 후보가 필요해요.');
  }
  return excluded;
}

function availabilityFor(result, pillars, dayMaster, dayPillar, season, context) {
  const availability = {};
  const set = (key, requiredFeatures, available, reason = 'unavailable-feature') => {
    availability[key] = { status: available ? 'available' : 'unavailable-feature', reason: available ? null : reason,
      partial: result.features.partial || !dayMaster, requiredFeatures };
  };
  const dayReason = !dayPillar ? 'unavailable-day-pillar' : 'unavailable-day-master';
  set('dayMaster', ['dayMaster'], !!dayMaster, dayReason);
  set('dayPillar', ['dayMaster', 'dayPillar', 'pillars.day.hiddenStems.0'], !!dayMaster && !!dayPillar, dayReason);
  for (const key of KEYS) {
    const reason = !dayMaster ? dayReason : key === 'hour' && result.profile.unknownTime ? 'unknown-time'
      : result.uncertainty.pillars.includes(key) ? 'uncertain-pillar' : 'missing-pillar';
    set(`pillars.${key}`, ['dayMaster', `pillars.${key}`], !!dayMaster && !!pillars[key], reason);
  }
  set('surfaceElements', ['surfaceElements'], true);
  set('season', ['pillars.month'], !!season, 'uncertain-or-missing-month');
  set('context', ['dayMaster', 'dayPillar'], !!context, dayReason);
  for (const key of NATAL_AREAS) set(key, ['dayMaster', 'dayPillar', 'context'], !!context, dayReason);
  return availability;
}

// Consumes calculateSaju's validated result. Never reads the clock, DOM or storage.
export function calculateNatalFeatures(result) {
  if (result == null) return null;
  const excludedPillars = validate(result);
  // An explicit null dayMaster is a conservative unavailable state, not permission
  // to infer it from another pillar. Normal calculateSaju results always confirm it.
  const dayMaster = result.features.dayMaster ? structuredClone(result.pillars.day.stem) : null;
  const dayPillar = result.pillars.day ? structuredClone(result.pillars.day) : null;
  const relation = (stem) => dayMaster ? tenGodForStems(dayMaster.hanja, stem) : null;
  const pillars = Object.fromEntries(KEYS.map((key) => {
    const pillar = result.pillars[key];
    if (!pillar) return [key, null];
    return [key, {
      pillar: structuredClone(pillar),
      stemRelation: dayMaster ? { kind: key === 'day' ? 'self' : 'ten-god', tenGod: key === 'day' ? null : relation(pillar.stem.hanja) } : null,
      hiddenStems: HIDDEN_STEMS[pillar.branch.hanja].map((hanja, index) => ({
        // describePillar provides canonical stem metadata; its branch is unused.
        stem: { ...describePillar(hanja + (STEMS.indexOf(hanja) % 2 ? '丑' : '子')).stem },
        role: HIDDEN_STEM_ROLES[index], order: index + 1, tenGod: relation(hanja), tableId: HIDDEN_STEMS_TABLE_ID,
      })),
    }];
  }));
  const month = result.pillars.month;
  const season = month ? { ...MONTH_SEASONS[month.branch.hanja], monthBranch: structuredClone(month.branch), monthElement: month.branch.element } : null;
  const main = pillars.day?.hiddenStems[0];
  const context = dayMaster && dayPillar ? {
    tenGod: month ? relation(month.stem.hanja) : main.tenGod,
    source: month ? 'month-stem' : 'day-branch-main', pillarKey: month ? 'month' : 'day',
    stem: structuredClone(month ? month.stem : main.stem),
  } : null;
  return {
    version: NATAL_FEATURE_VERSION,
    policy: { ...POLICY, tableVersion: NATAL_TABLE_VERSION, hiddenStemsTableId: HIDDEN_STEMS_TABLE_ID },
    status: !dayPillar ? 'unavailable-day-pillar' : !dayMaster ? 'unavailable-day-master' : 'available',
    partial: excludedPillars.length > 0 || !dayMaster, excludedPillars,
    uncertainty: structuredClone(result.uncertainty), dayMaster, dayPillar, pillars,
    surfaceElements: { counts: { ...result.features.elements }, total: result.features.elementCount, kind: 'surface-characters' },
    season, context, availability: availabilityFor(result, pillars, dayMaster, dayPillar, season, context),
  };
}
