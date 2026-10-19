import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaju } from '../js/saju-calculator.js';
import { interpretPersonality } from '../js/personality-interpreter.js';

const base = { birthDate: '1990-05-15', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const read = (overrides = {}) => interpretPersonality(calculateSaju({ ...base, ...overrides }, '2026-10-19'));

test('60 day pillars have substantive personal descriptions with distinct day-pillar context', () => {
  const observed = new Set();
  for (let i = 0; i < 60; i += 1) {
    const birthDate = new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10);
    const n = read({ birthDate });
    observed.add(n.selection.dayPillar);
    assert.equal(n.status, 'available');
    assert.equal(n.overview.length, 4);
    assert.ok(n.overview[0].startsWith('당신은'));
    assert.equal(n.details.length, 6);
    for (const section of n.details) assert.ok(section.paragraphs.length >= 3);
    const body = [...n.overview, ...n.details.flatMap(d => d.paragraphs)];
    assert.equal(new Set(body).size, body.length);
    assert.ok(body.join('').length > 2400);
    assert.doesNotMatch(body.join(' '), /살펴보|자기 성찰용|관점이에요|돌아볼 질문|undefined/);
  }
  assert.equal(observed.size, 60);
});

test('same master with different pillars changes personal content while name and lunar notation do not', () => {
  const first = read();
  const other = read({ birthDate: '1990-05-25' });
  assert.equal(first.selection.dayMaster, other.selection.dayMaster);
  assert.notDeepEqual(first.details[0], other.details[0]);
  assert.notDeepEqual(first.overview, other.overview);
  assert.deepEqual(first, read({ displayName: '다른 이름' }));
  assert.deepEqual(read({ birthDate: '2025-07-25' }), read({ birthDate: '2025-06-01', calendar: 'lunar', leapMonth: true }));
});

test('missing month uses confirmed day context and invalid facts never yield a substitute personality', () => {
  assert.equal(interpretPersonality(null), null);
  const partial = read({ birthDate: '2024-02-04', birthTime: null, unknownTime: true });
  assert.equal(partial.partial, true);
  assert.equal(partial.overview.length, 3);
  assert.equal(partial.selection.contextSource, 'day-branch-main');
  assert.ok(partial.basis.some(line => line.includes('월주 미확정')));
  assert.ok(!partial.basis.some(line => line.startsWith('시주')));
  const result = calculateSaju(base, '2026-10-19');
  result.features.dayMaster = null;
  assert.equal(interpretPersonality(result).status, 'unavailable');
  result.features.elements.wood += 1;
  assert.throws(() => interpretPersonality(result), RangeError);
});
