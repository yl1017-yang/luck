import { Solar } from './vendor/lunar-javascript/lunar.mjs';
import { convertBirthDate, formatCalendarDate } from './calendar.js';
import { validateProfile, normalizeProfile } from './profile.js';

const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];
const STEM_NAMES = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const BRANCH_NAMES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const STEM_ELEMENTS = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
const BRANCH_ELEMENTS = ['water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water'];

function wallTime(date, time) {
  // UTC is only a container for fixed UTC+9 wall-clock components here.
  return new Date(`${date}T${time}Z`);
}

function engineSolar(date) {
  return Solar.fromYmdHms(date.getUTCFullYear(), date.getUTCMonth() + 1,
    date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
}

function pillarsAt(kst) {
  const terms = engineSolar(new Date(kst.getTime() - 3600000)).getLunar();
  const local = engineSolar(kst).getLunar();
  const dayStem = local.getDayGanIndexExact2();
  const hourBranch = Math.floor((kst.getUTCHours() + 1) / 2) % 12;
  return {
    year: terms.getYearInGanZhiExact(),
    month: terms.getMonthInGanZhiExact(),
    day: local.getDayInGanZhiExact2(),
    hour: STEMS[(dayStem % 5 * 2 + hourBranch) % 10] + BRANCHES[hourBranch],
  };
}

export function describePillar(hanja) {
  if (!hanja) return null;
  const stem = STEMS.indexOf(hanja[0]);
  const branch = BRANCHES.indexOf(hanja[1]);
  return {
    hanja,
    hangul: STEM_NAMES[stem] + BRANCH_NAMES[branch],
    stem: { hanja: hanja[0], hangul: STEM_NAMES[stem], element: STEM_ELEMENTS[stem] },
    branch: { hanja: hanja[1], hangul: BRANCH_NAMES[branch], element: BRANCH_ELEMENTS[branch] },
  };
}

export function dayPillarForDate(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey < '1900-01-01' || dateKey > '2050-12-31') {
    throw new RangeError('날짜별 콘텐츠의 지원 범위를 벗어났어요.');
  }
  const date = wallTime(dateKey, '12:00:00');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    throw new RangeError('올바른 날짜를 지정해 주세요.');
  }
  return describePillar(engineSolar(date).getLunar().getDayInGanZhiExact2());
}

export function springBoundary(year) {
  // Allow one additional year only to close the last supported annual interval.
  if (!Number.isInteger(year) || year < 1900 || year > 2051) {
    throw new RangeError('입춘 시각은 1900~2051년 범위에서 조회할 수 있어요.');
  }
  const term = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable()['立春'];
  const instant = new Date(term.toYmdHms().replace(' ', 'T') + '+08:00');
  const kstWall = new Date(instant.getTime() + 9 * 3600000).toISOString().slice(0, 19);
  return { instant: instant.toISOString(), koreanTime: `${kstWall}+09:00` };
}

export function annualPillar(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 2050) {
    throw new RangeError('연도별 흐름은 1900~2050년 범위에서 제공해요.');
  }
  return {
    year,
    pillar: describePillar(Solar.fromYmd(year, 7, 1).getLunar().getYearInGanZhiExact()),
    start: springBoundary(year),
    end: springBoundary(year + 1),
  };
}

export function tenGodForStems(dayStem, otherStem) {
  const day = STEMS.indexOf(dayStem);
  const other = STEMS.indexOf(otherStem);
  if (day < 0 || other < 0) throw new RangeError('올바른 천간을 지정해 주세요.');
  const elements = ['wood', 'fire', 'earth', 'metal', 'water'];
  const offset = (elements.indexOf(STEM_ELEMENTS[other]) - elements.indexOf(STEM_ELEMENTS[day]) + 5) % 5;
  const samePolarity = day % 2 === other % 2;
  const pairs = [
    ['비견', '겁재'], ['식신', '상관'], ['편재', '정재'],
    ['편관', '정관'], ['편인', '정인'],
  ];
  return pairs[offset][samePolarity ? 0 : 1];
}

export function calculateSaju(input, today) {
  const error = validateProfile(input, today);
  if (error) throw new RangeError(error);
  const profile = normalizeProfile(input);
  const dates = convertBirthDate(profile);
  const solarDate = formatCalendarDate(dates.solar);
  let raw;
  let uncertaintyReason = null;
  const alternatives = {};

  if (profile.unknownTime) {
    raw = pillarsAt(wallTime(solarDate, '00:00:00'));
    const end = pillarsAt(wallTime(solarDate, '23:59:59'));
    for (const key of ['year', 'month']) {
      if (raw[key] !== end[key]) {
        alternatives[key] = [raw[key], end[key]];
        raw[key] = null;
      }
    }
    raw.hour = null;
    if (Object.keys(alternatives).length) uncertaintyReason = 'unknown-time-on-term-day';
  } else {
    const moment = wallTime(solarDate, `${profile.birthTime}:00`);
    raw = pillarsAt(moment);
    // Minute input and minute-resolution reference data cannot establish exact
    // birth ordering within one minute of a computed term. Do not force a result.
    const before = pillarsAt(new Date(moment.getTime() - 60000));
    const after = pillarsAt(new Date(moment.getTime() + 60000));
    for (const key of ['year', 'month']) {
      if (before[key] !== after[key]) {
        alternatives[key] = [before[key], after[key]];
        raw[key] = null;
      }
    }
    if (Object.keys(alternatives).length) uncertaintyReason = 'near-term-boundary';
  }

  const pillars = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, describePillar(value)]));
  const elements = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const pillar of Object.values(pillars)) {
    if (!pillar) continue;
    elements[pillar.stem.element] += 1;
    elements[pillar.branch.element] += 1;
  }

  return {
    profile,
    dates,
    pillars,
    features: {
      dayMaster: pillars.day.stem,
      elements,
      elementCount: Object.values(elements).reduce((sum, count) => sum + count, 0),
      partial: Object.values(pillars).some((pillar) => pillar === null),
    },
    uncertainty: {
      reason: uncertaintyReason,
      pillars: Object.keys(alternatives),
      alternatives: Object.fromEntries(Object.entries(alternatives).map(([key, values]) => [key, values.map(describePillar)])),
    },
    policy: { timeZone: 'UTC+09:00', dayBoundary: '00:00', solarTimeCorrection: false, termMarginSeconds: 60 },
    engine: 'lunar-javascript@1.7.7 + KST/midnight adapter',
  };
}
