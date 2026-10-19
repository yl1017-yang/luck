import { onBirthResult } from './common.js';
import { interpretPersonality } from './personality-interpreter.js';

const $ = (selector) => document.querySelector(selector);

onBirthResult((result) => {
  let reading = null;
  let error = '';
  try {
    const value = interpretPersonality(result);
    if (value?.status === 'unavailable') error = value.message;
    else reading = value;
  } catch {
    error = '성향 풀이를 계산하지 못했어요. 출생 정보를 다시 확인해 주세요.';
  }
  $('#personality-status').textContent = reading ? `${reading.masterName} · ${reading.partial ? '부분 원국' : '사주 기반 성향'}` : '정보 입력 대기';
  $('#personality-title').textContent = reading?.title || '나를 알아가는 시간';
  $('#personality-intro').replaceChildren();
  for (const copy of reading?.overview || ['출생 정보를 입력하면 당신의 기질과 강점, 일과 관계의 모습을 자세히 확인할 수 있어요.']) {
    const paragraph = document.createElement('p');
    paragraph.textContent = copy;
    $('#personality-intro').append(paragraph);
  }
  if (reading) {
    const basis = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '사주 구성 보기';
    basis.append(summary);
    for (const copy of reading.basis) {
      const paragraph = document.createElement('p');
      paragraph.textContent = copy;
      basis.append(paragraph);
    }
    $('#personality-intro').append(basis);
  }
  $('#personality-tags').replaceChildren();
  for (const tag of reading?.tags || []) {
    const span = document.createElement('span');
    span.textContent = tag;
    $('#personality-tags').append(span);
  }
  $('#personality-details').replaceChildren();
  for (const item of reading?.details || []) {
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
    $('#personality-details').append(card);
  }
  $('#personality-error').textContent = error;
  $('#personality-error').hidden = !error;
});
