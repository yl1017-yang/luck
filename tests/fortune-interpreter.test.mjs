import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaju } from '../js/saju-calculator.js';
import { calculateFortunePeriods } from '../js/fortune-periods.js';
import { interpretDetailedFortune } from '../js/fortune-interpreter.js';
import { ANNUAL_DETAILS, DETAIL_AREAS, DETAIL_VERSION } from '../js/content/annual-details.js';
import { MONTHLY_DETAILS, MONTHLY_BRIDGES, MONTHLY_FIELDS, BRIDGE_KEYS } from '../js/content/monthly-details.js';
import { ANNUAL_READINGS } from '../js/content/lifetime.js';

const now = new Date('2026-10-16T00:00:00+09:00');
const profile = { birthDate: '1990-05-15', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const natal = (overrides = {}) => calculateSaju({ ...profile, ...overrides }, '2026-10-16');
const result = natal();
const periods = calculateFortunePeriods(result, 2026, now);
const read = (birth = result, year = 2026) => interpretDetailedFortune(birth, calculateFortunePeriods(birth, year, now));
const catalog = () => structuredClone({ annual: ANNUAL_DETAILS, monthly: MONTHLY_DETAILS, bridges: MONTHLY_BRIDGES, version: DETAIL_VERSION });
const segments = (value) => value.monthlyReadings.flatMap((month) => month.segments);
const nonempty = (value) => assert.ok(typeof value === 'string' && value.trim().length > 0);

test('50 annual areas, 70 monthly fields and 100 unique bridges have complete traceable metadata', () => {
  const ids = new Set();
  const paragraphs = new Set();
  const bridgeTexts = new Set();
  assert.deepEqual(Object.keys(ANNUAL_DETAILS), BRIDGE_KEYS);
  assert.deepEqual(Object.keys(MONTHLY_DETAILS), BRIDGE_KEYS);
  assert.deepEqual(Object.keys(MONTHLY_BRIDGES), BRIDGE_KEYS);
  for (const annual of BRIDGE_KEYS) {
    assert.deepEqual(Object.keys(ANNUAL_DETAILS[annual]), DETAIL_AREAS);
    assert.equal(ANNUAL_DETAILS[annual].overview.title, ANNUAL_READINGS[annual].title);
    for (const area of DETAIL_AREAS) {
      const entry = ANNUAL_DETAILS[annual][area];
      assert.equal(entry.id, `annual.${annual}.${area}`);
      assert.deepEqual(entry.requires, { annualTenGod: annual });
      assert.ok(entry.paragraphs.length >= 2 && entry.paragraphs.length <= 3);
      for (const text of entry.paragraphs) {
        nonempty(text);
        assert.ok(text.split(/[.!?]/).filter((part) => part.trim()).length >= 2, entry.id);
        assert.ok(!paragraphs.has(text), `Repeated paragraph: ${entry.id}`);
        paragraphs.add(text);
      }
      for (const field of ['summary', 'title', 'opportunity', 'caution', 'action']) nonempty(entry[field]);
      ids.add(entry.id);
    }
    assert.equal(MONTHLY_DETAILS[annual].title, ANNUAL_READINGS[annual].title);
    for (const field of MONTHLY_FIELDS) {
      const entry = MONTHLY_DETAILS[annual][field];
      assert.equal(entry.id, `monthly.${annual}.${field}`);
      assert.deepEqual(entry.requires, { monthlyTenGod: annual });
      nonempty(entry.text);
      ids.add(entry.id);
    }
    assert.deepEqual(Object.keys(MONTHLY_BRIDGES[annual]), BRIDGE_KEYS);
    for (const monthly of BRIDGE_KEYS) {
      const entry = MONTHLY_BRIDGES[annual][monthly];
      assert.equal(entry.id, `bridge.${annual}.${monthly}`);
      assert.deepEqual(entry.requires, { annualTenGod: annual, monthlyTenGod: monthly });
      nonempty(entry.text);
      bridgeTexts.add(entry.text);
      ids.add(entry.id);
    }
  }
  assert.equal(ids.size, 220);
  assert.equal(paragraphs.size, 100);
  assert.equal(bridgeTexts.size, 100);
});

test('all 100 annual/monthly combinations are selected from actual periods with matching basis', () => {
  const covered = new Set();
  const masters = new Set();
  for (let day = 1; day <= 10; day += 1) {
    const birth = natal({ birthDate: `1901-01-${String(day).padStart(2, '0')}` });
    masters.add(birth.pillars.day.stem.hanja);
    for (let year = 2020; year <= 2029; year += 1) {
      const value = read(birth, year);
      assert.equal(value.contentStatus, 'complete');
      assert.equal(value.version, '1.0.0');
      for (const annual of value.annualReadings) {
        assert.equal(annual.basis.dayMaster, birth.pillars.day.stem.hanja);
        for (const area of DETAIL_AREAS) assert.equal(annual.areas[area].id, `annual.${annual.tenGod}.${area}`);
      }
      for (const segment of segments(value)) {
        const annual = value.annualPeriods.find((a) => a.id === segment.annualPeriodId);
        covered.add(`${annual.tenGod}/${segment.tenGod}`);
        assert.equal(segment.bridge.id, `bridge.${annual.tenGod}.${segment.tenGod}`);
        assert.equal(segment.basis.annualTenGod, annual.tenGod);
        assert.equal(segment.basis.monthlyTenGod, segment.tenGod);
        assert.equal(segment.basis.start, segment.start);
        assert.equal(segment.basis.end, segment.end);
        assert.equal(segment.reading.action.id, `monthly.${segment.tenGod}.action`);
        assert.equal(segment.contentIds.length, 8);
      }
    }
  }
  assert.equal(masters.size, 10);
  assert.equal(covered.size, 100);
});

test('name, input calendar, reload and unknown birth hour do not change selected content', () => {
  const expected = read();
  assert.deepEqual(read(natal({ name: '다른 이름' })), expected);
  assert.deepEqual(read(JSON.parse(JSON.stringify(result))), expected);
  const solar = natal({ birthDate: '2025-07-25' });
  const lunar = natal({ birthDate: '2025-06-01', calendar: 'lunar', leapMonth: true });
  assert.deepEqual(read(solar), read(lunar));
  const unknown = read(natal({ unknownTime: true, birthTime: null }));
  assert.deepEqual(unknown.annualReadings, expected.annualReadings);
  assert.deepEqual(unknown.monthlyReadings, expected.monthlyReadings);
  assert.ok(unknown.note.includes('미확정'));
  assert.deepEqual(unknown.excludedPillars, ['hour']);
});

test('birth clipping, partial pillars and no-input states never invent a reading', () => {
  assert.equal(interpretDetailedFortune(null, periods), null);
  assert.equal(interpretDetailedFortune(result, null), null);
  const missing = structuredClone(result);
  missing.pillars.day = null;
  const absent = read(missing);
  assert.equal(absent.contentStatus, 'unavailable');
  assert.equal(absent.contentIds.length, 0);
  const birthYear = read(natal({ birthDate: '2024-07-15', unknownTime: true, birthTime: null }), 2024);
  assert.ok(birthYear.monthlyReadings.slice(0, 6).every((m) => m.status === 'before-birth' && m.segments.length === 0));
  const termDay = read(natal({ birthDate: '2024-02-04', unknownTime: true, birthTime: null }));
  assert.equal(termDay.contentStatus, 'complete');
  assert.deepEqual(termDay.excludedPillars, ['year', 'month', 'hour']);
});

test('monthly continuation and spring transition preserve actual annual relationships', () => {
  const value = read(result, 2024);
  const january = value.monthlyReadings[0].segments;
  const february = value.monthlyReadings[1].segments;
  assert.equal(january[0].continuedFromPreviousMonth, false);
  assert.equal(february[0].continuedFromPreviousMonth, true);
  assert.equal(february[1].continuedFromPreviousMonth, false);
  assert.equal(january[1].bridge.id, february[0].bridge.id);
  assert.equal(february[0].basis.cycleYear, 2023);
  assert.equal(february[1].basis.cycleYear, 2024);
  const at = calculateFortunePeriods(result, 2024, new Date(february[1].start));
  const near = interpretDetailedFortune(result, at);
  assert.equal(near.current.nearBoundary, true);
  assert.equal(near.current.activeSegmentId, null);
  assert.deepEqual(near.current.candidateSegmentIds, at.current.candidateSegmentIds);
});

test('missing annual area is isolated and cannot silently fall back to another ten god', () => {
  const edited = catalog();
  const key = periods.annualPeriods[0].tenGod;
  delete edited.annual[key].wealth;
  const value = interpretDetailedFortune(result, periods, edited);
  assert.equal(value.contentStatus, 'partial');
  const annual = value.annualReadings[0];
  assert.equal(annual.areas.wealth.status, 'unavailable-content');
  assert.equal(annual.areas.wealth.summary, undefined);
  assert.equal(annual.areas.work.status, 'available');
  assert.ok(!value.contentIds.includes(`annual.${key}.wealth`));
  assert.ok(segments(value).every((s) => s.status === 'available'));
});

test('missing bridge or wrong monthly metadata suppresses the affected segment, not its dates', () => {
  const baseline = read();
  const target = segments(baseline)[0];
  const edited = catalog();
  delete edited.bridges[target.basis.annualTenGod][target.tenGod];
  const value = interpretDetailedFortune(result, periods, edited);
  const segment = segments(value)[0];
  assert.equal(value.contentStatus, 'partial');
  assert.equal(segment.status, 'unavailable-content');
  assert.equal(segment.reading, undefined);
  assert.equal(segment.bridge, undefined);
  assert.equal(segment.start, target.start);
  assert.equal(segment.end, target.end);
  assert.deepEqual(segment.contentIds, []);
  const wrong = catalog();
  wrong.monthly[target.tenGod].action.requires.monthlyTenGod = 'wrong';
  assert.equal(segments(interpretDetailedFortune(result, periods, wrong))[0].status, 'unavailable-content');
});

test('calculation failures remain distinct from before-birth months and incomplete content', () => {
  const broken = structuredClone(periods);
  broken.status = 'calculation-error';
  broken.months[3] = { month: 4, status: 'calculation-error', segments: [] };
  const value = interpretDetailedFortune(result, broken);
  assert.equal(value.status, 'calculation-error');
  assert.equal(value.contentStatus, 'partial');
  assert.equal(value.monthlyReadings[3].status, 'calculation-error');
  assert.equal(value.monthlyReadings[3].segments.length, 0);
  assert.equal(value.monthlyReadings[4].status, 'available');
});

test('mismatched day master, birth range, annual link or ten god is rejected', () => {
  assert.throws(() => interpretDetailedFortune(natal({ birthDate: '1990-05-16' }), periods), RangeError);
  const changedDate = structuredClone(result);
  changedDate.dates.solar = { year: 2026, month: 7, day: 1 };
  assert.throws(() => interpretDetailedFortune(changedDate, periods), RangeError);
  for (const change of [
    (p) => { p.annualPeriods[0].tenGod = 'wrong'; },
    (p) => { p.months[0].segments[0].annualPeriodId = 'missing'; },
    (p) => { p.months[0].segments[0].tenGod = 'wrong'; },
    (p) => { p.year = 2051; },
  ]) {
    const changed = structuredClone(periods);
    change(changed);
    assert.throws(() => interpretDetailedFortune(result, changed), RangeError);
  }
});

test('outputs do not mutate the catalog or calculation and selection is deterministic', () => {
  const before = JSON.stringify({ result, periods, ANNUAL_DETAILS, MONTHLY_DETAILS, MONTHLY_BRIDGES });
  const first = read();
  const second = read();
  assert.deepEqual(first, second);
  first.annualReadings[0].areas.overview.paragraphs[0] = 'changed';
  first.monthlyReadings[0].segments[0].reading.action.text = 'changed';
  first.monthlyReadings[0].segments[0].bridge.text = 'changed';
  assert.deepEqual(read(), second);
  assert.equal(JSON.stringify({ result, periods, ANNUAL_DETAILS, MONTHLY_DETAILS, MONTHLY_BRIDGES }), before);
});

test('editorial data excludes deterministic event promises and consequential directives', () => {
  const text = JSON.stringify({ ANNUAL_DETAILS, MONTHLY_DETAILS, MONTHLY_BRIDGES });
  for (const pattern of [/반드시 성공/, /횡재할/, /승진하게/, /병에 걸/, /수익을 보장/, /대출을 받으/, /복권을 사/, /투자하세/, /약을 끊/, /결혼하게/, /임신하게/]) {
    assert.ok(!pattern.test(text), String(pattern));
  }
  // This lexical check complements, and does not replace, editorial reading.
});
