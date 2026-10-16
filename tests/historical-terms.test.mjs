import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Solar } from '../js/vendor/lunar-javascript/lunar.mjs';
import { springBoundary } from '../js/saju-calculator.js';

const root = new URL('./fixtures/historical-terms/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const hkoYears = [1901, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2025];
assert.deepEqual(manifest.hkoYears, hkoYears);
assert.deepEqual(manifest.usnoYears, [1900, ...hkoYears]);
assert.equal(manifest.sources.length, 29);
for (const source of manifest.sources) {
  const bytes = readFileSync(new URL(source.file, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256, source.file);
}

const names = [
  'Moderate Cold', 'Severe Cold', 'Spring Commences', 'Spring Showers',
  'Insects Waken', 'Vernal Equinox', 'Bright & Clear', 'Corn Rain',
  'Summer Commences', 'Corn Forms', 'Corn on Ear', 'Summer Solstice',
  'Moderate Heat', 'Great Heat', 'Autumn Commences', 'End of Heat',
  'White Dew', 'Autumnal Equinox', 'Cold Dew', 'Frost',
  'Winter Commences', 'Light Snow', 'Heavy Snow', 'Winter Solstice',
];
const keys = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', 'DONG_ZHI'];
const hko = [];
const usno = [];
const pad = (value) => String(value).padStart(2, '0');

for (const year of manifest.usnoYears) {
  const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable();
  if (hkoYears.includes(year)) {
    // HKO originals retain their source bytes. Only ASCII date/term columns are parsed.
    const lines = readFileSync(new URL(`hko-${year}.txt`, root), 'latin1').split(/\r?\n/);
    const column = lines.find((line) => line.startsWith('Gregorian date')).indexOf('Solar terms');
    assert.ok(column > 0);
    const rows = lines.filter((line) => /^\d{4}\/\d{1,2}\/\d{1,2}\s/.test(line) && line.slice(column).trim());
    assert.equal(rows.length, 24, `HKO ${year}: missing or extra term`);
    assert.deepEqual(rows.map((line) => line.slice(column).trim()), names);
    rows.forEach((line, index) => {
      const expected = line.split(/\s/)[0].split('/').map(pad).join('-');
      // Compare in HKO's UTC+8 calendar, NOT directly against the KST date.
      const engine = table[keys[index]].toYmdHms();
      const kst = new Date(Date.parse(engine.replace(' ', 'T') + '+08:00') + 9 * 3600000)
        .toISOString().slice(0, 19);
      hko.push({ year, term: names[index], referenceDate: expected, engineUtc8: engine, engineKst: kst, match: engine.slice(0, 10) === expected });
      if (index === 2) assert.equal(springBoundary(year).koreanTime, kst + '+09:00');
    });
  }
  const reference = JSON.parse(readFileSync(new URL(`usno-${year}.json`, root), 'utf8'));
  assert.equal(reference.year, year);
  assert.equal(reference.tz, 0);
  assert.equal(reference.dst, false);
  const seasons = reference.data.filter((row) => ['Equinox', 'Solstice'].includes(row.phenom));
  assert.deepEqual(seasons.map((row) => row.month), [3, 6, 9, 12]);
  seasons.forEach((row, index) => {
    const key = ['春分', '夏至', '秋分', 'DONG_ZHI'][index];
    const expected = `${year}-${pad(row.month)}-${pad(row.day)}T${row.time}:00Z`;
    const engine = new Date(table[key].toYmdHms().replace(' ', 'T') + '+08:00');
    // USNO tz=0 is UT1. ISO Z is a numerical container here, not proof of UTC/UT1 identity.
    const deltaSeconds = (engine.getTime() - Date.parse(expected)) / 1000;
    usno.push({ year, term: key, referenceUt1: expected, engineInstant: engine.toISOString(), deltaSeconds });
  });
}

const differences = usno.map((row) => Math.abs(row.deltaSeconds));
const summary = {
  hkoCount: hko.length,
  hkoDateMismatches: hko.filter((row) => !row.match),
  kstDateRollovers: hko.filter((row) => row.engineUtc8.slice(0, 10) !== row.engineKst.slice(0, 10)).length,
  usnoCount: usno.length,
  maxAbsoluteSeconds: Math.max(...differences),
  meanAbsoluteSeconds: differences.reduce((sum, value) => sum + value, 0) / differences.length,
  over60Seconds: usno.filter((row) => Math.abs(row.deltaSeconds) > 60),
};
console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes('--report')) {
  writeFileSync(new URL('../doc/HISTORICAL_TERMS_RESULTS.json', import.meta.url),
    JSON.stringify({ validatedOn: '2026-10-16', summary, hko, usno }, null, 2) + '\n');
}
assert.equal(hko.length, 336);
assert.equal(usno.length, 60);
assert.equal(summary.hkoDateMismatches.length, 0, 'HKO date disagreement');
assert.equal(summary.over60Seconds.length, 0, 'USNO difference exceeds existing 60-second comparison tolerance');
console.log('Historical solar terms: 336 HKO dates and 60 USNO times passed.');
