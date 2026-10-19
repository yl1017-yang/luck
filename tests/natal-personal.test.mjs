import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaju } from '../js/saju-calculator.js';
import { calculateNatalFeatures } from '../js/natal-features.js';
import { interpretNatalDetails } from '../js/natal-interpreter.js';
import { interpretNatalPersonal } from '../js/natal-personal.js';
import { NATAL_CATALOG } from '../js/content/natal-details.js';
import { NATAL_DAY_VOICES } from '../js/content/natal-personal.js';

const base = { birthDate: '1990-05-15', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const features = (overrides = {}) => calculateNatalFeatures(calculateSaju({ ...base, ...overrides }, '2026-10-19'));

test('all 60 day pillars have distinct direct personal copy and visible subject readings', () => {
  const observed = new Set();
  assert.equal(Object.keys(NATAL_DAY_VOICES).length, 60);
  for (let i = 0; i < 60; i += 1) {
    const birthDate = new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10);
    const facts = features({ birthDate });
    const n = interpretNatalPersonal(interpretNatalDetails(facts));
    observed.add(facts.dayPillar.hanja);
    assert.ok(n.sections.overview.paragraphs[0].startsWith('당신은'));
    assert.equal(n.sections.dayPillar.paragraphs[0], NATAL_DAY_VOICES[facts.dayPillar.hanja]);
    assert.ok(n.sections.workResources.paragraphs[0].includes('맞는 일은'));
    assert.ok(n.sections.relationships.paragraphs.length >= 3);
    const copy = Object.entries(n.sections).filter(([key]) => key !== 'season').flatMap(([,s]) => s.paragraphs);
    assert.equal(new Set(copy).size, copy.length);
    assert.doesNotMatch(copy.join(' '), /undefined|살펴보|돌아볼 질문|실천 제안|관점이에요|이미지는/);
  }
  assert.equal(observed.size, 60);
  assert.equal(new Set(Object.values(NATAL_DAY_VOICES)).size, 60);
});

test('missing content remains missing and partial context never invents an unavailable month', () => {
  const facts = features();
  const catalog = structuredClone(NATAL_CATALOG);
  delete catalog.dayPillars[facts.dayPillar.hanja];
  delete catalog.contexts[facts.context.tenGod].workResources;
  const n = interpretNatalPersonal(interpretNatalDetails(facts, catalog));
  assert.equal(n.sections.dayPillar, undefined);
  assert.equal(n.sections.workResources.sourceStatus, 'partial-content');
  const partial = interpretNatalPersonal(interpretNatalDetails(features({ birthDate: '2024-02-04', birthTime: null, unknownTime: true })));
  assert.equal(partial.sections.season, undefined);
  assert.equal(partial.sections.overview.paragraphs.length, 3);
  assert.equal(interpretNatalPersonal(null), null);
});
