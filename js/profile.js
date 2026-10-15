import { convertBirthDate, formatCalendarDate, MAX_SOLAR_DATE } from './calendar.js';

// Shared input policy and calendar validation. Saju calculation is separate.
export const MIN_BIRTH_DATE = '1900-01-01';
export const TIME_ZONE = 'Asia/Seoul';

export function koreaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function validateProfile(profile, today = koreaDate()) {
  if (!profile || !['solar', 'lunar'].includes(profile.calendar)) {
    return '양력 또는 음력을 선택해 주세요.';
  }
  if (typeof profile.leapMonth !== 'boolean' || typeof profile.unknownTime !== 'boolean') {
    return '윤달 여부와 출생 시간 입력을 확인해 주세요.';
  }
  if (profile.calendar === 'solar' && profile.leapMonth) {
    return '윤달 여부는 음력일 때만 선택할 수 있어요.';
  }
  if (typeof profile.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate)) {
    return '생년월일을 YYYY-MM-DD 형식으로 입력해 주세요.';
  }
  const [year, month, day] = profile.birthDate.split('-').map(Number);
  if (year < 1900 || year > Number(today.slice(0, 4))) {
    return '1900년부터 올해까지의 생년월일을 입력해 주세요.';
  }
  if (month < 1 || month > 12 || day < 1 || day > (profile.calendar === 'lunar' ? 30 : 31)) {
    return '생년월일의 월과 일을 확인해 주세요.';
  }
  if (profile.calendar === 'solar') {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return '실제로 존재하는 양력 날짜를 입력해 주세요.';
    }
    if (profile.birthDate > today) {
      return '미래의 생년월일은 입력할 수 없어요.';
    }
  }
  try {
    const solarDate = formatCalendarDate(convertBirthDate(profile).solar);
    if (solarDate < MIN_BIRTH_DATE || solarDate > MAX_SOLAR_DATE) {
      return '양력 환산 기준 1900년 1월 1일부터 2050년 12월 31일까지 지원해요.';
    }
    if (solarDate > today) {
      return '양력으로 변환한 생년월일이 미래예요. 날짜를 확인해 주세요.';
    }
  } catch (error) {
    return error.message;
  }
  if (!profile.unknownTime && (typeof profile.birthTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(profile.birthTime))) {
    return '출생 시간을 입력하거나 ‘시간 모름’을 선택해 주세요.';
  }
  return '';
}

export function normalizeProfile(profile) {
  return {
    displayName: typeof profile.displayName === 'string' ? profile.displayName.trim().slice(0, 20) : '',
    birthDate: typeof profile.birthDate === 'string' ? profile.birthDate.trim() : '',
    calendar: profile.calendar,
    leapMonth: profile.calendar === 'lunar' && profile.leapMonth === true,
    birthTime: profile.unknownTime ? null : profile.birthTime,
    unknownTime: profile.unknownTime,
  };
}
