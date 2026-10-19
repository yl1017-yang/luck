import { onBirthResult } from './common.js';
import { GLOSSARY } from './content/interpretations.js';
import { renderCards } from './render.js';
import { calculateNatalFeatures } from './natal-features.js';
import { interpretNatalDetails } from './natal-interpreter.js';
import { renderNatalDetails, renderNatalError } from './natal-view.js';

const $ = (selector) => document.querySelector(selector);

const pillarLabels = { year: '연주', month: '월주', day: '일주', hour: '시주' };
renderCards('#saju-explanations', GLOSSARY);

onBirthResult((result) => {
  try {
    renderNatalDetails(interpretNatalDetails(calculateNatalFeatures(result)));
  } catch {
    $('#pillars').replaceChildren();
    $('#saju-status').textContent = '계산 확인 필요';
    $('#saju-note').textContent = '출생 정보를 다시 확인해 주세요. 이전 계산 결과는 표시하지 않아요.';
    renderNatalError();
    return;
  }
  $('#pillars').replaceChildren();
  $('#saju-status').textContent = result ? (result.features.partial ? '일부 확인 가능' : '계산 완료') : '정보 입력 대기';
  for (const [key, label] of Object.entries(pillarLabels)) {
    const pillar = result?.pillars[key];
    const box = document.createElement('div');
    box.className = 'pillar';
    const title = document.createElement('h3');
    title.className = 'pillar-title';
    title.textContent = label;
    box.append(title);
    for (const value of [pillar?.stem.hanja, pillar?.branch.hanja]) {
      const letter = document.createElement('span');
      letter.className = 'pillar-letter';
      letter.textContent = value || '—';
      box.append(letter);
    }
    const reading = document.createElement('p');
    reading.className = 'pillar-reading';
    reading.textContent = pillar?.hangul || (!result ? '정보 입력 전' : key === 'hour' ? '출생 시간 모름' : '절입 경계 확인 필요');
    box.append(reading);
    $('#pillars').append(box);
  }
  if (!result) {
    $('#saju-note').textContent = '출생 정보를 입력하면 사주 네 기둥을 확인할 수 있어요.';
    return;
  }
  const notes = [];
  if (result.profile.unknownTime) notes.push('출생 시간을 몰라 시주는 제외했어요.');
  if (result.uncertainty.reason === 'unknown-time-on-term-day') notes.push('절입 당일이라 출생 시간에 따라 연주 또는 월주가 달라질 수 있어 확정하지 않았어요.');
  if (result.uncertainty.reason === 'near-term-boundary') notes.push('절입 시각 1분 이내라 연주 또는 월주를 확정하기 어려워요.');
  notes.push(result.features.dayMaster ? `나의 일간은 ${result.features.dayMaster.hangul}(${result.features.dayMaster.hanja})이에요.` : '일간을 확정하지 못해 상세 풀이를 제공하지 않아요.');
  notes.push('입춘·절입 시각과 자정 기준으로 계산하며 태양시·과거 표준시 보정은 적용하지 않아요.');
  $('#saju-note').textContent = notes.join(' ');
});
