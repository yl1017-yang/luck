import { TIME_ZONE, koreaDate, validateProfile, normalizeProfile } from './profile.js';
import { convertBirthDate, formatCalendarDate } from './calendar.js';
import { createDatePicker } from './date-picker.js';
import { calculateSaju } from './saju-calculator.js';
import { FORTUNE_VIEW_KEY } from './fortune-view-state.js';

let birthResult = null;
let displayedDateKey = null;

export function onBirthResult(listener) {
  listener(birthResult);
  const handler = () => listener(birthResult);
  document.addEventListener('luck:birth-result', handler);
  return () => document.removeEventListener('luck:birth-result', handler);
}

function applyProfile(profile) {
  const result = calculateSaju(profile);
  renderProfile(profile);
  birthResult = result;
  document.dispatchEvent(new CustomEvent('luck:birth-result'));
}

const $ = (selector) => document.querySelector(selector);
const defaultPageTitle = $('#page-title').textContent.trim();
const defaultProfileTitle = $('#profile-title').textContent;
const defaultProfileDescription = $('#profile-description').textContent;
const defaultEditLabel = $('#edit-profile').textContent;
const pageLabels = {
  'today-view': '오늘의 운세',
  'saju-view': '사주팔자',
  'personality-view': '내 성향',
  'lifetime-view': '평생운세',
};

function updateDate() {
  const now = new Date();
  $('#today-date').textContent = new Intl.DateTimeFormat('ko-KR', { timeZone: TIME_ZONE, year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(now);
  $('#year').textContent = new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, year: 'numeric' }).format(now);
  const nextDateKey = koreaDate(now);
  const changed = displayedDateKey !== null && displayedDateKey !== nextDateKey;
  displayedDateKey = nextDateKey;
  if (changed) document.dispatchEvent(new CustomEvent('luck:date-change'));
  document.dispatchEvent(new CustomEvent('luck:clock-tick'));
}
updateDate();
setInterval(() => { updateDate(); datePicker.refresh(); }, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { updateDate(); datePicker.refresh(); }
});

const dialog = $('#profile-dialog');
const form = $('#profile-form');
const datePicker = createDatePicker(form);
$('#edit-profile').addEventListener('click', () => { $('#form-error').textContent = ''; dialog.showModal(); });
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
function syncForm() {
  const lunar = form.elements.calendar.value === 'lunar';
  $('#leap-field').hidden = !lunar;
  if (!lunar) form.elements.leapMonth.checked = false;
  datePicker.refresh();
  const unknown = $('#unknown-time').checked;
  $('#birth-time').disabled = unknown;
  $('#birth-time').required = !unknown;
}
form.addEventListener('change', syncForm);
form.addEventListener('input', () => { $('#form-error').textContent = ''; });
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const profile = normalizeProfile({
    displayName: form.elements.displayName.value.trim().slice(0, 20),
    birthDate: datePicker.getValue(),
    calendar: form.elements.calendar.value,
    leapMonth: form.elements.leapMonth.checked,
    birthTime: form.elements.birthTime.value,
    unknownTime: form.elements.unknownTime.checked,
  });
  const error = validateProfile(profile);
  if (error) {
    $('#form-error').textContent = error;
    return;
  }
  try {
    applyProfile(profile);
  } catch {
    $('#form-error').textContent = '사주 계산 중 문제가 발생했어요. 입력 정보를 확인하고 다시 시도해 주세요.';
    return;
  }
  try {
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage may be disabled. The current page remains usable.
    $('#profile-description').textContent += ' · 브라우저 설정으로 페이지 간 임시 보관 불가';
  }
  dialog.close();
});

const PROFILE_KEY = 'luck.birthProfile.v1';

function renderProfile(profile) {
  const name = typeof profile.displayName === 'string' ? profile.displayName.trim().slice(0, 20) : '';
  const pageLabel = pageLabels[document.querySelector('.view').id];
  $('#page-title').textContent = name ? `${name}님의 ${pageLabel}` : defaultPageTitle;
  const [year, month, day] = profile.birthDate.split('-').map(Number);
  const calendar = profile.calendar === 'lunar' ? `음력${profile.leapMonth ? ' · 윤달' : ''}` : '양력';
  const time = profile.unknownTime ? '출생 시간 모름' : `${profile.birthTime} 출생`;
  $('#profile-title').textContent = `${name ? `${name}님 · ` : ''}${year}년 ${month}월 ${day}일 · ${calendar}`;
  const converted = convertBirthDate(profile);
  const otherDate = profile.calendar === 'lunar'
    ? `양력 ${formatCalendarDate(converted.solar)}`
    : `음력 ${formatCalendarDate(converted.lunar)}${converted.lunar.intercalation ? ' (윤달)' : ''}`;
  $('#profile-description').textContent = `${otherDate} · ${time}`;
  $('#edit-profile').textContent = '정보 수정 ↗';
}

try {
  const stored = sessionStorage.getItem(PROFILE_KEY);
  const profile = stored ? JSON.parse(stored) : null;
  if (profile && !validateProfile(profile)) {
    form.elements.displayName.value = typeof profile.displayName === 'string' ? profile.displayName.trim().slice(0, 20) : '';
    form.elements.calendar.value = profile.calendar;
    form.elements.leapMonth.checked = profile.leapMonth;
    form.elements.birthTime.value = profile.birthTime || '';
    form.elements.unknownTime.checked = profile.unknownTime;
    syncForm();
    datePicker.setValue(profile.birthDate, profile.leapMonth);
    applyProfile(normalizeProfile(profile));
  }
} catch {
  // Missing, invalid, or unavailable storage should not block the page.
}

$('#delete-profile').addEventListener('click', () => {
  let storageFailed = false;
  for (const key of [PROFILE_KEY, FORTUNE_VIEW_KEY]) {
    try { sessionStorage.removeItem(key); } catch { storageFailed = true; }
  }
  form.reset();
  for (const name of ['displayName', 'birthYear', 'birthMonth', 'birthDay', 'birthTime']) {
    form.elements[name].value = '';
  }
  syncForm();
  $('#form-error').textContent = '';
  $('#page-title').textContent = defaultPageTitle;
  $('#profile-title').textContent = defaultProfileTitle;
  $('#profile-description').textContent = storageFailed
    ? '화면은 초기화했지만 저장 정보 삭제에 실패했어요. 브라우저 설정에서 이 사이트의 데이터를 삭제해 주세요.'
    : '내 정보를 삭제했어요. ' + defaultProfileDescription.trim();
  $('#edit-profile').textContent = defaultEditLabel;
  birthResult = null;
  document.dispatchEvent(new CustomEvent('luck:birth-result'));
  dialog.close();
  $('#edit-profile').focus();
});