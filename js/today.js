import { onBirthResult } from './common.js';
import { interpretToday } from './interpreter.js';
import { ELEMENTS } from './content/interpretations.js';
import { renderHints } from './render.js';

const $ = (selector) => document.querySelector(selector);

let currentResult = null;
let actionKey = null;

function renderElements(result) {
  const chart = $('#element-chart');
  chart.replaceChildren();
  if (!result) {
    chart.setAttribute('aria-label', '출생 정보 입력 전, 오행 구성 없음');
    $('#elements-status').textContent = '정보 입력 대기';
    $('#elements-note').textContent = '출생 정보를 입력하면 확인할 수 있어요.';
    return;
  }
  const counts = result.features.elements;
  const maximum = Math.max(1, ...Object.values(counts));
  const labels = [];
  for (const [key, element] of Object.entries(ELEMENTS)) {
    const column = document.createElement('div');
    column.className = 'element-column';
    const count = document.createElement('span');
    count.textContent = String(counts[key]);
    const track = document.createElement('div');
    track.className = 'bar-track';
    const bar = document.createElement('div');
    bar.className = `bar ${key}`;
    bar.style.setProperty('--level', `${counts[key] / maximum * 100}%`);
    track.append(bar);
    const label = document.createElement('strong');
    label.textContent = element.name;
    column.append(count, track, label);
    chart.append(column);
    labels.push(`${element.name} ${counts[key]}개`);
  }
  chart.setAttribute('aria-label', `확인된 글자의 오행 개수: ${labels.join(', ')}`);
  $('#elements-status').textContent = result.features.partial ? '일부 기둥 집계' : '8글자 집계';
  $('#elements-note').textContent = `${result.features.elementCount}글자 기준${result.features.partial ? ' · 시간 미상·미확정 기둥 제외' : ''}. 강약이나 결핍을 뜻하지 않아요.`;
}

function renderToday() {
  let reading = null;
  let errorMessage = '';
  try {
    reading = interpretToday(currentResult);
  } catch {
    errorMessage = '오늘 날짜의 콘텐츠를 불러올 수 없어요. 지원 날짜 범위를 확인해 주세요.';
  }
  $('#daily-keyword').textContent = reading?.keyword || '정보 입력 전';
  $('#daily-summary').textContent = reading?.note || '출생 정보를 입력해 주세요';
  $('#daily-master').textContent = reading ? `${reading.master.name} (${currentResult.features.dayMaster.hanja})` : '—';
  $('#daily-master-symbol').textContent = reading?.master.symbol || '입력 후 확인할 수 있어요';
  $('#daily-personality').textContent = reading?.personalityTitle || '—';
  $('#daily-date').textContent = reading?.dateKey || '정보 입력 대기';
  $('#daily-title').textContent = reading?.title || '나에게 맞는 오늘의 힌트';
  $('#daily-intro').textContent = reading?.intro || '출생 정보를 입력하면 날짜에 맞춘 생활 조언을 볼 수 있어요.';
  $('#daily-note').textContent = reading?.note || '같은 입력과 날짜에는 같은 내용을 보여드려요.';
  $('#daily-action-title').textContent = reading?.action.title || '오늘의 작은 실천';
  $('#daily-action-text').textContent = reading?.action.text || '출생 정보 입력 후 오늘의 제안을 확인해 보세요.';
  $('#daily-error').textContent = errorMessage;
  $('#daily-error').hidden = !errorMessage;
  renderHints('#daily-hints', reading?.hints || []);
  renderElements(currentResult);
  const nextKey = reading ? `${currentResult.profile.birthDate}|${currentResult.profile.calendar}|${currentResult.profile.leapMonth}|${reading.dateKey}|${reading.action.id}` : null;
  const button = $('#action-toggle');
  button.disabled = !reading;
  if (nextKey !== actionKey) {
    button.setAttribute('aria-pressed', 'false');
    button.textContent = '오늘의 실천 체크';
    actionKey = nextKey;
  }
}

onBirthResult((result) => {
  currentResult = result;
  renderToday();
});
document.addEventListener('luck:date-change', renderToday);

$('#action-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const completed = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(completed));
  button.textContent = completed ? '작은 실천 완료 ✓' : '오늘의 실천 체크';
});
