// Validation prototype only: not imported by the website.
import lunarEngine from '../vendor/lunar-javascript/lunar.cjs';
import { convertBirthDate, formatCalendarDate } from '../../js/calendar.js';

export const { Solar } = lunarEngine;
const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];

export function parseWallTime(text) {
  // This UTC value is a timezone-independent container for wall-clock components.
  return new Date(text.replace(' ', 'T') + 'Z');
}

function engineSolar(date) {
  return Solar.fromYmdHms(date.getUTCFullYear(), date.getUTCMonth() + 1,
    date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
}

export function koreanTerms(year) {
  const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable();
  // The engine's term timestamps are UTC+8 wall time. Convert to fixed UTC+9.
  return Object.values(table)
    .map((solar) => new Date(parseWallTime(solar.toYmdHms()).getTime() + 3600000))
    .filter((date) => date.getUTCFullYear() === year)
    .sort((a, b) => a - b);
}

export function pillarsAt(kstWallTime) {
  const kst = parseWallTime(kstWallTime);
  const cst = new Date(kst.getTime() - 3600000);
  const termLunar = engineSolar(cst).getLunar();
  const localLunar = engineSolar(kst).getLunar();
  const dayStem = localLunar.getDayGanIndexExact2();
  const branch = Math.floor((kst.getUTCHours() + 1) / 2) % 12;
  return {
    year: termLunar.getYearInGanZhiExact(),
    month: termLunar.getMonthInGanZhiExact(),
    day: localLunar.getDayInGanZhiExact2(),
    // The engine's native hour stem uses a 23:00 day boundary even in sect 2.
    // Recompute it from the KST midnight-based day stem and KST hour branch.
    hour: STEMS[(dayStem % 5 * 2 + branch) % 10] + BRANCHES[branch],
  };
}

export function candidateProfile(profile) {
  const birthDate = formatCalendarDate(convertBirthDate(profile).solar);
  if (!profile.unknownTime) return { ...pillarsAt(`${birthDate} ${profile.birthTime}:00`), uncertain: [] };
  const start = pillarsAt(`${birthDate} 00:00:00`);
  const end = pillarsAt(`${birthDate} 23:59:59`);
  const uncertain = ['year', 'month'].filter((key) => start[key] !== end[key]);
  return {
    year: uncertain.includes('year') ? null : start.year,
    month: uncertain.includes('month') ? null : start.month,
    day: start.day,
    hour: null,
    uncertain,
  };
}
