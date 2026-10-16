import { onBirthResult } from './common.js';
import { interpretLifetime } from './lifetime-interpreter.js';
import { renderCards } from './render.js';
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
  $('#lifetime-status').textContent = reading ? `${reading.master.name} · 일간 기반` : '정보 입력 대기';
  $('#lifetime-title').textContent = reading?.title || '나를 지탱하는 삶의 방향';
  $('#lifetime-intro').textContent = reading?.overview || '출생 정보를 입력하면 인생 전반의 경향과 연도별 생활 주제를 확인할 수 있어요.';
  $('#lifetime-tags').replaceChildren();
  for (const tag of reading?.master.tags || []) {
    const span = document.createElement('span');
    span.textContent = tag;
    $('#lifetime-tags').append(span);
  }
  renderCards('#lifetime-details', reading?.details || []);
  $('#lifetime-note').textContent = error || reading?.note || '수명이나 특정 나이의 사건을 예측하지 않는 자기 성찰용 콘텐츠예요.';
  $('#annual-status').textContent = reading ? (reading.nearBoundary ? '입춘 경계 확인 필요' : `${reading.years.length}개 연도`) : '정보 입력 대기';
  $('#annual-note').textContent = reading?.annualNote || '출생 정보를 입력하면 연도별 세운을 확인할 수 있어요.';
  $('#annual-cards').replaceChildren();
  for (const year of reading?.years || []) {
    const card = document.createElement('article');
    card.className = 'annual-card';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `${year.tenGod}${year.current ? ' · 현재 구간' : ''}`;
    const title = document.createElement('h3');
    title.textContent = `${year.year}년 ${year.pillar.hangul}(${year.pillar.hanja})`;
    const period = document.createElement('p');
    period.className = 'muted small';
    period.textContent = `${formatBoundary(year.start)}부터 ${formatBoundary(year.end)} 직전까지`;
    const topic = document.createElement('h4');
    topic.textContent = year.reading.title;
    const text = document.createElement('p');
    text.className = 'body-copy';
    text.textContent = year.reading.text;
    const action = document.createElement('p');
    action.className = 'info-note';
    action.textContent = year.reading.action;
    card.append(badge, title, period, topic, text, action);
    const detail = document.createElement('button');
    detail.type = 'button';
    detail.className = 'button button-outline';
    detail.textContent = year.year < 1901 ? '상세는 1901년부터 제공해요' : `${year.year}년 상세 보기`;
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
