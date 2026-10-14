const $ = (selector) => document.querySelector(selector);

function koreaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function updateDate() {
  const now = new Date();
  $('#today-date').textContent = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(now);
  $('#year').textContent = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(now);
  $('#birth-date').max = koreaDate();
}
updateDate();
setInterval(updateDate, 60000);

const dialog = $('#profile-dialog');
const form = $('#profile-form');
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
  const unknown = $('#unknown-time').checked;
  $('#birth-time').disabled = unknown;
  $('#birth-time').required = !unknown;
}
form.addEventListener('change', syncForm);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const birthDate = form.elements.birthDate.value;
  const [year, month, day] = birthDate.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  const validDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!validDate || year < 1 || birthDate > koreaDate()) {
    $('#form-error').textContent = '오늘 이전의 올바른 생년월일을 입력해 주세요.';
    return;
  }
  const profile = {
    birthDate,
    calendar: form.elements.calendar.value,
    leapMonth: form.elements.leapMonth.checked,
    birthTime: form.elements.birthTime.value,
    unknownTime: form.elements.unknownTime.checked,
  };
  renderProfile(profile);
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
  const [year, month, day] = profile.birthDate.split('-').map(Number);
  const calendar = profile.calendar === 'lunar' ? `음력${profile.leapMonth ? ' · 윤달' : ''}` : '양력';
  const time = profile.unknownTime ? '출생 시간 모름' : `${profile.birthTime} 출생`;
  $('#profile-title').textContent = `${year}년 ${month}월 ${day}일 · ${calendar}`;
  $('#profile-description').textContent = `${time} · 입력 정보만 반영됨 · 결과는 고정 예시`;
  $('#edit-profile').textContent = '정보 수정 ↗';
}

try {
  const stored = sessionStorage.getItem(PROFILE_KEY);
  const profile = stored ? JSON.parse(stored) : null;
  if (profile && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate) &&
      ['solar', 'lunar'].includes(profile.calendar) &&
      typeof profile.leapMonth === 'boolean' && typeof profile.unknownTime === 'boolean' &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(profile.birthTime)) {
    form.elements.birthDate.value = profile.birthDate;
    form.elements.calendar.value = profile.calendar;
    form.elements.leapMonth.checked = profile.leapMonth;
    form.elements.birthTime.value = profile.birthTime;
    form.elements.unknownTime.checked = profile.unknownTime;
    syncForm();
    renderProfile(profile);
  }
} catch {
  // Missing, invalid, or unavailable storage should not block the page.
}
