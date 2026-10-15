import { onBirthResult } from './common.js';
import { interpretBirth } from './interpreter.js';
import { renderCards } from './render.js';

const $ = (selector) => document.querySelector(selector);

onBirthResult((result) => {
  const reading = interpretBirth(result);
  $('#personality-status').textContent = reading ? `${reading.master.name} · 일간 기반` : '정보 입력 대기';
  $('#personality-title').textContent = reading?.personality.title || '나를 알아가는 작은 힌트';
  $('#personality-intro').textContent = reading?.personality.intro || '출생 정보를 입력하면 일간에 맞춘 성향 설명을 볼 수 있어요.';
  $('#personality-tags').replaceChildren();
  for (const tag of reading?.personality.tags || []) {
    const span = document.createElement('span');
    span.textContent = tag;
    $('#personality-tags').append(span);
  }
  renderCards('#personality-details', reading?.personality.details || []);
  $('#personality-note').textContent = reading?.note || '과학적인 성격 진단이 아닌, 나를 돌아보기 위한 콘텐츠예요.';
});
