import test from 'node:test';
import assert from 'node:assert/strict';
import upstream from './vendor/lunar-javascript/lunar.cjs';
import { calculateSaju, annualPillar, springBoundary, tenGodForStems } from '../js/saju-calculator.js';
import { interpretLifetime } from '../js/lifetime-interpreter.js';
import { ANNUAL_READINGS } from '../js/content/lifetime.js';

const now = new Date('2026-10-15T03:00:00Z');
const base = { birthDate: '1990-05-15', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const result = calculateSaju(base, '2026-10-15');

test('annual pillars progress correctly and Korean term intervals are contiguous', () => {
  const expected = ['丙午', '丁未', '戊申', '己酉', '庚戌'];
  for (let index = 0; index < 5; index += 1) {
    const year = annualPillar(2026 + index);
    assert.equal(year.pillar.hanja, expected[index]);
    assert.ok(Date.parse(year.start.instant) < Date.parse(year.end.instant));
    assert.equal(Date.parse(year.start.instant), Date.parse(year.start.koreanTime));
    if (index < 4) assert.deepEqual(year.end, annualPillar(year.year + 1).start);
  }
  assert.throws(() => annualPillar(2051), RangeError);
  assert.throws(() => annualPillar(2026.5), RangeError);
});

test('2024 and 2026 Korean spring boundary matches KASI minute reference within 60 seconds', () => {
  for (const [year, expected] of [[2024, '2024-02-04T17:27:00+09:00'], [2026, '2026-02-04T05:02:00+09:00']]) {
    assert.ok(Math.abs(Date.parse(springBoundary(year).instant) - Date.parse(expected)) <= 60000);
  }
});

test('all 100 stem relationships match the upstream ten-god table', () => {
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const translated = { 比肩: '비견', 劫财: '겁재', 食神: '식신', 伤官: '상관', 偏财: '편재', 正财: '정재', 七杀: '편관', 正官: '정관', 偏印: '편인', 正印: '정인' };
  for (const natal of stems) {
    for (const annual of stems) {
      const expected = translated[upstream.LunarUtil.SHI_SHEN[natal + annual]];
      assert.ok(expected, `${natal}${annual}`);
      const actual = tenGodForStems(natal, annual);
      assert.equal(actual, expected);
      assert.ok(ANNUAL_READINGS[actual].text);
    }
  }
  assert.throws(() => tenGodForStems('A', '甲'), RangeError);
});

test('new year flow changes at Korean spring, not Gregorian January first', () => {
  assert.equal(interpretLifetime(result, new Date('2026-01-01T00:00:00+09:00')).years[0].year, 2025);
  const instant = Date.parse(springBoundary(2026).instant);
  const before = interpretLifetime(result, new Date(instant - 120000));
  const at = interpretLifetime(result, new Date(instant));
  const after = interpretLifetime(result, new Date(instant + 120000));
  assert.equal(before.years[0].year, 2025);
  assert.equal(at.years[0].year, 2026);
  assert.equal(after.years[0].year, 2026);
  assert.equal(at.nearBoundary, true);
  assert.equal(at.years.some((year) => year.current), false);
  assert.equal(after.nearBoundary, false);
  assert.equal(after.years[0].current, true);
});

test('content covers all ten day masters with complete life areas and annual readings', () => {
  const masters = new Set();
  for (let offset = 0; offset < 10; offset += 1) {
    const birthDate = `2000-01-${String(offset + 1).padStart(2, '0')}`;
    const natal = calculateSaju({ ...base, birthDate }, '2026-10-15');
    const reading = interpretLifetime(natal, now);
    masters.add(reading.master.name);
    assert.equal(reading.details.length, 6);
    assert.equal(reading.years.length, 5);
    for (const detail of reading.details) assert.ok(detail.text.length > 30);
    for (const year of reading.years) assert.ok(year.reading.action && year.reading.text);
  }
  assert.equal(masters.size, 10);
});

test('unknown time and lunar equivalent retain supported annual interpretation', () => {
  const unknown = calculateSaju({ ...base, birthDate: '2024-02-04', birthTime: null, unknownTime: true }, '2026-10-15');
  const reading = interpretLifetime(unknown, now);
  assert.equal(reading.years.length, 5);
  assert.ok(reading.note.includes('미확정'));
  const solar = calculateSaju({ ...base, birthDate: '2025-07-25' }, '2026-10-15');
  const lunar = calculateSaju({ ...base, birthDate: '2025-06-01', calendar: 'lunar', leapMonth: true }, '2026-10-15');
  assert.deepEqual(interpretLifetime(solar, now), interpretLifetime(lunar, now));
  assert.deepEqual(interpretLifetime(JSON.parse(JSON.stringify(result)), now), interpretLifetime(result, now));
});

test('empty input, horizon upper bound and invalid query dates are explicit', () => {
  assert.equal(interpretLifetime(null, now), null);
  assert.equal(interpretLifetime(result, new Date('2050-06-01T00:00:00+09:00')).years.length, 1);
  assert.equal(interpretLifetime(result, new Date('2050-01-01T00:00:00+09:00')).years.length, 2);
  assert.throws(() => interpretLifetime(result, new Date('2051-01-01T00:00:00+09:00')), RangeError);
  assert.throws(() => interpretLifetime(result, new Date('invalid')), RangeError);
});
