import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFortunePeriods } from '../js/fortune-periods.js';
import { calculateSaju, tenGodForStems } from '../js/saju-calculator.js';
import { termsByYear } from './fixtures/kasi-terms.mjs';

const now = new Date('2026-10-16T00:00:00+09:00');
const profile = { birthDate: '1900-01-01', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const natal = (overrides = {}) => calculateSaju({ ...profile, ...overrides }, '2026-10-16');
const result = natal();
const all = (value) => value.months.flatMap((month) => month.segments);

test('every supported year covers exactly the calendar year without gaps or overlaps', () => {
  for (let year = 1901; year <= 2050; year += 1) {
    const value = calculateFortunePeriods(result, year, now);
    assert.equal(value.status, 'available');
    assert.equal(value.months.length, 12);
    assert.equal(value.annualPeriods.length, 2);
    const segments = all(value);
    assert.equal(segments[0].start, value.range.start);
    assert.equal(segments.at(-1).end, value.range.end);
    assert.equal(new Set(segments.map((s) => s.id)).size, segments.length);
    segments.forEach((segment, index) => {
      assert.ok(segment.start < segment.end);
      assert.ok(segment.sourceStart <= segment.start && segment.end <= segment.sourceEnd);
      if (index) assert.equal(segments[index - 1].end, segment.start);
      const annual = value.annualPeriods.find((a) => a.id === segment.annualPeriodId);
      assert.ok(annual.start <= segment.start && segment.end <= annual.end);
    });
  }
});

test('known 2024 month pillars and annual cycles change at solar terms, not month starts', () => {
  const value = calculateFortunePeriods(result, 2024, now);
  const expected = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥', '丙子'];
  assert.deepEqual([...new Map(all(value).map((s) => [s.sourceStart, s.pillar.hanja])).values()], expected);
  assert.deepEqual(value.annualPeriods.map((a) => a.pillar.hanja), ['癸卯', '甲辰']);
  assert.equal(value.months[0].segments[1].annualPeriodId, 'annual-2023');
  assert.equal(value.months[1].segments[0].annualPeriodId, 'annual-2023');
  assert.equal(value.months[1].segments[1].annualPeriodId, 'annual-2024');
  assert.equal(value.months[2].segments[0].sourceStart, value.months[1].segments[1].sourceStart);
});

test('24 independent KASI monthly boundaries agree within 60 seconds and switch outside the margin', () => {
  for (const year of [2024, 2026]) {
    const value = calculateFortunePeriods(result, year, now);
    for (let month = 1; month <= 12; month += 1) {
      const reference = Date.parse(`${year}-${termsByYear[year][(month - 1) * 2].replace(' ', 'T')}:00+09:00`);
      const [before, after] = value.months[month - 1].segments;
      assert.ok(Math.abs(Date.parse(after.start) - reference) <= 60000);
      assert.equal(calculateFortunePeriods(result, year, new Date(reference - 120000)).current.activeSegmentId, before.id);
      assert.equal(calculateFortunePeriods(result, year, new Date(reference + 120000)).current.activeSegmentId, after.id);
    }
  }
});

test('exact boundaries are inclusive while current highlighting is withheld for inclusive ±60 seconds', () => {
  const value = calculateFortunePeriods(result, 2024, now);
  for (const month of value.months) {
    const [before, after] = month.segments;
    const boundary = Date.parse(after.start);
    for (const offset of [-60000, -1, 0, 1, 60000]) {
      const current = calculateFortunePeriods(result, 2024, new Date(boundary + offset)).current;
      assert.equal(current.nearBoundary, true);
      assert.equal(current.activeSegmentId, null);
      assert.deepEqual(current.candidateSegmentIds, [before.id, after.id]);
    }
    assert.equal(calculateFortunePeriods(result, 2024, new Date(boundary - 60001)).current.activeSegmentId, before.id);
    assert.equal(calculateFortunePeriods(result, 2024, new Date(boundary + 60001)).current.activeSegmentId, after.id);
    const local = new Date(boundary + 9 * 3600000).toISOString();
    // Compare actual calculator at representable minutes outside its ambiguity window.
    const inputDate = local.slice(0, 10);
    const later = new Date(boundary + 9 * 3600000 + 120000).toISOString();
    const actual = natal({ birthDate: inputDate, birthTime: later.slice(11, 16) });
    assert.equal(actual.pillars.month.hanja, after.pillar.hanja);
  }
});

test('birth year is clipped by solar birth day and unknown time does not create a birth timestamp', () => {
  const birth = natal({ birthDate: '2024-07-15', unknownTime: true, birthTime: null });
  const original = JSON.stringify(birth);
  const value = calculateFortunePeriods(birth, 2024, now);
  assert.equal(value.range.start, '2024-07-14T15:00:00.000Z');
  assert.equal(value.annualPeriods.length, 1);
  assert.ok(value.months.slice(0, 6).every((m) => m.status === 'before-birth' && !m.segments.length));
  assert.equal(all(value)[0].start, value.range.start);
  assert.deepEqual(value.excludedPillars, ['hour']);
  assert.equal(value.partial, true);
  assert.equal(JSON.stringify(birth), original);
  assert.throws(() => calculateFortunePeriods(birth, 2023, now), RangeError);
  const lastDay = calculateFortunePeriods(natal({ birthDate: '2024-12-31' }), 2024, now);
  assert.equal(all(lastDay).length, 1);
  assert.equal(Date.parse(lastDay.range.end) - Date.parse(lastDay.range.start), 86400000);
});

test('partial natal pillars and lunar leap equivalent use the same confirmed day master', () => {
  const partial = natal({ birthDate: '2024-02-04', unknownTime: true, birthTime: null });
  const value = calculateFortunePeriods(partial, 2026, now);
  assert.deepEqual(value.excludedPillars, ['year', 'month', 'hour']);
  assert.equal(value.status, 'available');
  const solar = natal({ birthDate: '2025-07-25' });
  const lunar = natal({ birthDate: '2025-06-01', calendar: 'lunar', leapMonth: true });
  assert.deepEqual(calculateFortunePeriods(solar, 2026, now), calculateFortunePeriods(lunar, 2026, now));
  const missing = structuredClone(result);
  missing.pillars.day = null;
  assert.equal(calculateFortunePeriods(missing, 2026, now).status, 'unavailable-day-master');
});

test('ten gods use natal stem for both annual and monthly pillars across all ten day masters', () => {
  for (let day = 1; day <= 10; day += 1) {
    const birth = natal({ birthDate: `2000-01-${String(day).padStart(2, '0')}` });
    const value = calculateFortunePeriods(birth, 2026, now);
    for (const period of [...value.annualPeriods, ...all(value)]) {
      assert.equal(period.tenGod, tenGodForStems(birth.pillars.day.stem.hanja, period.pillar.stem.hanja));
    }
  }
});

test('leap day, KST rollover, year edge and horizon closure retain exact instants', () => {
  const leap = calculateFortunePeriods(result, 2024, new Date('2024-03-01T00:00:00+09:00'));
  assert.equal(leap.current.activeSegmentId, leap.months[2].segments[0].id);
  assert.equal(Date.parse(leap.months[1].segments.at(-1).end) - Date.parse(leap.months[1].segments[0].start), 29 * 86400000);
  const december = leap.months[11].segments[1];
  assert.equal(new Date(Date.parse(december.start) + 9 * 3600000).toISOString().slice(0, 10), '2024-12-07');
  const last = calculateFortunePeriods(result, 2050, now);
  assert.ok(all(last).at(-1).sourceEnd.startsWith('2051-01'));
  assert.ok(last.annualPeriods.at(-1).sourceEnd.startsWith('2051-02'));
  assert.equal(last.current.activeSegmentId, null);
  assert.equal(calculateFortunePeriods(result, 2024, new Date(leap.range.end)).current.activeSegmentId, null);
});

test('invalid request is explicit and repeated calls do not share mutable objects', () => {
  assert.equal(calculateFortunePeriods(null, 2026, now), null);
  for (const year of [1900, 2051, 2026.5, '2026', NaN]) {
    assert.throws(() => calculateFortunePeriods(result, year, now), RangeError);
  }
  assert.throws(() => calculateFortunePeriods(result, 2026, new Date('invalid')), RangeError);
  assert.throws(() => calculateFortunePeriods({}, 2026, now), RangeError);
  const malformed = structuredClone(result);
  malformed.dates.solar = { year: 2000, month: 2, day: 30 };
  assert.throws(() => calculateFortunePeriods(malformed, 2026, now), RangeError);
  const first = calculateFortunePeriods(result, 2026, now);
  const second = calculateFortunePeriods(result, 2026, now);
  first.months[0].segments[0].pillar.stem.hanja = 'X';
  assert.notEqual(second.months[0].segments[0].pillar.stem.hanja, 'X');
  assert.notEqual(first.months[1].segments[0].pillar.stem.hanja, 'X');
});
