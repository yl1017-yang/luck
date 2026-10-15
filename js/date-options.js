import { convertBirthDate, formatCalendarDate, MAX_SOLAR_DATE } from './calendar.js';
import { MIN_BIRTH_DATE, koreaDate } from './profile.js';

export function selectableDays(year, month, calendar, leapMonth, today = koreaDate()) {
  if (!year || !month) return [];
  const days = [];
  for (let day = 1; day <= (calendar === 'lunar' ? 30 : 31); day += 1) {
    const birthDate = formatCalendarDate({ year, month, day });
    try {
      const solar = formatCalendarDate(convertBirthDate({ birthDate, calendar, leapMonth }).solar);
      if (solar >= MIN_BIRTH_DATE && solar <= MAX_SOLAR_DATE && solar <= today) days.push(day);
    } catch {
      // This date or leap month does not exist.
    }
  }
  return days;
}

export function selectableMonths(year, calendar, leapMonth, today = koreaDate()) {
  if (!year) return [];
  return Array.from({ length: 12 }, (_, index) => index + 1)
    .filter((month) => selectableDays(year, month, calendar, leapMonth, today).length > 0);
}
