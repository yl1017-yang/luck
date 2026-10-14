import './common.js';
import { hints } from './data.js';

const $ = (selector) => document.querySelector(selector);

$('#daily-hints').innerHTML = hints.map((hint) => `<div class="hint-row"><span class="hint-icon" aria-hidden="true">${hint.icon}</span><div><h3>${hint.title}</h3><p>${hint.text}</p></div><span class="hint-badge">${hint.badge}</span></div>`).join('');

$('#action-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const completed = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(completed));
  button.textContent = completed ? '작은 실천 완료 ✓' : '오늘의 실천 체크 ↗';
});
