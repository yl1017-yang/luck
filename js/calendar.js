import KoreanLunarCalendar from './vendor/korean-lunar-calendar/calendar.mjs';

export const CALENDAR_VERSION = '0.4.0';
export const MAX_SOLAR_DATE = '2050-12-31';

export function formatCalendarDate(date) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

// Create a fresh instance each time: failed setters retain the previous valid date.
// Calendar GapJa is deliberately not used as the service's saju pillars.
export function convertBirthDate(profile) {
  const calendar = new KoreanLunarCalendar();
  const [year, month, day] = profile.birthDate.split('-').map(Number);
  const valid = profile.calendar === 'lunar'
    ? calendar.setLunarDate(year, month, day, profile.leapMonth)
    : calendar.setSolarDate(year, month, day);

  if (!valid) {
    throw new RangeError(profile.calendar === 'lunar'
      ? '존재하지 않는 음력 날짜 또는 윤달이에요. 날짜와 윤달 여부를 확인해 주세요.'
      : '변환 가능한 양력 날짜를 입력해 주세요. 지원 범위는 2050년까지예요.');
  }

  return {
    solar: calendar.getSolarCalendar(),
    lunar: calendar.getLunarCalendar(),
  };
}
