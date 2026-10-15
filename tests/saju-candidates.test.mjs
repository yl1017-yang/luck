import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import manseryeok from './vendor/manseryeok/index.cjs';
import KoreanLunarCalendar from '../js/vendor/korean-lunar-calendar/calendar.mjs';
import { termsByYear, dailyReferences } from './fixtures/kasi-terms.mjs';
import { Solar, koreanTerms, pillarsAt, candidateProfile, parseWallTime } from './helpers/saju-candidate.mjs';

test('lunar engine has a browser-global build without npm or Node runtime APIs', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('./vendor/lunar-javascript/lunar.cjs', import.meta.url), 'utf8'), context);
  assert.equal(typeof context.Solar.fromYmdHms, 'function');
  assert.equal(context.Solar.fromYmd(2024, 2, 10).getLunar().getDayInGanZhiExact2(), '甲辰');
});

test('reject manseryeok as a direct engine: no intraday year/month transition', () => {
  const options = { applyTimeCorrection: false };
  const before = manseryeok.calculateSaju(2024, 2, 4, 0, 0, options);
  const after = manseryeok.calculateSaju(2024, 2, 4, 23, 0, options);
  assert.equal(before.yearPillarHanja, after.yearPillarHanja);
  assert.equal(before.monthPillarHanja, after.monthPillarHanja);
  assert.equal(before.yearPillarHanja, '甲辰'); // Already changes at 00:00.
  assert.equal(pillarsAt('2024-02-04 00:00:00').year, '癸卯');
  assert.throws(() => manseryeok.getSolarTermsByYear(1900));
});

test('48 KASI minute-resolution solar terms agree within 60 seconds after UTC+9 conversion', () => {
  let maxDifference = 0;
  for (const [yearText, references] of Object.entries(termsByYear)) {
    const year = Number(yearText);
    const computed = koreanTerms(year);
    assert.equal(computed.length, 24);
    references.forEach((reference, index) => {
      const expected = parseWallTime(`${year}-${reference}:00`);
      const difference = Math.abs(computed[index] - expected) / 1000;
      maxDifference = Math.max(maxDifference, difference);
      assert.ok(difference <= 60, `${year} term ${index}: difference ${difference}s`);
    });
  }
  console.log(`KASI comparison: 48 terms; max absolute difference ${maxDifference}s`);
});

test('KST year/month transition before and after independent KASI term minutes', () => {
  for (const [year, references] of Object.entries(termsByYear)) {
    // Even indexes are the twelve month-boundary terms, starting at minor cold.
    for (let index = 0; index < 24; index += 2) {
      const reference = parseWallTime(`${year}-${references[index]}:00`);
      const wall = (delta) => new Date(reference.getTime() + delta).toISOString().slice(0, 19).replace('T', ' ');
      const before = pillarsAt(wall(-120000));
      const after = pillarsAt(wall(120000));
      assert.notEqual(before.month, after.month, `${year} term ${index}`);
      if (index === 2) assert.notEqual(before.year, after.year);
      else assert.equal(before.year, after.year);
    }
  }
  assert.equal(pillarsAt('2024-02-04 17:26:00').year, '癸卯');
  assert.equal(pillarsAt('2024-02-04 17:28:00').year, '甲辰');
  assert.equal(pillarsAt('2024-03-05 11:21:00').month, '丙寅');
  assert.equal(pillarsAt('2024-03-05 11:25:00').month, '丁卯');
});

test('21 independently sourced KASI day pillars', () => {
  for (const [date, expected] of dailyReferences) {
    assert.equal(pillarsAt(`${date} 12:00:00`).day, expected, date);
  }
});

test('exact engine-defined boundary is inclusive and KST date rollover is preserved', () => {
  const terms = koreanTerms(2024);
  const wall = (date) => date.toISOString().slice(0, 19).replace('T', ' ');
  for (let index = 0; index < 24; index += 2) {
    const term = terms[index];
    const before = pillarsAt(wall(new Date(term.getTime() - 1000)));
    const at = pillarsAt(wall(term));
    const after = pillarsAt(wall(new Date(term.getTime() + 1000)));
    assert.notEqual(before.month, at.month);
    assert.equal(at.month, after.month);
    if (index === 2) {
      assert.notEqual(before.year, at.year);
      assert.equal(at.year, after.year);
    }
  }
  // Chinese UTC+8 December 6 23:17 is December 7 00:17 in UTC+9.
  assert.equal(wall(terms[22]).slice(0, 16), '2024-12-07 00:17');
  assert.equal(pillarsAt('2024-12-06 23:59:00').month, '乙亥');
  assert.equal(pillarsAt('2024-12-07 00:19:00').month, '丙子');
});

test('midnight policy and KST two-hour branches; native lunar hour requires adaptation', () => {
  const at2259 = pillarsAt('1988-02-15 22:59:00');
  const at2300 = pillarsAt('1988-02-15 23:00:00');
  const at2359 = pillarsAt('1988-02-15 23:59:00');
  const midnight = pillarsAt('1988-02-16 00:00:00');
  assert.deepEqual([at2259.day, at2300.day, at2359.day, midnight.day], ['庚子', '庚子', '庚子', '辛丑']);
  assert.deepEqual([at2259.hour, at2300.hour, at2359.hour, midnight.hour], ['丁亥', '丙子', '丙子', '戊子']);
  const native = Solar.fromYmdHms(1988, 2, 15, 23, 30, 0).getLunar().getEightChar();
  native.setSect(2);
  assert.equal(native.getDay(), '庚子');
  assert.equal(native.getTime(), '戊子'); // Conflicts with the chosen midnight policy.
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  for (let hour = 0; hour < 24; hour += 1) {
    const result = pillarsAt(`2024-06-01 ${String(hour).padStart(2, '0')}:00:00`);
    assert.equal(result.hour[1], branches[Math.floor((hour + 1) / 2) % 12]);
  }
});

test('time unknown omits hour and marks solar-term day ambiguity', () => {
  const profile = { birthDate: '2024-02-04', calendar: 'solar', leapMonth: false, unknownTime: true, birthTime: null };
  const result = candidateProfile(profile);
  assert.equal(result.hour, null);
  assert.equal(result.year, null);
  assert.equal(result.month, null);
  assert.deepEqual(result.uncertain, ['year', 'month']);
  const normal = candidateProfile({ ...profile, birthDate: '2024-02-10' });
  assert.deepEqual(normal.uncertain, []);
  assert.equal(normal.day, '甲辰');
  const lunar = { ...profile, birthDate: '2025-06-01', calendar: 'lunar', leapMonth: true, birthTime: '14:30', unknownTime: false };
  assert.deepEqual(candidateProfile(lunar), candidateProfile({ ...lunar, birthDate: '2025-07-25', calendar: 'solar', leapMonth: false }));
});

test('1900-2026 execution coverage, monthly day-pillar cross-check and chronological terms', () => {
  const calendar = new KoreanLunarCalendar();
  const supportedTerms = [];
  let comparisons = 0;
  for (let year = 1900; year <= 2026; year += 1) {
    const terms = koreanTerms(year);
    assert.equal(terms.length, 24, String(year));
    assert.ok(terms.every((term, index) => index === 0 || term > terms[index - 1]));
    supportedTerms.push(terms.length);
    for (let month = 1; month <= 12; month += 1) {
      if (year === 2026 && month > 10) continue;
      const date = `${year}-${String(month).padStart(2, '0')}-15`;
      assert.ok(calendar.setSolarDate(year, month, 15));
      assert.equal(pillarsAt(`${date} 12:00:00`).day, calendar.getChineseGapja().day.slice(0, 2), date);
      comparisons += 1;
    }
  }
  console.log(`Range smoke test: ${supportedTerms.length} years, ${supportedTerms.reduce((a, b) => a + b, 0)} terms, ${comparisons} monthly day samples`);
});
