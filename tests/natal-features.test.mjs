import test from 'node:test';
import assert from 'node:assert/strict';
import upstream from './vendor/lunar-javascript/lunar.cjs';
import { calculateSaju, describePillar, springBoundary } from '../js/saju-calculator.js';
import { calculateNatalFeatures, NATAL_AREAS } from '../js/natal-features.js';
import { HIDDEN_STEMS, HIDDEN_STEMS_TABLE_ID, MONTH_SEASONS } from '../js/content/natal-tables.js';

const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];
const profile = { birthDate: '1990-05-15', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const natal = (overrides = {}, today = '2026-10-19') => calculateSaju({ ...profile, ...overrides }, today);
const base = natal();
const translate = { 比肩: '비견', 劫财: '겁재', 食神: '식신', 伤官: '상관', 偏财: '편재', 正财: '정재', 七杀: '편관', 正官: '정관', 偏印: '편인', 正印: '정인' };
const expectedTenGod = (day, other) => translate[upstream.LunarUtil.SHI_SHEN[day + other]];
const pillarForStem = (stem) => describePillar(stem + (STEMS.indexOf(stem) % 2 ? '丑' : '子'));

// Synthetic feature-level fixtures isolate combinations; not claimed birth charts.
function fixture(pillars = {}, masterMissing = false) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(pillars)) result.pillars[key] = typeof value === 'string' ? describePillar(value) : value;
  result.features.elements = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const pillar of Object.values(result.pillars)) {
    if (!pillar) continue;
    result.features.elements[pillar.stem.element] += 1;
    result.features.elements[pillar.branch.element] += 1;
  }
  result.features.elementCount = Object.values(result.features.elements).reduce((sum, n) => sum + n, 0);
  result.features.partial = Object.values(result.pillars).includes(null);
  result.features.dayMaster = masterMissing ? null : result.pillars.day?.stem ?? null;
  return result;
}

test('versioned 12-branch tables match the adopted upstream table without treating it as independent validation', () => {
  assert.equal(Object.keys(HIDDEN_STEMS).length, 12);
  assert.equal(Object.values(HIDDEN_STEMS).flat().length, 28);
  assert.ok(Object.isFrozen(HIDDEN_STEMS));
  for (const branch of BRANCHES) {
    assert.deepEqual(HIDDEN_STEMS[branch], upstream.LunarUtil.ZHI_HIDE_GAN[branch]);
    assert.ok(Object.isFrozen(HIDDEN_STEMS[branch]));
  }
  assert.equal(Object.keys(MONTH_SEASONS).length, 12);
});

test('all 100 stem relationships distinguish self from the same stem in another position', () => {
  for (const day of STEMS) {
    for (const other of STEMS) {
      const result = calculateNatalFeatures(fixture({ day: pillarForStem(day), year: pillarForStem(other) }));
      assert.deepEqual(result.pillars.day.stemRelation, { kind: 'self', tenGod: null });
      assert.deepEqual(result.pillars.year.stemRelation, { kind: 'ten-god', tenGod: expectedTenGod(day, other) });
      assert.equal(result.status, 'available');
    }
  }
});

test('280 day-master/hidden-stem relationships preserve 12 branches, positions, roles and order', () => {
  for (const day of STEMS) {
    for (const branch of BRANCHES) {
      const monthCode = (BRANCHES.indexOf(branch) % 2 ? '乙' : '甲') + branch;
      const value = calculateNatalFeatures(fixture({ day: pillarForStem(day), month: monthCode }));
      const hidden = value.pillars.month.hiddenStems;
      assert.equal(hidden.length, HIDDEN_STEMS[branch].length);
      hidden.forEach((item, i) => {
        assert.equal(item.stem.hanja, HIDDEN_STEMS[branch][i]);
        assert.deepEqual(item.stem, pillarForStem(item.stem.hanja).stem);
        assert.equal(item.tenGod, expectedTenGod(day, item.stem.hanja));
        assert.equal(item.role, ['main', 'middle', 'residual'][i]);
        assert.equal(item.order, i + 1);
        assert.equal(item.tableId, HIDDEN_STEMS_TABLE_ID);
      });
      assert.equal(value.context.source, 'month-stem');
      assert.equal(value.context.tenGod, expectedTenGod(day, monthCode[0]));
    }
  }
});

test('60 actual consecutive birth days retain every day pillar and reject parity-invalid codes', () => {
  const seen = new Set();
  for (let index = 0; index < 60; index += 1) {
    const birthDate = new Date(Date.UTC(2000, 0, 1 + index)).toISOString().slice(0, 10);
    const result = natal({ birthDate });
    const value = calculateNatalFeatures(result);
    seen.add(value.dayPillar.hanja);
    assert.deepEqual(value.dayPillar, result.pillars.day);
    assert.deepEqual(value.dayMaster, result.pillars.day.stem);
    assert.ok(NATAL_AREAS.every((key) => value.availability[key].status === 'available'));
  }
  assert.equal(seen.size, 60);
  const invalid = structuredClone(base);
  invalid.pillars.day = describePillar('甲丑');
  assert.throws(() => calculateNatalFeatures(invalid), RangeError);
});

test('fixed monthly seasons, end-of-season earth and the Gui/Hai reference follow actual branches', () => {
  const expected = { 寅: 'spring', 卯: 'spring', 辰: 'spring', 巳: 'summer', 午: 'summer', 未: 'summer', 申: 'autumn', 酉: 'autumn', 戌: 'autumn', 亥: 'winter', 子: 'winter', 丑: 'winter' };
  const terms = ['대설', '소한', '입춘', '경칩', '청명', '입하', '망종', '소서', '입추', '백로', '한로', '입동'];
  BRANCHES.forEach((branch, i) => {
    const value = calculateNatalFeatures(fixture({ month: (i % 2 ? '乙' : '甲') + branch }));
    assert.equal(value.season.key, expected[branch]);
    assert.equal(value.season.termName, terms[i]);
    assert.equal(value.season.monthBranch.hanja, branch);
    if ([...'辰未戌丑'].includes(branch)) assert.equal(value.season.monthElement, 'earth');
  });
  const gui = calculateNatalFeatures(fixture({ day: '癸未', month: '癸亥' }));
  assert.equal(gui.context.tenGod, '비견');
  assert.deepEqual(gui.pillars.month.hiddenStems.map((item) => item.tenGod), ['겁재', '상관']);
});

test('surface counts stay separate from hidden stems and repeated positions are preserved', () => {
  const birth = fixture({ year: '甲子', month: '甲子', day: '甲子', hour: '甲子' });
  const value = calculateNatalFeatures(birth);
  assert.deepEqual(value.surfaceElements, { counts: { wood: 4, fire: 0, earth: 0, metal: 0, water: 4 }, total: 8, kind: 'surface-characters' });
  assert.equal(Object.values(value.pillars).flatMap((p) => p.hiddenStems).length, 4);
  const earthHidden = calculateNatalFeatures(fixture({ year: '甲寅', month: '甲寅', day: '甲寅', hour: '甲寅' }));
  assert.equal(earthHidden.surfaceElements.counts.earth, 0);
  assert.ok(earthHidden.pillars.day.hiddenStems.some((item) => item.stem.element === 'earth'));
  for (const forbidden of ['strength', 'yongShen', 'score', 'luck', 'dominantTenGod']) assert.equal(Object.hasOwn(earthHidden, forbidden), false);
});

test('unknown birth time excludes only the hour on a normal day', () => {
  const value = calculateNatalFeatures(natal({ unknownTime: true, birthTime: null }));
  assert.equal(value.pillars.hour, null);
  assert.deepEqual(value.excludedPillars, ['hour']);
  assert.equal(value.partial, true);
  assert.equal(value.availability['pillars.hour'].reason, 'unknown-time');
  assert.ok(value.season);
  assert.equal(value.context.source, 'month-stem');
  assert.ok(NATAL_AREAS.every((key) => value.availability[key].status === 'available' && value.availability[key].partial));
});

test('term-day ambiguity and both sides of the spring margin never reintroduce candidate pillars', () => {
  for (const options of [{ birthTime: '17:27' }, { unknownTime: true, birthTime: null }]) {
    const birth = natal({ birthDate: '2024-02-04', ...options });
    const value = calculateNatalFeatures(birth);
    assert.equal(value.pillars.year, null);
    assert.equal(value.pillars.month, null);
    assert.equal(value.season, null);
    assert.deepEqual(value.uncertainty, birth.uncertainty);
    assert.equal(value.availability['pillars.month'].reason, 'uncertain-pillar');
    assert.equal(value.context.source, 'day-branch-main');
    assert.equal(value.context.tenGod, value.pillars.day.hiddenStems[0].tenGod);
    assert.equal(value.availability.overview.status, 'available');
  }
  const boundary = Date.parse(springBoundary(2024).instant);
  for (const offset of [-120000, -60000, 0, 60000, 120000]) {
    const local = new Date(boundary + offset + 9 * 3600000).toISOString();
    const birth = natal({ birthDate: local.slice(0, 10), birthTime: local.slice(11, 16) });
    const value = calculateNatalFeatures(birth);
    assert.equal(value.season === null, birth.pillars.month === null);
    assert.equal(value.context.source, birth.pillars.month ? 'month-stem' : 'day-branch-main');
  }
  const onlyYear = calculateNatalFeatures(fixture({ year: null }));
  assert.ok(onlyYear.season);
  assert.equal(onlyYear.context.source, 'month-stem');
});

test('lunar leap equivalent, optional name, later validation date and storage roundtrip are invariant', () => {
  const solar = natal({ birthDate: '2025-07-25' });
  const lunar = natal({ birthDate: '2025-06-01', calendar: 'lunar', leapMonth: true });
  const expected = calculateNatalFeatures(solar);
  assert.deepEqual(calculateNatalFeatures(lunar), expected);
  assert.deepEqual(calculateNatalFeatures(JSON.parse(JSON.stringify(solar))), expected);
  assert.deepEqual(calculateNatalFeatures(natal({ birthDate: '2025-07-25', displayName: '다른 이름' }, '2026-12-31')), expected);
  assert.ok(calculateNatalFeatures(natal({ birthDate: '1900-01-01' })));
  assert.ok(calculateNatalFeatures(natal({ birthDate: '2050-12-31' }, '2050-12-31')));
});

test('missing confirmed day or explicit unavailable master suppresses interpretations without guessing', () => {
  const missingDay = calculateNatalFeatures(fixture({ day: null }));
  assert.equal(missingDay.status, 'unavailable-day-pillar');
  assert.equal(missingDay.dayMaster, null);
  assert.equal(missingDay.context, null);
  const missingMaster = calculateNatalFeatures(fixture({}, true));
  assert.equal(missingMaster.status, 'unavailable-day-master');
  assert.equal(missingMaster.pillars.day.stemRelation, null);
  assert.ok(missingMaster.pillars.day.hiddenStems.every((item) => item.tenGod === null));
  for (const value of [missingDay, missingMaster]) {
    assert.ok(NATAL_AREAS.every((key) => value.availability[key].status === 'unavailable-feature'));
    assert.equal(value.availability.surfaceElements.status, 'available');
  }
});

test('null input is empty while malformed codes, metadata, counts, policy and uncertainty fail explicitly', () => {
  assert.equal(calculateNatalFeatures(null), null);
  for (const value of [{}, [], 'bad']) assert.throws(() => calculateNatalFeatures(value), RangeError);
  for (const mutate of [
    (r) => { delete r.pillars.hour; }, (r) => { r.pillars.year = undefined; },
    (r) => { r.pillars.day.stem.element = 'fire'; }, (r) => { r.pillars.year.hangul = '잘못'; },
    (r) => { r.features.dayMaster = pillarForStem('甲').stem; },
    (r) => { r.features.elements.wood += 1; }, (r) => { r.features.elementCount = 100; },
    (r) => { r.features.partial = true; }, (r) => { r.profile.unknownTime = true; },
    (r) => { r.policy.dayBoundary = '23:00'; }, (r) => { r.dates.solar.month = 99; },
    (r) => { r.uncertainty.pillars = ['month']; },
    (r) => { r.uncertainty.alternatives.month = [r.pillars.month, r.pillars.month]; },
  ]) {
    const malformed = structuredClone(base);
    mutate(malformed);
    assert.throws(() => calculateNatalFeatures(malformed), RangeError);
  }
  assert.throws(() => natal({ birthDate: '2024-02-30' }), RangeError);
});

test('results and frozen tables never share mutable metadata or alter calculator output', () => {
  const before = JSON.stringify(base);
  const first = calculateNatalFeatures(base);
  const second = calculateNatalFeatures(base);
  assert.deepEqual(first, second);
  first.dayMaster.hanja = 'changed';
  first.pillars.year.hiddenStems[0].stem.hangul = 'changed';
  first.pillars.day.pillar.branch.hanja = 'changed';
  first.season.monthBranch.hanja = 'changed';
  first.surfaceElements.counts.wood = 99;
  first.policy.termMarginSeconds = 0;
  assert.deepEqual(calculateNatalFeatures(base), second);
  assert.equal(JSON.stringify(base), before);
});
