import { onBirthResult } from './common.js';
import { interpretLifetime } from './lifetime-interpreter.js';
import { createFortuneView } from './fortune-view.js';

const $ = (selector) => document.querySelector(selector);
const fortuneView = createFortuneView();
let currentResult = null;
let renderedResult;
let renderedCycle;

function formatBoundary(boundary) {
  return boundary.koreanTime.slice(0, 16).replace('T', ' ');
}

function renderLifetime() {
  let reading = null;
  let error = '';
  try {
    reading = interpretLifetime(currentResult);
  } catch {
    error = '현재 조회 날짜의 연도별 흐름을 제공할 수 없어요. 지원 범위는 1901~2050년이에요.';
  }
  const cycle = reading ? `${reading.years[0].year}|${reading.nearBoundary}` : error;
  if (renderedResult === currentResult && renderedCycle === cycle) return;
  renderedResult = currentResult;
  renderedCycle = cycle;
  $('#lifetime-status').textContent = reading ? `${reading.master.name} · 원국 기반 상세` : '정보 입력 대기';
  $('#lifetime-title').textContent = reading?.narrative?.title || '나를 지탱하는 삶의 방향';
  if (reading?.narrative) $('#lifetime-view').dataset.readingVersion = reading.narrative.version;
  else delete $('#lifetime-view').dataset.readingVersion;
  $('#lifetime-intro').replaceChildren();
  for (const copy of reading?.narrative?.overview || [reading?.overview || '출생 정보를 입력하면 평생 총운과 초년·중년·말년의 관점을 확인할 수 있어요.']) {
    const paragraph = document.createElement('p');
    paragraph.textContent = copy;
    $('#lifetime-intro').append(paragraph);
  }
  const addBasis = (container, copy) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '이 풀이의 근거';
    const text = document.createElement('p');
    text.textContent = copy;
    details.append(summary, text);
    container.append(details);
  };
  if (reading?.narrative) addBasis($('#lifetime-intro'), reading.narrative.basis);
  $('#lifetime-tags').replaceChildren();
  for (const tag of reading?.narrative?.tags || []) {
    const span = document.createElement('span');
    span.textContent = tag;
    $('#lifetime-tags').append(span);
  }
  $('#lifetime-details').replaceChildren();
  for (const item of reading?.narrative ? [...reading.narrative.stages, ...reading.narrative.areas] : []) {
    const card = document.createElement('article');
    card.className = 'card';
    const title = document.createElement('h3');
    title.textContent = item.title;
    card.append(title);
    for (const copy of item.paragraphs) {
      const paragraph = document.createElement('p');
      paragraph.textContent = copy;
      card.append(paragraph);
    }
    if (item.action) {
      const action = document.createElement('p');
      action.className = 'info-note';
      action.textContent = item.action;
      card.append(action);
    }
    addBasis(card, item.basis);
    $('#lifetime-details').append(card);
  }
  $('#lifetime-error').textContent = error;
  $('#lifetime-error').hidden = !error;
  $('#annual-status').textContent = reading ? (reading.nearBoundary ? '입춘 경계 확인 필요' : `${reading.years.length}개 연도`) : '정보 입력 대기';
  $('#annual-note').textContent = reading?.nearBoundary ? '입춘 경계 1분 이내라 현재 구간을 확정하기 어려워요.' : '';
  $('#annual-note').hidden = !reading?.nearBoundary;
  $('#annual-cards').replaceChildren();
  for (const year of reading?.years || []) {
    const card = document.createElement('article');
    card.className = 'annual-card';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = year.current ? '현재 구간' : '이어지는 흐름';
    const title = document.createElement('h3');
    title.textContent = `${year.year}년`;
    const period = document.createElement('p');
    period.className = 'muted small';
    period.textContent = `${formatBoundary(year.start)}부터 ${formatBoundary(year.end)} 직전까지`;
    const topic = document.createElement('h4');
    topic.textContent = year.narrative.title;
    card.append(badge, title, period, topic);
    for (const copy of year.narrative.paragraphs) {
      const paragraph = document.createElement('p');
      paragraph.className = 'body-copy';
      paragraph.textContent = copy;
      card.append(paragraph);
    }
    addBasis(card, `일간 ${year.narrative.basis.dayMaster} · ${year.year}년 ${year.pillar.hangul}(${year.pillar.hanja}) · ${year.tenGod}`);
    const detail = document.createElement('button');
    detail.type = 'button';
    detail.className = 'button button-outline';
    detail.textContent = year.year < 1901 ? '월운은 1901년부터 제공해요' : `${year.year}년 월운 보기`;
    detail.disabled = year.year < 1901;
    detail.addEventListener('click', () => fortuneView.open(year.year));
    card.append(detail);
    $('#annual-cards').append(card);
  }
}

onBirthResult((result) => {
  currentResult = result;
  renderLifetime();
  fortuneView.update(result);
});
document.addEventListener('luck:clock-tick', renderLifetime);
