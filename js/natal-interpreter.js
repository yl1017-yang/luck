import { NATAL_CATALOG, NATAL_TEN_GOD_ORDER } from './content/natal-details.js';
import { NATAL_AREA_TITLES } from './content/natal-areas.js';
import { NATAL_AREAS, NATAL_FEATURE_VERSION } from './natal-features.js';
import { HIDDEN_STEMS, HIDDEN_STEM_ROLES, HIDDEN_STEMS_TABLE_ID, MONTH_SEASONS, NATAL_TABLE_VERSION } from './content/natal-tables.js';
import { describePillar, tenGodForStems } from './saju-calculator.js';

const KEYS = ['year', 'month', 'day', 'hour'];
const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];
const CYCLE = new Set(Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]));
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const equal = (a, b) => {
  if (a === b) return true;
  if (!object(a) && !Array.isArray(a)) return false;
  if ((!object(b) && !Array.isArray(b)) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]));
};
const invalid = () => { throw new RangeError('원국 특징과 계산 근거가 일치하지 않아요. 특징을 다시 계산해 주세요.'); };

function validate(features) {
  if (!object(features) || features.version !== NATAL_FEATURE_VERSION || !object(features.pillars)
    || !object(features.policy) || !object(features.availability)) invalid();
  const expectedPolicy = { timeZone: 'UTC+09:00', dayBoundary: '00:00', solarTimeCorrection: false,
    termMarginSeconds: 60, tableVersion: NATAL_TABLE_VERSION, hiddenStemsTableId: HIDDEN_STEMS_TABLE_ID };
  if (!equal(features.policy, expectedPolicy)) invalid();
  const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const excluded = [];
  const master = features.dayMaster;
  if (master !== null && (!object(master) || !STEMS.includes(master.hanja))) invalid();
  const god = (stem) => master ? tenGodForStems(master.hanja, stem) : null;
  for (const key of KEYS) {
    const value = features.pillars[key];
    if (value === null) { excluded.push(key); continue; }
    if (!object(value) || !CYCLE.has(value.pillar?.hanja)) invalid();
    const pillar = describePillar(value.pillar.hanja);
    if (!equal(value.pillar, pillar)) invalid();
    const expected = master ? { kind: key === 'day' ? 'self' : 'ten-god', tenGod: key === 'day' ? null : god(pillar.stem.hanja) } : null;
    if (!equal(value.stemRelation, expected)) invalid();
    const hidden = HIDDEN_STEMS[pillar.branch.hanja];
    if (!Array.isArray(value.hiddenStems) || value.hiddenStems.length !== hidden.length) invalid();
    hidden.forEach((stem, index) => {
      const item = value.hiddenStems[index];
      const canonicalStem = describePillar(stem + (STEMS.indexOf(stem) % 2 ? '丑' : '子')).stem;
      if (!equal(item, { stem: canonicalStem, role: HIDDEN_STEM_ROLES[index], order: index + 1,
        tenGod: god(stem), tableId: HIDDEN_STEMS_TABLE_ID })) invalid();
    });
    counts[pillar.stem.element] += 1;
    counts[pillar.branch.element] += 1;
  }
  const day = features.pillars.day;
  const month = features.pillars.month;
  if (!equal(features.dayPillar, day?.pillar ?? null) || (master && !equal(master, day?.pillar.stem))) invalid();
  const expectedStatus = !day ? 'unavailable-day-pillar' : !master ? 'unavailable-day-master' : 'available';
  if (features.status !== expectedStatus || features.partial !== (excluded.length > 0 || !master)
    || !equal(features.excludedPillars, excluded)) invalid();
  if (!equal(features.surfaceElements, { counts, total: Object.values(counts).reduce((sum, n) => sum + n, 0), kind: 'surface-characters' })) invalid();
  const expectedSeason = month ? { ...MONTH_SEASONS[month.pillar.branch.hanja], monthBranch: month.pillar.branch, monthElement: month.pillar.branch.element } : null;
  if (!equal(features.season, expectedSeason)) invalid();
  const expectedContext = master && day ? {
    tenGod: month ? god(month.pillar.stem.hanja) : day.hiddenStems[0].tenGod,
    source: month ? 'month-stem' : 'day-branch-main', pillarKey: month ? 'month' : 'day',
    stem: month ? month.pillar.stem : day.hiddenStems[0].stem,
  } : null;
  if (!equal(features.context, expectedContext)) invalid();
  const uncertainty = features.uncertainty;
  if (!object(uncertainty) || !Array.isArray(uncertainty.pillars) || !object(uncertainty.alternatives)
    || ![null, 'unknown-time-on-term-day', 'near-term-boundary'].includes(uncertainty.reason)
    || (uncertainty.reason === null) !== (uncertainty.pillars.length === 0)
    || new Set(uncertainty.pillars).size !== uncertainty.pillars.length
    || Object.keys(uncertainty.alternatives).length !== uncertainty.pillars.length) invalid();
  for (const key of uncertainty.pillars) {
    const candidates = uncertainty.alternatives[key];
    if (!['year', 'month'].includes(key) || features.pillars[key] !== null || !Array.isArray(candidates)
      || candidates.length !== 2 || candidates[0]?.hanja === candidates[1]?.hanja) invalid();
    for (const candidate of candidates) {
      if (!CYCLE.has(candidate?.hanja) || !equal(candidate, describePillar(candidate.hanja))) invalid();
    }
  }
  // Interpretation uses confirmed facts, not caller-edited availability flags.
  const expectedAvailability = { dayMaster: !!master, dayPillar: !!master && !!day,
    surfaceElements: true, season: !!month, context: !!expectedContext,
    ...Object.fromEntries(KEYS.map((key) => [`pillars.${key}`, !!master && !!features.pillars[key]])),
    ...Object.fromEntries(NATAL_AREAS.map((key) => [key, !!expectedContext])) };
  if (Object.keys(features.availability).length !== Object.keys(expectedAvailability).length) invalid();
  for (const [key, available] of Object.entries(expectedAvailability)) {
    if (features.availability[key]?.status !== (available ? 'available' : 'unavailable-feature')
      || features.availability[key]?.partial !== features.partial) invalid();
  }
}

function usable(entry, id, requires, role, version) {
  return entry?.id === id && entry.version === version && entry.role === role && equal(entry.requires, requires)
    && ['title', 'summary', 'question'].every((key) => text(entry[key]))
    && Array.isArray(entry.paragraphs) && entry.paragraphs.length >= (role === 'base' ? 2 : 1)
    && entry.paragraphs.every(text) && (role === 'base' ? text(entry.action) : entry.action === null);
}

export function interpretNatalDetails(features, catalog = NATAL_CATALOG) {
  if (features == null) return null;
  validate(features);
  if (!object(catalog) || !text(catalog.version)) throw new RangeError('콘텐츠 카탈로그 버전이 필요해요.');
  const facts = structuredClone(features);
  const result = {
    version: catalog.version, featureVersion: features.version, status: features.status,
    contentStatus: 'unavailable', partial: features.partial,
    note: `${features.partial ? '미확정 기둥을 제외한 부분 결과예요. ' : ''}확정 원국과 저장된 문구를 연결한 자기 성찰용 설명이에요. 같은 일간·일주·맥락은 문구가 반복될 수 있어요. 신강약·용신·사건 예측을 판단하지 않아요.`,
    facts, sections: [], contentIds: [],
  };
  if (features.status !== 'available') return result;
  const D = facts.dayMaster.hanja;
  const P = facts.dayPillar.hanja;
  const C = facts.context.tenGod;
  const baseBasis = { dayMaster: D, dayPillar: P };
  const request = (entry, id, requires, role = 'base', mandatory = true) => ({ entry, id, requires, role, mandatory });

  function section(key, title, basis, requests, featureAvailable = true, featureReason = null) {
    const common = { key, title, summary: '', basis, blocks: [], contentIds: [], missingContentIds: [], status: 'available', reason: null };
    if (!featureAvailable) {
      result.sections.push({ ...common, status: 'unavailable-feature', reason: featureReason, message: '이 설명에 필요한 특징을 확정하지 못했어요.' });
      return;
    }
    const missing = requests.filter((r) => !usable(r.entry, r.id, r.requires, r.role, catalog.version));
    if (missing.some((r) => r.mandatory)) {
      result.sections.push({ ...common, status: 'unavailable-content', reason: 'missing-base-content',
        missingContentIds: missing.map((r) => r.id), message: '이 해석을 준비하지 못했어요.' });
      return;
    }
    const blocks = requests.filter((r) => !missing.includes(r)).map((r) => structuredClone(r.entry));
    result.sections.push({ ...common, summary: blocks[0]?.summary ?? '', blocks,
      contentIds: blocks.map((b) => b.id), missingContentIds: missing.map((r) => r.id),
      status: missing.length ? 'partial-content' : 'available', reason: missing.length ? 'missing-support-content' : null,
      ...(missing.length ? { message: '일부 보조 해석을 준비하지 못했어요.' } : {}),
    });
  }

  function area(key) {
    section(key, NATAL_AREA_TITLES[key], { ...baseBasis, context: facts.context, dayBranchMain: facts.pillars.day.hiddenStems[0] }, [
      request(catalog.areas?.[D]?.[key], `natal.area.${key}.${D}`, { dayMaster: D, area: key }),
      request(catalog.contexts?.[C]?.[key], `natal.context.${key}.${C}`, { contextTenGod: C, area: key }, 'context', false),
    ]);
  }

  area('overview');
  section('dayMaster', '나의 일간을 읽는 관점', baseBasis, [request(catalog.dayMasters?.[D], `natal.dayMaster.${D}`, { dayMaster: D })]);
  section('dayPillar', '나의 일주를 읽는 관점', { ...baseBasis, dayBranchMain: facts.pillars.day.hiddenStems[0] }, [
    request(catalog.dayPillars?.[P], `natal.dayPillar.${P}`, { dayPillar: P }),
  ]);
  // Facts per pillar remain separate from editorial themes; each theme is written once.
  for (const key of KEYS) {
    const availability = facts.availability[`pillars.${key}`];
    section(`pillars.${key}`, { year: '연주', month: '월주', day: '일주', hour: '시주' }[key],
      { ...baseBasis, pillarKey: key, pillar: facts.pillars[key], tableId: HIDDEN_STEMS_TABLE_ID }, [],
      availability.status === 'available', availability.reason);
  }
  const positions = new Map(NATAL_TEN_GOD_ORDER.map((god) => [god, []]));
  for (const key of KEYS) {
    const value = facts.pillars[key];
    if (!value) continue;
    if (value.stemRelation.kind !== 'self') positions.get(value.stemRelation.tenGod).push({ pillarKey: key, source: 'stem', stem: structuredClone(value.pillar.stem) });
    for (const item of value.hiddenStems) positions.get(item.tenGod).push({ pillarKey: key, source: 'hidden', ...structuredClone(item) });
  }
  for (const [god, occurrences] of positions) {
    if (!occurrences.length) continue;
    section(`tenGod.${god}`, `${god} · 실제 위치와 생활 질문`, { ...baseBasis, tenGod: god, positions: occurrences }, [
      request(catalog.tenGods?.[god], `natal.tenGod.${god}`, { tenGod: god }, 'fact'),
    ]);
  }
  section('season', '출생 계절과 절기 월', { month: facts.pillars.month?.pillar ?? null, season: facts.season, tableId: HIDDEN_STEMS_TABLE_ID }, facts.season ? [
    request(catalog.monthBranches?.[facts.season.monthBranch.hanja], `natal.monthBranch.${facts.season.monthBranch.hanja}`, { monthBranch: facts.season.monthBranch.hanja }, 'fact'),
    request(catalog.seasons?.[facts.season.key], `natal.season.${facts.season.key}`, { season: facts.season.key }, 'season', false),
  ] : [], !!facts.season, facts.availability.season.reason);
  const countText = Object.entries({ wood: '목', fire: '화', earth: '토', metal: '금', water: '수' }).map(([key, name]) => `${name} ${facts.surfaceElements.counts[key]}개`).join(' · ');
  section('surfaceElements', '표면 오행과 지장간을 구분하기', { surfaceElements: facts.surfaceElements }, []);
  result.sections.at(-1).summary = `${countText}. 확정된 천간·지지 ${facts.surfaceElements.total}글자의 단순 집계예요. 지장간과 합산하지 않으며 표면 0을 성격 결핍이나 원국의 완전한 부재로 해석하지 않아요.`;
  for (const key of NATAL_AREAS.filter((key) => key !== 'overview')) area(key);
  result.contentIds = [...new Set(result.sections.flatMap((item) => item.contentIds))];
  result.contentStatus = result.sections.some((item) => ['unavailable-content', 'partial-content'].includes(item.status)) ? 'partial' : 'complete';
  return result;
}
