import { onBirthResult } from './common.js';
import { interpretToday } from './interpreter.js';
import { ELEMENTS } from './content/interpretations.js';
import { interpretPersonality } from './personality-interpreter.js';
import { interpretLifetime } from './lifetime-interpreter.js';

const $ = (selector) => document.querySelector(selector);

let currentResult = null;


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
  $('#daily-error').textContent = errorMessage;
  $('#daily-error').hidden = !errorMessage;
  renderElements(currentResult);
  renderPersonalPreviews();
}

onBirthResult((result) => {
  currentResult = result;
  renderToday();
});
document.addEventListener('luck:date-change', renderToday);

function renderParagraphs(selector, paragraphs) {
  $(selector).replaceChildren(...paragraphs.map(text => {
    const p = document.createElement('p');
    p.className = 'body-copy';
    p.textContent = text;
    return p;
  }));
}

function firstSentence(text) {
  return text.match(/^.*?[.!?](?:\s|$)/u)?.[0].trim() || text;
}

function renderPoints(selector, points) {
  const list = $(selector);
  list.replaceChildren();
  for (const [label, text] of points) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = text;
    list.append(term, description);
  }
}

// Reuse each detail page's selected prose, preserving unknown-pillar states.
function renderPersonalPreviews() {
  $('#annual-keyword').textContent = '정보 입력 전';
  $('#annual-keyword-summary').textContent = '출생 정보를 입력해 주세요';
  $('#annual-year').textContent = '정보 입력 대기';
  $('#annual-title').textContent = '나의 올해 흐름';
  $('#personality-preview-title').textContent = '나의 성향';
  $('#lifetime-preview-title').textContent = '나의 평생운세';
  $('#annual-boundary').hidden = true;
  renderPoints('#personality-preview-points', []);
  renderPoints('#lifetime-preview-stages', []);
  for (const selector of ['#annual-summary', '#personality-preview-copy', '#lifetime-preview-copy']) {
    renderParagraphs(selector, ['출생 정보를 입력하면 나의 풀이를 확인할 수 있어요.']);
  }
  if (!currentResult) return;
  try {
    const personality = interpretPersonality(currentResult);
    if (personality?.status === 'available') {
      $('#personality-preview-title').textContent = personality.title;
      renderParagraphs('#personality-preview-copy', [personality.overview[1]]);
      renderPoints('#personality-preview-points', [
        ['잘하는 것', firstSentence(personality.details[0].paragraphs[0])],
        ['반복되는 약점', firstSentence(personality.details[3].paragraphs[0])],
      ]);
    } else {
      renderParagraphs('#personality-preview-copy', [personality?.message || '성향 풀이에 필요한 출생 정보를 확인해 주세요.']);
    }
    const lifetime = interpretLifetime(currentResult);
    const annual = lifetime.years[0];
    $('#annual-year').textContent = annual.year + '년 · 입춘 기준';
    $('#annual-title').textContent = annual.narrative.title;
    $('#annual-keyword').textContent = annual.narrative.title;
    $('#annual-keyword-summary').textContent = firstSentence(annual.narrative.paragraphs[0]);
    renderParagraphs('#annual-summary', [
      annual.narrative.paragraphs[0],
      annual.narrative.paragraphs[1] + ' ' + annual.narrative.paragraphs[2],
      annual.narrative.paragraphs[3],
      annual.narrative.paragraphs[4],
    ]);
    if (lifetime.nearBoundary) {
      $('#annual-keyword-summary').textContent = '입춘 전후 1분 · 연도 구분 미확정';
      $('#annual-boundary').textContent = '입춘 전후 1분 구간이라 올해의 구분을 확정하기 어려워요.';
      $('#annual-boundary').hidden = false;
    }
    const narrative = lifetime.narrative;
    if (narrative) {
      $('#lifetime-preview-title').textContent = narrative.title;
      renderParagraphs('#lifetime-preview-copy', [narrative.overview[0]]);
      renderPoints('#lifetime-preview-stages', narrative.stages.map((stage, index) => [
        ['초년', '중년', '말년'][index],
        stage.unavailable ? stage.paragraphs[0] : firstSentence(stage.paragraphs[0]),
      ]));
    }
  } catch {
    $('#annual-keyword').textContent = '풀이 확인 필요';
    $('#annual-keyword-summary').textContent = '출생 정보와 지원 날짜를 확인해 주세요.';
    $('#daily-error').textContent = '개인 풀이를 불러오지 못했어요. 출생 정보와 지원 날짜를 확인해 주세요.';
    $('#daily-error').hidden = false;
  }
}
