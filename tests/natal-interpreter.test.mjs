import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaju, describePillar, tenGodForStems } from '../js/saju-calculator.js';
import { calculateNatalFeatures, NATAL_AREAS } from '../js/natal-features.js';
import { interpretNatalDetails } from '../js/natal-interpreter.js';
import { NATAL_CATALOG, NATAL_CONTENT_VERSION, NATAL_TEN_GOD_ORDER } from '../js/content/natal-details.js';
import { DAY_MASTERS } from '../js/content/interpretations.js';
import { MONTH_SEASONS } from '../js/content/natal-tables.js';

const profile = { birthDate: '1990-05-15', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const natal = (overrides = {}, today = '2026-10-19') => calculateSaju({ ...profile, ...overrides }, today);
const features = calculateNatalFeatures(natal());
const read = (f = features, c = NATAL_CATALOG) => interpretNatalDetails(f, c);
const catalog = () => structuredClone(NATAL_CATALOG);
const section = (value, key) => value.sections.find((item) => item.key === key);
const blocks = (value) => value.sections.flatMap((item) => item.blocks);
const text = (value) => assert.ok(typeof value === 'string' && value.trim().length > 0);
const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];

function fixture(day, month = '甲子') {
  const input = natal();
  input.pillars.day = describePillar(day);
  input.pillars.month = month ? describePillar(month) : null;
  input.features.dayMaster = input.pillars.day.stem;
  input.features.elements = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const pillar of Object.values(input.pillars)) {
    if (!pillar) continue;
    input.features.elements[pillar.stem.element] += 1;
    input.features.elements[pillar.branch.element] += 1;
  }
  input.features.elementCount = Object.values(input.features.elements).reduce((a, b) => a + b, 0);
  input.features.partial = !month;
  return calculateNatalFeatures(input);
}

test('196 versioned entries cover 10 masters, 60 pillars, 10 gods, 4 seasons, 12 months and 100 area blocks', () => {
  const groups = NATAL_CATALOG;
  assert.equal(Object.keys(groups.dayMasters).length, 10);
  assert.equal(Object.keys(groups.dayPillars).length, 60);
  assert.equal(Object.keys(groups.tenGods).length, 10);
  assert.equal(Object.keys(groups.seasons).length, 4);
  assert.equal(Object.keys(groups.monthBranches).length, 12);
  const entries = [...Object.values(groups.dayMasters), ...Object.values(groups.dayPillars),
    ...Object.values(groups.tenGods), ...Object.values(groups.seasons), ...Object.values(groups.monthBranches),
    ...Object.values(groups.areas).flatMap(Object.values), ...Object.values(groups.contexts).flatMap(Object.values)];
  assert.equal(entries.length, 196);
  assert.equal(new Set(entries.map((e) => e.id)).size, 196);
  for (const entry of entries) {
    for (const key of ['id', 'title', 'summary', 'question']) text(entry[key]);
    assert.equal(entry.version, NATAL_CONTENT_VERSION);
    assert.ok(Object.keys(entry.requires).length > 0);
    assert.ok(entry.paragraphs.length >= (entry.role === 'base' ? 2 : 1));
    entry.paragraphs.forEach(text);
    if (entry.role === 'base') text(entry.action);
    else assert.equal(entry.action, null);
  }
  for (const D of STEMS) assert.deepEqual(Object.keys(groups.areas[D]), NATAL_AREAS);
  for (const C of NATAL_TEN_GOD_ORDER) assert.deepEqual(Object.keys(groups.contexts[C]), NATAL_AREAS);
  assert.equal(new Set(Object.values(groups.dayPillars).flatMap((e) => e.paragraphs)).size, 120);
  assert.equal(new Set(Object.values(groups.areas).flatMap(Object.values).flatMap((e) => e.paragraphs)).size, 100);
  for (const D of STEMS) {
    assert.equal(groups.dayMasters[D].summary, DAY_MASTERS[D].intro);
    assert.deepEqual(groups.dayMasters[D].paragraphs, [DAY_MASTERS[D].behavior, DAY_MASTERS[D].strength]);
    assert.ok(groups.dayMasters[D].sourceRefs.every((ref) => ref.startsWith(`interpretations.DAY_MASTERS.${D}.`)));
  }
  for (const [i, branch] of BRANCHES.entries()) {
    const value = read(fixture('甲子', (i % 2 ? '乙' : '甲') + branch));
    assert.equal(value.contentStatus, 'complete');
    assert.ok(section(value, 'season').contentIds.includes(`natal.monthBranch.${branch}`));
    assert.equal(section(value, 'season').basis.season.key, MONTH_SEASONS[branch].key);
  }
});

test('all 60 real day pillars select exact independent copy with matching actual main hidden stem', () => {
  const seen = new Set();
  for (let i = 0; i < 60; i += 1) {
    const birthDate = new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10);
    const f = calculateNatalFeatures(natal({ birthDate }));
    const value = read(f);
    assert.equal(value.contentStatus, 'complete');
    const entry = section(value, 'dayPillar');
    seen.add(entry.blocks[0].id);
    assert.equal(entry.blocks[0].id, `natal.dayPillar.${f.dayPillar.hanja}`);
    assert.deepEqual(entry.basis.dayBranchMain, f.pillars.day.hiddenStems[0]);
    assert.equal(entry.basis.dayMaster, f.dayMaster.hanja);
    assert.equal(value.contentIds.length, new Set(value.contentIds).size);
  }
  assert.equal(seen.size, 60);
  assert.notEqual(section(read(fixture('甲子')), 'dayPillar').summary, section(read(fixture('甲午')), 'dayPillar').summary);
});

test('all 400 D/C/season combinations preserve one base action per area and exact context/season IDs', () => {
  const covered = new Set();
  for (const D of STEMS) {
    for (const other of STEMS) {
      for (const S of ['spring', 'summer', 'autumn', 'winter']) {
        const branch = BRANCHES.find((b, i) => MONTH_SEASONS[b].key === S && i % 2 === STEMS.indexOf(other) % 2);
        const f = fixture(D + (STEMS.indexOf(D) % 2 ? '丑' : '子'), other + branch);
        const value = read(f);
        const C = tenGodForStems(D, other);
        covered.add(`${D}/${C}/${S}`);
        assert.equal(value.contentStatus, 'complete');
        for (const area of NATAL_AREAS) {
          const part = section(value, area);
          assert.deepEqual(part.contentIds, [`natal.area.${area}.${D}`, `natal.context.${area}.${C}`]);
          assert.equal(part.blocks.filter((b) => b.action !== null).length, 1);
          assert.equal(part.blocks[0].action, NATAL_CATALOG.areas[D][area].action);
          assert.deepEqual(part.basis.context, f.context);
        }
        assert.equal(blocks(value).filter((b) => b.id === `natal.season.${S}`).length, 1);
        assert.ok(section(value, 'season').contentIds.includes(`natal.monthBranch.${branch}`));
      }
    }
  }
  assert.equal(covered.size, 400);
});

test('ten-god themes occur once in fixed order and every confirmed stem/hidden occurrence is traceable', () => {
  const f = fixture('甲子', '甲子');
  const value = read(f);
  const themes = value.sections.filter((s) => s.key.startsWith('tenGod.'));
  assert.deepEqual(themes.map((s) => s.basis.tenGod), NATAL_TEN_GOD_ORDER.filter((g) => themes.some((s) => s.basis.tenGod === g)));
  const positions = themes.flatMap((s) => s.basis.positions);
  const expectedCount = Object.values(f.pillars).reduce((sum, p) => sum + p.hiddenStems.length, 0) + 3;
  assert.equal(positions.length, expectedCount);
  assert.ok(!positions.some((p) => p.pillarKey === 'day' && p.source === 'stem'));
  assert.ok(positions.some((p) => p.pillarKey === 'month' && p.source === 'stem'));
  assert.equal(themes.length, new Set(themes.flatMap((s) => s.contentIds)).size);
});

test('same natal facts are invariant under optional name, lunar equivalence, storage and query date', () => {
  const f = calculateNatalFeatures(natal({ birthDate: '2025-07-25' }));
  const expected = read(f);
  assert.deepEqual(read(calculateNatalFeatures(natal({ birthDate: '2025-06-01', calendar: 'lunar', leapMonth: true }))), expected);
  assert.deepEqual(read(JSON.parse(JSON.stringify(f))), expected);
  assert.deepEqual(read(calculateNatalFeatures(natal({ birthDate: '2025-07-25', displayName: '이름', }, '2026-12-31'))), expected);
});

test('unknown hour and spring ambiguity exclude those sources while keeping day-based sections', () => {
  const unknown = read(calculateNatalFeatures(natal({ unknownTime: true, birthTime: null })));
  assert.equal(unknown.partial, true);
  assert.equal(unknown.contentStatus, 'complete');
  assert.equal(section(unknown, 'pillars.hour').status, 'unavailable-feature');
  assert.ok(unknown.sections.filter((s) => s.key.startsWith('tenGod.')).every((s) => s.basis.positions.every((p) => p.pillarKey !== 'hour')));
  const birth = natal({ birthDate: '2024-02-04', unknownTime: true, birthTime: null });
  const partial = read(calculateNatalFeatures(birth));
  assert.equal(section(partial, 'season').status, 'unavailable-feature');
  assert.equal(section(partial, 'overview').basis.context.source, 'day-branch-main');
  assert.ok(partial.sections.filter((s) => s.key.startsWith('tenGod.')).every((s) => s.basis.positions.every((p) => p.pillarKey === 'day')));
  assert.equal(partial.contentStatus, 'complete');
});

test('missing base content suppresses that area without borrowing other masters or leaving context-only advice', () => {
  const c = catalog();
  const D = features.dayMaster.hanja;
  delete c.areas[D].workResources;
  const value = read(features, c);
  assert.equal(value.contentStatus, 'partial');
  const part = section(value, 'workResources');
  assert.equal(part.status, 'unavailable-content');
  assert.equal(part.blocks.length, 0);
  assert.ok(section(value, 'relationships').blocks.length > 0);
  assert.ok(!value.contentIds.includes(`natal.context.workResources.${features.context.tenGod}`));
});

test('missing context or season suppresses only that supplement and never adds another action', () => {
  const c = catalog();
  delete c.contexts[features.context.tenGod].relationships;
  delete c.seasons[features.season.key];
  const value = read(features, c);
  assert.equal(section(value, 'relationships').status, 'partial-content');
  assert.equal(section(value, 'relationships').blocks.length, 1);
  assert.equal(section(value, 'relationships').blocks[0].role, 'base');
  assert.equal(section(value, 'season').status, 'partial-content');
  assert.ok(section(value, 'season').blocks.every((b) => b.role === 'fact'));
  assert.equal(section(value, 'dayPillar').status, 'available');
});

test('missing day-pillar or ten-god copy retains factual evidence without substituting another topic', () => {
  const c = catalog();
  delete c.dayPillars[features.dayPillar.hanja];
  const firstGod = read().sections.find((s) => s.key.startsWith('tenGod.')).basis.tenGod;
  delete c.tenGods[firstGod];
  const value = read(features, c);
  assert.equal(section(value, 'dayPillar').status, 'unavailable-content');
  assert.deepEqual(section(value, 'dayPillar').basis.dayBranchMain, features.pillars.day.hiddenStems[0]);
  assert.equal(section(value, `tenGod.${firstGod}`).status, 'unavailable-content');
  assert.ok(section(value, `tenGod.${firstGod}`).basis.positions.length > 0);
  assert.equal(section(value, 'dayMaster').status, 'available');
  assert.deepEqual(value.facts, features);
});

test('wrong requires, version, ID, empty paragraphs and competing support action are unavailable content', () => {
  for (const mutate of [
    (e) => { e.requires.dayMaster = 'bad'; }, (e) => { e.version = '0'; },
    (e) => { e.id = 'wrong'; }, (e) => { e.paragraphs = ['']; }, (e) => { e.action = null; },
  ]) {
    const c = catalog();
    mutate(c.areas[features.dayMaster.hanja].overview);
    assert.equal(section(read(features, c), 'overview').status, 'unavailable-content');
  }
  const c = catalog();
  c.contexts[features.context.tenGod].overview.action = '기본 행동과 다른 행동';
  assert.equal(section(read(features, c), 'overview').status, 'partial-content');
});

test('tampered calculation bases, seasons, relationships, positions and availability are rejected', () => {
  for (const mutate of [
    (f) => { f.dayMaster.hanja = '甲'; }, (f) => { f.context.tenGod = 'wrong'; },
    (f) => { f.season.key = 'winter'; }, (f) => { f.pillars.day.hiddenStems[0].tenGod = 'wrong'; },
    (f) => { f.pillars.day.hiddenStems[0].order = 100; }, (f) => { f.surfaceElements.total = 9; },
    (f) => { f.pillars.day.stemRelation = { kind: 'ten-god', tenGod: '비견' }; },
    (f) => { f.availability.overview.status = 'unavailable-feature'; },
    (f) => { f.policy.hiddenStemsTableId = 'wrong'; }, (f) => { delete f.uncertainty; },
  ]) {
    const f = structuredClone(features);
    mutate(f);
    assert.throws(() => read(f), RangeError);
  }
  assert.equal(read(null), null);
  assert.throws(() => read({}), RangeError);
});

test('explicit unavailable master produces no interpretation and outputs never mutate shared inputs', () => {
  const birth = natal();
  birth.features.dayMaster = null;
  const value = read(calculateNatalFeatures(birth));
  assert.equal(value.contentStatus, 'unavailable');
  assert.equal(value.sections.length, 0);
  const before = JSON.stringify({ features, NATAL_CATALOG });
  const first = read();
  const second = read();
  assert.deepEqual(first, second);
  first.sections[0].blocks[0].paragraphs[0] = 'changed';
  first.facts.pillars.day.hiddenStems[0].stem.hanja = 'changed';
  assert.deepEqual(read(), second);
  assert.equal(JSON.stringify({ features, NATAL_CATALOG }), before);
});

test('editorial copy avoids deterministic predictions, fear appeals and consequential directives', () => {
  const copy = JSON.stringify(NATAL_CATALOG);
  for (const pattern of [/반드시 성공/, /질병이 생깁/, /수익을 보장/, /투자하세/, /대출을 받으/, /약을 끊/, /결혼하게/, /임신하게/, /단명/, /불치병/]) assert.ok(!pattern.test(copy), String(pattern));
  assert.ok(Object.values(NATAL_CATALOG.areas).flatMap(Object.values).every((entry) => entry.paragraphs[1].includes('예를 들어')));
});
