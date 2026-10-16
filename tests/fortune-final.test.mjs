import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { calculateSaju } from '../js/saju-calculator.js';
import { calculateFortunePeriods } from '../js/fortune-periods.js';
import { interpretDetailedFortune } from '../js/fortune-interpreter.js';
import { termsByYear } from './fixtures/kasi-terms.mjs';
import { monthlyTerms2025 } from './fixtures/kasi-monthly-2025.mjs';

const profile = { birthDate: '1900-01-01', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const result = calculateSaju(profile, '2026-10-16');
const now = new Date('2026-10-16T00:00:00+09:00');
const all = (periods) => periods.months.flatMap((month) => month.segments);

test('36 independent monthly term minutes have a recorded signed error within 60 seconds', () => {
  const rows = [];
  for (const year of [2024, 2025, 2026]) {
    const periods = calculateFortunePeriods(result, year, now);
    for (let month = 1; month <= 12; month += 1) {
      const reference = year === 2025 ? monthlyTerms2025[month - 1][1] : termsByYear[year][(month - 1) * 2];
      const referenceKst = `${year}-${reference.replace(' ', 'T')}:00+09:00`;
      const actual = periods.months[month - 1].segments[1].sourceStart;
      const differenceSeconds = (Date.parse(actual) - Date.parse(referenceKst)) / 1000;
      assert.ok(Math.abs(differenceSeconds) <= 60, `${year}/${month}: ${differenceSeconds}`);
      rows.push({ year, term: monthlyTerms2025[month - 1][0], referenceKst, actualUtc: actual, differenceSeconds });
    }
  }
  const report = { checkedOn: '2026-10-16', count: rows.length, precision: 'minute', toleranceSeconds: 60,
    maxAbsoluteSeconds: Math.max(...rows.map((row) => Math.abs(row.differenceSeconds))),
    sources: [2024, 2025, 2026].map((year) => `https://astro.kasi.re.kr/kor/life/post/calendarData?search_year=${year}`), rows };
  if (process.env.LUCK_WRITE_AUDIT === '1') writeFileSync(new URL('../doc/MONTHLY_TERMS_RESULTS.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(`Independent monthly terms: ${report.count}; max absolute difference ${report.maxAbsoluteSeconds}s`);
});

test('all 12 boundaries at lower/upper horizon and three reference years retain inclusivity and uncertainty', () => {
  for (const year of [1901, 2024, 2025, 2026, 2050]) {
    const periods = calculateFortunePeriods(result, year, now);
    for (const month of periods.months) {
      const [before, after] = month.segments;
      const time = Date.parse(after.start);
      for (const offset of [-60001, -60000, -1, 0, 1, 60000, 60001]) {
        const instant = time + offset;
        const value = calculateFortunePeriods(result, year, new Date(instant));
        const applicable = all(value).find((segment) => Date.parse(segment.start) <= instant && instant < Date.parse(segment.end));
        assert.equal(applicable.id, offset < 0 ? before.id : after.id);
        const near = Math.abs(offset) <= 60000;
        assert.equal(value.current.nearBoundary, near);
        assert.equal(value.current.activeSegmentId, near ? null : applicable.id);
        assert.deepEqual(value.current.candidateSegmentIds, near ? [before.id, after.id] : []);
      }
    }
  }
});

test('all supported years interpret every monthly segment with the actual annual/monthly basis', () => {
  for (let year = 1901; year <= 2050; year += 1) {
    const periods = calculateFortunePeriods(result, year, now);
    const reading = interpretDetailedFortune(result, periods);
    assert.equal(reading.contentStatus, 'complete');
    assert.equal(reading.monthlyReadings.length, 12);
    for (const month of reading.monthlyReadings) {
      for (const segment of month.segments) {
        const annual = periods.annualPeriods.find((item) => item.id === segment.annualPeriodId);
        assert.equal(segment.basis.annualPillar, annual.pillar.hanja);
        assert.equal(segment.basis.monthlyPillar, segment.pillar.hanja);
        assert.equal(segment.basis.start, segment.start);
        assert.equal(segment.basis.end, segment.end);
        assert.equal(segment.bridge.requires.annualTenGod, annual.tenGod);
        assert.equal(segment.bridge.requires.monthlyTenGod, segment.tenGod);
      }
    }
  }
});
