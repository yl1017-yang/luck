import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateSaju } from '../js/saju-calculator.js';
import { candidateProfile } from './helpers/saju-candidate.mjs';

const today = '2026-10-15';
const profile = (birthDate, birthTime = '12:00') => ({
  birthDate, birthTime, calendar: 'solar', leapMonth: false, unknownTime: birthTime === null,
});
const raw = (result) => Object.fromEntries(Object.entries(result.pillars).map(([key, value]) => [key, value?.hanja ?? null]));

test('ESM vendor transformation preserves the original calculation factory exactly', () => {
  const upstream = readFileSync(new URL('./vendor/lunar-javascript/lunar.cjs', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const esm = readFileSync(new URL('../js/vendor/lunar-javascript/lunar.mjs', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const body = upstream.split('})(this,function(){')[1].trimEnd().slice(0, -3);
  assert.ok(esm.includes('const engine = (function(){' + body + '})();'));
});

test('production calculator matches validated adapter across dates and hour boundaries', () => {
  for (const date of ['1900-01-01', '1988-02-15', '2000-02-29', '2024-02-10', '2025-07-25']) {
    for (const time of ['00:00', '00:59', '01:00', '02:59', '03:00', '22:59', '23:00', '23:59']) {
      const input = profile(date, time);
      const { uncertain, ...expected } = candidateProfile(input);
      assert.deepEqual(raw(calculateSaju(input, today)), expected, `${date} ${time}`);
    }
  }
});

test('known input returns reusable features and eight explicit element assignments', () => {
  const result = calculateSaju(profile('2024-02-10'), today);
  assert.equal(result.pillars.day.hanja, '甲辰');
  assert.equal(result.pillars.day.hangul, '갑진');
  assert.equal(result.features.dayMaster.element, 'wood');
  assert.equal(result.features.elementCount, 8);
  assert.equal(result.features.partial, false);
  assert.equal(result.policy.dayBoundary, '00:00');
});

test('unknown time never creates an hour pillar and preserves term-day ambiguity', () => {
  const normal = calculateSaju(profile('2024-02-10', null), today);
  assert.equal(normal.profile.birthTime, null);
  assert.equal(normal.pillars.hour, null);
  assert.equal(normal.features.elementCount, 6);
  const boundary = calculateSaju(profile('2024-02-04', null), today);
  assert.equal(boundary.pillars.year, null);
  assert.equal(boundary.pillars.month, null);
  assert.equal(boundary.features.elementCount, 2);
  assert.deepEqual(boundary.uncertainty.pillars, ['year', 'month']);
});

test('term margin protects minute-resolution boundary and retains both alternatives', () => {
  const result = calculateSaju(profile('2024-02-04', '17:27'), today);
  assert.equal(result.uncertainty.reason, 'near-term-boundary');
  assert.equal(result.pillars.year, null);
  assert.deepEqual(result.uncertainty.alternatives.year.map((pillar) => pillar.hanja), ['癸卯', '甲辰']);
  assert.equal(calculateSaju(profile('2024-02-04', '17:25'), today).pillars.year.hanja, '癸卯');
  assert.equal(calculateSaju(profile('2024-02-04', '17:29'), today).pillars.year.hanja, '甲辰');
});

test('lunar leap date and restored profiles calculate consistently; invalid input is rejected', () => {
  const lunar = { ...profile('2025-06-01'), calendar: 'lunar', leapMonth: true };
  assert.deepEqual(raw(calculateSaju(lunar, today)), raw(calculateSaju(profile('2025-07-25'), today)));
  assert.deepEqual(calculateSaju(JSON.parse(JSON.stringify(lunar)), today), calculateSaju(lunar, today));
  assert.throws(() => calculateSaju({ ...lunar, birthDate: '2024-01-01' }, today), RangeError);
  assert.throws(() => calculateSaju(profile('2027-01-01'), today), RangeError);
  assert.throws(() => calculateSaju(profile('2024-02-10', '24:00'), today), RangeError);
});
