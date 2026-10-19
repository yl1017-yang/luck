import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { HIDDEN_STEMS, MONTH_SEASONS } from '../js/content/natal-tables.js';
import { NATAL_CATALOG } from '../js/content/natal-details.js';
import { calculateSaju, tenGodForStems } from '../js/saju-calculator.js';
import { calculateFortunePeriods } from '../js/fortune-periods.js';
import { calculateNatalFeatures } from '../js/natal-features.js';
import { interpretNatalDetails } from '../js/natal-interpreter.js';
import { classicalHiddenOrder, hkoCycle, classicalExamples, referenceTenGodRows, seasonStarts, referenceSources } from './fixtures/natal-independent.mjs';

const profile = { birthDate: '1900-01-01', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const natal = (overrides = {}, today = '2026-10-19') => calculateSaju({ ...profile, ...overrides }, today);
const section = (value, key) => value.sections.find((item) => item.key === key);

test('independent classical hidden-stem membership agrees while five poem-order differences are recorded', () => {
  const rows = Object.entries(classicalHiddenOrder).map(([branch, stems]) => {
    assert.deepEqual([...HIDDEN_STEMS[branch]].sort(), [...stems].sort(), branch);
    return { branch, reference: stems, adopted: [...HIDDEN_STEMS[branch]], sameMembers: true,
      sameOrder: JSON.stringify(stems) === JSON.stringify(HIDDEN_STEMS[branch]) };
  });
  assert.deepEqual(rows.filter((row) => !row.sameOrder).map((row) => row.branch), ['丑', '辰', '巳', '未', '戌']);
  const report = { checkedOn: '2026-10-19', branchCount: 12, stemMembershipCount: 28,
    memberMismatches: 0, orderDifferences: 5, sources: referenceSources, rows };
  if (process.env.LUCK_WRITE_NATAL_AUDIT === '1') writeFileSync(new URL('../doc/NATAL_REFERENCE_RESULTS.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
});

test('14 independently transcribed ten-god examples and the separately tabulated 100 relationships agree', () => {
  for (const [day, other, expected] of classicalExamples) assert.equal(tenGodForStems(day, other), expected);
  const columns = [...'甲乙丙丁戊己庚辛壬癸'];
  for (const [day, row] of Object.entries(referenceTenGodRows)) {
    row.forEach((expected, i) => assert.equal(tenGodForStems(day, columns[i]), expected, day + columns[i]));
  }
});

test('60 HKO cycle members select exact day-pillar content and all four traditional seasons span three branches', () => {
  assert.equal(new Set(hkoCycle).size, 60);
  assert.deepEqual([...Object.keys(NATAL_CATALOG.dayPillars)].sort(), [...hkoCycle].sort());
  for (const season of seasonStarts) {
    assert.equal(MONTH_SEASONS[season.branches[0]].termName, season.term);
    for (const branch of season.branches) assert.equal(MONTH_SEASONS[branch].key, season.key);
  }
});

test('each 2024 monthly term minute around the uncertainty margin preserves natal exclusions and basis', () => {
  const periods = calculateFortunePeriods(natal(), 2024);
  for (const month of periods.months) {
    const boundary = Date.parse(month.segments[1].start);
    for (const offset of [-120000, -60000, 0, 60000, 120000]) {
      const wall = new Date(boundary + offset + 9 * 3600000).toISOString();
      const inputMinute = Date.parse(wall.slice(0, 16) + ':00+09:00');
      const result = natal({ birthDate: wall.slice(0, 10), birthTime: wall.slice(11, 16) });
      const features = calculateNatalFeatures(result);
      const reading = interpretNatalDetails(features);
      const near = Math.abs(inputMinute - boundary) <= 60000;
      assert.equal(features.pillars.month === null, near);
      assert.equal(features.season === null, near);
      assert.equal(features.context.source, near ? 'day-branch-main' : 'month-stem');
      assert.equal(reading.contentStatus, 'complete');
      assert.deepEqual(section(reading, 'overview').basis.context, features.context);
      if (near) {
        assert.ok(reading.sections.filter((s) => s.key.startsWith('tenGod.')).every((s) => s.basis.positions.every((p) => p.pillarKey !== 'month')));
      }
    }
  }
});

test('midnight changes the known day pillar while 23:00 changes only the hour under the adopted policy', () => {
  const before = calculateNatalFeatures(natal({ birthDate: '2024-02-10', birthTime: '22:59' }));
  const zi = calculateNatalFeatures(natal({ birthDate: '2024-02-10', birthTime: '23:00' }));
  const last = calculateNatalFeatures(natal({ birthDate: '2024-02-10', birthTime: '23:59' }));
  const next = calculateNatalFeatures(natal({ birthDate: '2024-02-11', birthTime: '00:00' }));
  assert.equal(before.dayPillar.hanja, '甲辰');
  assert.equal(zi.dayPillar.hanja, '甲辰');
  assert.equal(last.dayPillar.hanja, '甲辰');
  assert.equal(next.dayPillar.hanja, '乙巳');
  assert.notEqual(before.pillars.hour.pillar.hanja, zi.pillars.hour.pillar.hanja);
  assert.equal(zi.pillars.hour.pillar.hanja, '甲子');
  assert.equal(next.pillars.hour.pillar.hanja, '丙子');
  assert.equal(section(interpretNatalDetails(next), 'dayPillar').blocks[0].id, 'natal.dayPillar.乙巳');
});

test('unsupported birth dates fail before content selection and 1900/2050 endpoints retain exact natal facts', () => {
  for (const birthDate of ['1899-12-31', '2051-01-01', '2024-02-30', '2026-10-20']) assert.throws(() => natal({ birthDate }), RangeError);
  for (const [birthDate, today] of [['1900-01-01', '2026-10-19'], ['2050-12-31', '2050-12-31']]) {
    assert.equal(interpretNatalDetails(calculateNatalFeatures(natal({ birthDate }, today))).contentStatus, 'complete');
  }
});
