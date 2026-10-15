import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MASTERS, DAILY_THEMES } from '../js/content/interpretations.js';
import { DAILY_DETAILS } from '../js/content/daily-details.js';
import { calculateSaju, dayPillarForDate } from '../js/saju-calculator.js';
import { interpretBirth, interpretToday } from '../js/interpreter.js';
import { koreaDate } from '../js/profile.js';

const today = '2026-10-15';
const profile = (birthDate = '2000-01-01', birthTime = '12:00') => ({
  birthDate, birthTime, unknownTime: birthTime === null, calendar: 'solar', leapMonth: false,
});
const make = (birthDate, birthTime) => calculateSaju(profile(birthDate, birthTime), today);
const dateAfter = (date, offset) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);

test('no fabricated reading before profile input', () => {
  assert.equal(interpretBirth(null), null);
  assert.equal(interpretToday(null, today), null);
});

test('all sixty day pillars map to complete content for all ten day masters', () => {
  const covered = new Set();
  for (let index = 0; index < 60; index += 1) {
    const date = dateAfter('2000-01-01', index);
    const result = make(date);
    covered.add(result.features.dayMaster.hanja);
    const birth = interpretBirth(result);
    assert.equal(birth.personality.details.length, 5);
    assert.equal(birth.saju.length, 6);
    assert.equal(birth.personality.tags.length, 3);
    for (const card of [...birth.personality.details, ...birth.saju]) {
      assert.ok(card.title && card.text.length > 30);
      assert.ok(!card.text.includes('undefined') && !card.text.includes('NaN'));
    }
    assert.ok(birth.saju[1].text.includes('8글자'));
    assert.equal(birth.master, DAY_MASTERS[result.features.dayMaster.hanja]);
  }
  assert.equal(covered.size, 10);
});

test('same input and date are deterministic, including reload and optional name changes', () => {
  const result = make('1990-05-15');
  const expected = interpretToday(result, today);
  assert.deepEqual(interpretToday(JSON.parse(JSON.stringify(result)), today), expected);
  const renamed = calculateSaju({ ...profile('1990-05-15'), displayName: '<b>test</b>' }, today);
  assert.deepEqual(interpretToday(renamed, today), expected);
  const lunar = calculateSaju({ ...profile('2025-06-01'), calendar: 'lunar', leapMonth: true }, today);
  const solar = make('2025-07-25');
  assert.deepEqual(interpretToday(lunar, today), interpretToday(solar, today));
});

test('daily theme, advice, caution and action always come from one compatible bundle', () => {
  const result = make('1988-11-18');
  const seenThemes = new Set();
  const seenActions = new Set();
  for (let day = 0; day < 96; day += 1) {
    const reading = interpretToday(result, dateAfter('2026-01-01', day));
    const theme = DAILY_THEMES.find((item) => item.id === reading.themeId);
    const variantIndex = Number(reading.variantId.split('-').at(-1));
    const detail = variantIndex === 0 ? theme : DAILY_DETAILS[theme.id][variantIndex - 1];
    assert.ok(theme);
    assert.equal(reading.intro, detail.intro);
    assert.equal(reading.caution, theme.caution);
    assert.deepEqual(reading.hints.map((hint) => hint.text), [detail.relationship, detail.work, detail.life, theme.caution]);
    assert.ok(theme.actions.some((action) => action.title === reading.action.title));
    assert.equal(reading.dailyPillar.hanja, dayPillarForDate(reading.dateKey).hanja);
    seenThemes.add(reading.themeId);
    seenActions.add(reading.action.id);
  }
  assert.equal(seenThemes.size, 8);
  assert.equal(seenActions.size, 24);
  const firstWeek = Array.from({ length: 8 }, (_, day) => interpretToday(result, dateAfter(today, day)).themeId);
  assert.equal(new Set(firstWeek).size, 8);
});

test('missing hour and term ambiguity do not turn missing elements into a diagnosis', () => {
  const unknown = make('2024-02-04', null);
  const birth = interpretBirth(unknown);
  assert.ok(birth.note.includes('시주는 포함하지'));
  assert.ok(birth.note.includes('확정할 수 없는'));
  assert.ok(birth.compositionText.includes('2글자'));
  assert.ok(birth.compositionText.includes('부족함을 뜻하지'));
  const known = make('2024-02-04', '12:00');
  assert.deepEqual(interpretBirth(known).personality, birth.personality);
  assert.equal(interpretToday(unknown, today).themeId, interpretToday(known, today).themeId);
  assert.ok(interpretToday(unknown, today).coverage.includes('시주는 포함하지'));
});

test('Korean midnight changes the daily theme; year boundaries and historical keys work', () => {
  const result = make('1990-05-15');
  const before = koreaDate(new Date('2026-10-14T14:59:59Z'));
  const after = koreaDate(new Date('2026-10-14T15:00:00Z'));
  assert.notEqual(interpretToday(result, before).themeId, interpretToday(result, after).themeId);
  for (const date of ['1900-01-01', '2026-12-31', '2027-01-01', '2050-12-31']) {
    assert.ok(interpretToday(result, date).action.title);
  }
  assert.throws(() => interpretToday(result, '2026-02-30'), RangeError);
  assert.throws(() => interpretToday(result, '2051-01-01'), RangeError);
});

test('editorial data avoids promises, fear appeals and consequential decision instructions', () => {
  const text = JSON.stringify([DAY_MASTERS, DAILY_THEMES, DAILY_DETAILS]);
  for (const phrase of ['반드시 성공', '무조건', '100%', '큰 사고', '불행이', '투자하세요', '대출하세요', '치료하세요', '복권을']) {
    assert.ok(!text.includes(phrase), phrase);
  }
  for (const theme of DAILY_THEMES) {
    const texts = [theme.intro, theme.relationship, theme.work, theme.life, theme.caution, ...theme.actions.map((action) => action.title)];
    assert.equal(new Set(texts).size, texts.length);
  }
});

test('repeated themes receive distinct coherent copy before the 24-day cycle repeats', () => {
  const result = make('1990-05-15');
  const readings = Array.from({ length: 24 }, (_, day) => interpretToday(result, dateAfter(today, day)));
  assert.equal(new Set(readings.map((reading) => reading.intro)).size, 24);
  for (let day = 0; day < 8; day += 1) {
    assert.equal(readings[day].themeId, readings[day + 8].themeId);
    assert.notEqual(readings[day].intro, readings[day + 8].intro);
    assert.notEqual(readings[day].hints[0].text, readings[day + 8].hints[0].text);
  }
  for (const theme of DAILY_THEMES) {
    assert.equal(DAILY_DETAILS[theme.id].length, 2);
    for (const detail of DAILY_DETAILS[theme.id]) {
      for (const field of ['intro', 'relationship', 'work', 'life']) assert.ok(detail[field].length > 20);
    }
  }
});
