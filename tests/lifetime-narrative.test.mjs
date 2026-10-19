import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaju } from '../js/saju-calculator.js';
import { calculateNatalFeatures } from '../js/natal-features.js';
import { interpretLifeNarrative } from '../js/lifetime-narrative.js';
import { LIFE_PROFILE_DEPTH } from '../js/content/lifetime-depth.js';
import { LIFE_STAGE_DEPTH } from '../js/content/lifetime-stage-depth.js';
import { LIFETIME_PATHS, LIFETIME_DEVELOPMENT } from '../js/content/lifetime-paths.js';
import { interpretPersonality } from '../js/personality-interpreter.js';
import {
  LIFE_MASTER_VOICES, LIFE_RELATION_VOICES, LIFE_MIDDLE_VOICES,
  LIFE_BALANCE_VOICES, LIFE_CROSS_VOICES, LIFE_RELATION_GROUPS,
} from '../js/content/lifetime-narratives.js';

const base = { birthDate: '1990-05-15', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const saju = (changes = {}) => calculateSaju({ ...base, ...changes }, '2026-10-19');
const body = (n) => [...n.overview, ...[...n.stages, ...n.areas].flatMap(item => item.paragraphs)];

test('personal copy covers all masters, ten-god contexts and 25 ordered contrasts without glossary prose', () => {
  const masters = [...'甲乙丙丁戊己庚辛壬癸'];
  assert.deepEqual(Object.keys(LIFE_MASTER_VOICES), masters);
  const fields = ['core', 'temperament', 'work', 'money', 'relationship', 'rhythm'];
  for (const field of fields) {
    assert.equal(new Set(masters.map(key => LIFE_MASTER_VOICES[key][field])).size, 10);
    for (const key of masters) assert.ok(LIFE_MASTER_VOICES[key][field].length > 65);
  }
  const gods = Object.keys(LIFE_RELATION_GROUPS);
  for (const god of gods) {
    for (const field of ['outward', 'private', 'work', 'money', 'early', 'later', 'action']) {
      assert.ok(LIFE_RELATION_VOICES[god][field]);
    }
    assert.ok(LIFE_MIDDLE_VOICES[god] && LIFE_BALANCE_VOICES[god]);
  }
  const groups = [...new Set(Object.values(LIFE_RELATION_GROUPS))];
  const contrasts = groups.flatMap(a => groups.map(b => LIFE_CROSS_VOICES[a][b]));
  assert.equal(contrasts.length, 25);
  assert.equal(new Set(contrasts).size, 25);
  const prose = JSON.stringify([LIFE_MASTER_VOICES, LIFE_RELATION_VOICES, LIFE_MIDDLE_VOICES, LIFE_BALANCE_VOICES, LIFE_CROSS_VOICES]);
  assert.doesNotMatch(prose, /같은 오행|다른 음양|본기|지장간|갑목|계수/);
});

test('60 consecutive day pillars produce complete, nonduplicated personal bodies with separate job and money sections', () => {
  const pillars = new Set();
  const outputs = new Set();
  for (let i = 0; i < 60; i += 1) {
    const birthDate = new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10);
    const result = saju({ birthDate });
    pillars.add(result.pillars.day.hanja);
    const n = interpretLifeNarrative(result);
    assert.equal(n.version, '4.0.0');
    assert.equal(n.areas.length, 4);
    assert.equal(n.stages.length, 3);
    assert.ok(n.areas.some(a => a.title.startsWith('직업운')));
    assert.ok(n.areas.some(a => a.title.startsWith('재물운')));
    assert.equal(new Set(body(n)).size, body(n).length);
    assert.doesNotMatch(body(n).join(' '), /undefined|천간|본기|지장간|같은 오행/);
    assert.doesNotMatch(body(n).join(' '), /살펴보|시작할 수 있어요|돌아볼 수|관점이에요|풀이해 볼|읽혀요/);
    assert.ok(n.overview[0].startsWith('당신의 평생운은'));
    assert.ok(n.areas[0].paragraphs.some(p => p.includes('후반')));
    assert.ok(!n.areas.some(a => a.title.startsWith('성격')));
    assert.ok(n.title && n.tags.length === 3);
    assert.equal(n.overview.length, 4);
    for (const stage of n.stages) {
      assert.ok(stage.paragraphs.length >= 4);
      assert.ok(stage.paragraphs.join('').length >= 350);
    }
    for (const area of n.areas) assert.ok(area.paragraphs.length >= 3);
    assert.ok(n.contentIds.length >= 15);
    outputs.add(JSON.stringify(body(n)));
  }
  assert.equal(pillars.size, 60);
  // Repetition of the same calculation features is allowed, not artificial uniqueness.
  assert.ok(outputs.size > 10);
});

test('hour changes affect the later-life lens and stage connection, not the career or wealth basis', () => {
  const first = interpretLifeNarrative(saju({ birthTime: '00:00' }));
  const second = interpretLifeNarrative(saju({ birthTime: '12:00' }));
  assert.notDeepEqual(first.stages[2].paragraphs, second.stages[2].paragraphs);
  assert.deepEqual(first.overview.slice(0, 3), second.overview.slice(0, 3));
  assert.notEqual(first.overview[3], second.overview[3]);
  assert.deepEqual(first.areas, second.areas);
  assert.deepEqual(first.stages.slice(0, 2), second.stages.slice(0, 2));
});

test('personality and lifetime never reuse whole paragraphs or the same hero title', () => {
  for (let i = 0; i < 60; i += 1) {
    const birthDate = new Date(Date.UTC(1978, 10, 1 + i)).toISOString().slice(0, 10);
    const result = saju({ birthDate, birthTime: '08:00' });
    const life = interpretLifeNarrative(result);
    const personality = interpretPersonality(result);
    const personalityCopy = new Set([...personality.overview, ...personality.details.flatMap(d => d.paragraphs)]);
    assert.notEqual(life.title, personality.title);
    for (const copy of body(life)) assert.ok(!personalityCopy.has(copy), `Shared paragraph: ${copy}`);
    assert.ok(life.contentIds.every(id => !/^life\.(master|depth\.master|cross)\./.test(id)));
  }
});

test('lifelong development manuscripts cover every chart context without repeated padding', () => {
  assert.equal(Object.keys(LIFETIME_PATHS).length, 10);
  assert.equal(Object.keys(LIFETIME_DEVELOPMENT).length, 10);
  const paragraphs = Object.values(LIFETIME_PATHS).map(p => p.intro);
  for (const entry of Object.values(LIFETIME_DEVELOPMENT)) {
    assert.equal(entry.overview.length, 2);
    for (const field of ['work', 'wealth', 'family', 'stability']) assert.equal(entry[field].length, 3);
    paragraphs.push(...Object.values(entry).flat());
  }
  assert.equal(paragraphs.length, 150);
  assert.equal(new Set(paragraphs).size, 150);
});

test('same day pillar in a different month changes work lens while keeping close-relationship lens', () => {
  const firstResult = saju();
  const secondResult = saju({ birthDate: '1990-07-14' });
  assert.equal(firstResult.pillars.day.hanja, secondResult.pillars.day.hanja);
  const first = interpretLifeNarrative(firstResult);
  const second = interpretLifeNarrative(secondResult);
  assert.notDeepEqual(first.areas[1].paragraphs, second.areas[1].paragraphs);
  assert.deepEqual(first.areas[3], second.areas[3]);
  assert.deepEqual(first.stages[1], second.stages[1]);
});

test('uncertain month suppresses work/private contrast and unknown hour never supplies later-life prose', () => {
  const result = saju({ birthDate: '2024-02-04', birthTime: null, unknownTime: true });
  assert.equal(calculateNatalFeatures(result).pillars.month, null);
  const n = interpretLifeNarrative(result);
  assert.equal(n.overview.length, 3);
  assert.ok(!n.contentIds.some(id => id.startsWith('life.cross.')));
  assert.equal(n.stages[2].unavailable, true);
  assert.equal(n.stages[0].unavailable, true);
  assert.ok(n.areas[1].basis.includes('월주 미확정'));
  assert.deepEqual(n, interpretLifeNarrative({ ...result, profile: { ...result.profile, displayName: '다른 이름' } }));
});

test('expanded manuscripts cover every master and stage context without repeated padding', () => {
  const paragraphs = [];
  for (const master of Object.keys(LIFE_MASTER_VOICES)) {
    for (const field of ['overview', 'temperament', 'work', 'money', 'relationship', 'rhythm']) {
      const copies = LIFE_PROFILE_DEPTH[master][field];
      assert.ok(Array.isArray(copies) && copies.length > 0);
      paragraphs.push(...copies);
    }
  }
  for (const god of Object.keys(LIFE_RELATION_GROUPS)) {
    for (const stage of ['early', 'middle', 'later']) {
      assert.equal(LIFE_STAGE_DEPTH[god][stage].length, 3);
      paragraphs.push(...LIFE_STAGE_DEPTH[god][stage]);
    }
  }
  assert.equal(paragraphs.length, 190);
  assert.equal(new Set(paragraphs).size, paragraphs.length);
  assert.doesNotMatch(paragraphs.join(' '), /살펴보|시작할 수 있어요|돌아볼 수|관점이에요|읽혀요/);
});
