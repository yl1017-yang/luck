import test from 'node:test';
import assert from 'node:assert/strict';
import { convertBirthDate, formatCalendarDate } from '../js/calendar.js';
import { validateProfile, normalizeProfile, koreaDate } from '../js/profile.js';
import { selectableDays, selectableMonths } from '../js/date-options.js';

const profile = (birthDate, calendar = 'solar', leapMonth = false) => ({
  birthDate, calendar, leapMonth, birthTime: null, unknownTime: true,
});
const today = '2026-10-15';

test('date dropdowns honor leap years, lunar month lengths, leap months and future dates', () => {
  assert.equal(selectableDays(2000, 2, 'solar', false, today).length, 29);
  assert.equal(selectableDays(2001, 2, 'solar', false, today).length, 28);
  assert.equal(selectableDays(2025, 6, 'lunar', true, today).length, 29);
  assert.deepEqual(selectableMonths(2025, 'lunar', true, today), [6]);
  assert.deepEqual(selectableMonths(2024, 'lunar', true, today), []);
  assert.equal(selectableDays(2026, 10, 'solar', false, today).at(-1), 15);
  assert.deepEqual(selectableDays(2026, 10, 'lunar', false, today), []);
  assert.deepEqual(selectableDays(0, 1, 'solar', false, today), []);
});

test('known lunar new year dates and leap month examples', () => {
  // KASI 2024 calendar data; upstream README examples for 2017 and 1956.
  const cases = [
    ['2024-02-10', '2024-01-01', false],
    ['2017-06-24', '2017-05-01', true],
    ['1956-03-03', '1956-01-21', false],
    ['2025-07-25', '2025-06-01', true],
  ];
  for (const [solar, lunar, leap] of cases) {
    const result = convertBirthDate(profile(solar));
    assert.equal(formatCalendarDate(result.lunar), lunar);
    assert.equal(result.lunar.intercalation, leap);
    assert.equal(formatCalendarDate(convertBirthDate(profile(lunar, 'lunar', leap)).solar), solar);
  }
});

test('reject nonexistent lunar dates and leap months without reusing stale results', () => {
  assert.equal(validateProfile(profile('2024-01-01', 'lunar'), today), '');
  assert.ok(validateProfile(profile('2024-01-01', 'lunar', true), today));
  assert.ok(validateProfile(profile('2017-03-01', 'lunar', true), today));
  assert.ok(validateProfile(profile('2025-06-30', 'lunar', true), today));
  assert.throws(() => convertBirthDate(profile('2024-01-01', 'lunar', true)), RangeError);
});

test('converted solar date determines future and range validation', () => {
  assert.equal(validateProfile(profile('1900-01-01'), today), '');
  assert.ok(validateProfile(profile('1899-12-31'), today));
  assert.ok(validateProfile(profile('2026-10-16'), today));
  // Lunar date looks earlier than today's solar date but converts to a future date.
  assert.ok(validateProfile(profile('2026-10-01', 'lunar'), today));
  assert.ok(validateProfile(profile('2051-01-01'), '2051-12-31'));
  assert.ok(validateProfile(profile('2001-02-29'), today));
  assert.equal(validateProfile(profile('2000-02-29'), today), '');
});

test('all days of 2025 round-trip through Korean lunar calendar', () => {
  for (let date = new Date('2025-01-01T00:00:00Z'); date.getUTCFullYear() === 2025; date.setUTCDate(date.getUTCDate() + 1)) {
    const solar = date.toISOString().slice(0, 10);
    const lunar = convertBirthDate(profile(solar)).lunar;
    const back = convertBirthDate(profile(formatCalendarDate(lunar), 'lunar', lunar.intercalation));
    assert.equal(formatCalendarDate(back.solar), solar);
  }
});

test('unknown time, old stored profiles and Korean midnight remain supported', () => {
  const stored = normalizeProfile({ ...profile('2024-01-01'), birthTime: '12:00' });
  assert.equal(stored.birthTime, null);
  assert.equal(stored.displayName, '');
  assert.equal(validateProfile(JSON.parse(JSON.stringify(stored)), today), '');
  assert.equal(koreaDate(new Date('2026-10-14T14:59:59Z')), '2026-10-14');
  assert.equal(koreaDate(new Date('2026-10-14T15:00:00Z')), '2026-10-15');
});
