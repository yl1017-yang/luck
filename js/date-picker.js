import { selectableDays, selectableMonths } from './date-options.js';
import { formatCalendarDate, MAX_SOLAR_DATE } from './calendar.js';
import { koreaDate } from './profile.js';

export function createDatePicker(form) {
  const yearSelect = form.elements.birthYear;
  const monthSelect = form.elements.birthMonth;
  const daySelect = form.elements.birthDay;
  const leapInput = form.elements.leapMonth;

  function setOptions(select, values, label) {
    const optionsKey = `${label}:${values.join(',')}`;
    // Preserve native dropdown focus/open state when only unrelated inputs change.
    if (select.dataset.optionsKey === optionsKey) return;
    const selected = select.value;
    const placeholder = new Option(label, '');
    placeholder.disabled = true;
    select.replaceChildren(placeholder, ...values.map((value) => new Option(`${value}${label}`, String(value))));
    select.value = values.includes(Number(selected)) ? selected : '';
    select.dataset.optionsKey = optionsKey;
  }

  function refresh() {
    const today = koreaDate();
    const maxYear = Math.min(Number(today.slice(0, 4)), Number(MAX_SOLAR_DATE.slice(0, 4)));
    setOptions(yearSelect, Array.from({ length: maxYear - 1899 }, (_, index) => maxYear - index), '년');
    const year = Number(yearSelect.value);
    const lunar = form.elements.calendar.value === 'lunar';
    const leapMonths = lunar ? selectableMonths(year, 'lunar', true, today) : [];
    leapInput.disabled = !lunar || leapMonths.length === 0;
    if (leapInput.disabled) leapInput.checked = false;
    const months = selectableMonths(year, lunar ? 'lunar' : 'solar', leapInput.checked, today);
    setOptions(monthSelect, months, '월');
    monthSelect.disabled = !year || months.length === 0;
    const month = Number(monthSelect.value);
    const days = selectableDays(year, month, lunar ? 'lunar' : 'solar', leapInput.checked, today);
    setOptions(daySelect, days, '일');
    daySelect.disabled = !month || days.length === 0;
    let help = '1900년부터 오늘까지, 실제로 존재하는 날짜만 선택할 수 있어요.';
    if (lunar) {
      help = !year ? '연도를 선택하면 해당 연도의 음력 월·일과 윤달 여부를 확인할 수 있어요.'
        : leapMonths.length === 0 ? `${year}년에는 선택 가능한 윤달이 없어요. 일반 음력 날짜를 선택해 주세요.`
        : leapInput.checked ? `${year}년 윤${leapMonths.join('·')}월의 실제 날짜만 선택할 수 있어요.`
        : `${year}년은 윤${leapMonths.join('·')}월을 선택할 수 있어요. 윤달 생일이면 옆의 윤달 항목을 체크해 주세요.`;
    }
    document.querySelector('#birth-date-help').textContent = help;
  }

  function getValue() {
    if (!yearSelect.value || !monthSelect.value || !daySelect.value) return '';
    return formatCalendarDate({ year: Number(yearSelect.value), month: Number(monthSelect.value), day: Number(daySelect.value) });
  }

  function setValue(value, leapMonth = false) {
    const [year, month, day] = value.split('-');
    yearSelect.value = year;
    leapInput.checked = leapMonth;
    refresh();
    monthSelect.value = String(Number(month));
    refresh();
    daySelect.value = String(Number(day));
  }

  refresh();
  return { refresh, getValue, setValue };
}
