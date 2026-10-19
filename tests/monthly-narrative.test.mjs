import test from 'node:test';
import assert from 'node:assert/strict';
import { tenGodForStems } from '../js/saju-calculator.js';
import { interpretMonthlyNarrative } from '../js/monthly-narrative.js';
import { MONTH_NARRATIVES, MONTH_PERSONALITY, MONTH_ANNUAL_CONTEXT } from '../js/content/monthly-narratives.js';

const stems = [...'甲乙丙丁戊己庚辛壬癸'];
const pillar = stem => stem + (stems.indexOf(stem) % 2 ? '丑' : '子');
const basis = (dayMaster, annual, monthly) => ({ dayMaster,
  annualPillar: pillar(annual), monthlyPillar: pillar(monthly),
  annualTenGod: tenGodForStems(dayMaster, annual), monthlyTenGod: tenGodForStems(dayMaster, monthly),
  cycleYear: 2026, start: '2026-01-01T00:00:00+09:00', end: '2026-01-05T00:00:00+09:00' });

test('monthly prose has complete personal, monthly and annual copy without checklist instructions', () => {
  assert.equal(Object.keys(MONTH_PERSONALITY).length, 10);
  assert.equal(Object.keys(MONTH_ANNUAL_CONTEXT).length, 10);
  assert.equal(Object.keys(MONTH_NARRATIVES).length, 10);
  const paragraphs = [];
  for (const entry of Object.values(MONTH_NARRATIVES)) {
    assert.ok(entry.title);
    assert.equal(entry.paragraphs.length, 5);
    assert.ok(entry.paragraphs[0].startsWith('이 시기의 당신은'));
    paragraphs.push(...entry.paragraphs);
  }
  paragraphs.push(...Object.values(MONTH_PERSONALITY), ...Object.values(MONTH_ANNUAL_CONTEXT));
  assert.equal(paragraphs.length, 70);
  assert.equal(new Set(paragraphs).size, 70);
  for (const copy of paragraphs) {
    assert.ok(copy.length > 85);
    assert.doesNotMatch(copy, /살펴보|적어보|확인해 보세요|실천 제안|재물운|직장·사업운|지장간|같은 오행/);
  }
});

test('1000 valid stem combinations produce traceable continuous prose and retain exact period evidence', () => {
  for (const master of stems) for (const annual of stems) for (const monthly of stems) {
    const facts = basis(master, annual, monthly);
    const n = interpretMonthlyNarrative(facts);
    assert.equal(n.version, '1.0.0');
    assert.equal(n.paragraphs.length, 7);
    assert.equal(new Set(n.paragraphs).size, 7);
    assert.equal(n.paragraphs[1], MONTH_PERSONALITY[master]);
    assert.deepEqual(n.basis, facts);
    assert.ok(n.contentIds.includes(`month.personal.${master}`));
    assert.ok(n.contentIds.includes(`month.narrative.${facts.monthlyTenGod}.0`));
    assert.ok(n.contentIds.includes(`month.annual.${facts.annualTenGod}`));
  }
});

test('the user example reads as personal prose and mismatched calculation facts are rejected', () => {
  const facts = basis('癸', '壬', '壬');
  const n = interpretMonthlyNarrative(facts);
  assert.equal(facts.monthlyTenGod, '겁재');
  assert.ok(n.paragraphs[0].includes('사람과 함께할 때 힘이 나지만'));
  assert.ok(n.paragraphs[1].includes('당신의 분석력이'));
  assert.doesNotMatch(n.paragraphs.join(' '), /살펴보|함께 확인|적어보|겁재|천간/);
  assert.throws(() => interpretMonthlyNarrative({ ...facts, monthlyTenGod: '정인' }), RangeError);
  assert.throws(() => interpretMonthlyNarrative(null), RangeError);
});
