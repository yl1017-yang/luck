import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaju, springBoundary } from '../js/saju-calculator.js';
import { calculateFortunePeriods } from '../js/fortune-periods.js';
import { validYear, validSelection, defaultSelection, formatFortuneTime } from '../js/fortune-view-state.js';

const result = calculateSaju({ birthDate: '1990-05-15', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false }, '2026-10-16');
test('stored selection rejects wrong types, nonexistent cycles and months', () => {
  const periods = calculateFortunePeriods(result, 2026);
  assert.ok(validSelection({ year: 2026, cycleYear: 2025, month: 12 }, periods));
  for (const value of [null, {}, { year: '2026', cycleYear: 2025, month: 1 }, { year: 2026, cycleYear: 2024, month: 1 }, { year: 2026, cycleYear: 2026, month: 13 }]) assert.equal(validSelection(value, periods), false);
  assert.equal(validYear(1989, result), false);
  assert.equal(validYear(2051, result), false);
  assert.equal(validYear(2050, result), true);
});
test('default cycle follows current spring, with no definite selection within margin', () => {
  const boundary = Date.parse(springBoundary(2026).instant);
  for (const [offset, expected] of [[-61000, 2025], [-60000, null], [0, null], [60000, null], [61000, 2026]]) {
    const now = new Date(boundary + offset);
    assert.equal(defaultSelection(calculateFortunePeriods(result, 2026, now), now).cycleYear, expected);
  }
  const now = new Date('2026-01-01T00:00:00+09:00');
  assert.deepEqual(defaultSelection(calculateFortunePeriods(result, 2027, now), now), { year: 2027, cycleYear: 2027, month: 1 });
});
test('birth-year cycles are clipped and historical display uses fixed UTC+9', () => {
  const periods = calculateFortunePeriods(result, 1990);
  assert.equal(validSelection({ year: 1990, cycleYear: 1989, month: 1 }, periods), false);
  assert.equal(formatFortuneTime('1948-07-01T00:00:00Z'), '1948-07-01 09:00:00');
});
