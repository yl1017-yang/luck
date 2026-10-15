import { DAY_MASTERS, ELEMENTS, GLOSSARY, DAILY_THEMES, CONTENT_VERSION } from './content/interpretations.js';
import { DAILY_DETAILS } from './content/daily-details.js';
import { dayPillarForDate } from './saju-calculator.js';
import { formatCalendarDate } from './calendar.js';
import { koreaDate } from './profile.js';

function stableHash(text) {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function modulo(value, length) {
  return ((value % length) + length) % length;
}

function coverageNote(result) {
  const notes = [];
  if (result.profile.unknownTime) notes.push('출생 시간을 몰라 시주는 포함하지 않았어요.');
  if (result.uncertainty.pillars.length) notes.push('절입 경계에서 확정할 수 없는 기둥은 구성 설명에서 제외했어요.');
  notes.push('성향은 일간의 전통적 이미지를 빌린 자기 성찰용 설명이에요.');
  return notes.join(' ');
}

export function interpretBirth(result) {
  if (!result) return null;
  const master = DAY_MASTERS[result.features.dayMaster.hanja];
  if (!master) throw new RangeError('일간에 맞는 해석 정보를 찾을 수 없어요.');
  const entries = Object.entries(ELEMENTS);
  const counts = result.features.elements;
  const composition = entries.map(([key, element]) => `${element.name} ${counts[key]}개`).join(' · ');
  const missing = entries.filter(([key]) => counts[key] === 0).map(([, element]) => element.name);
  const total = result.features.elementCount;
  const compositionText = `${result.features.partial ? '확인 가능한 기둥의' : '네 기둥의'} 천간·지지 ${total}글자를 단순 집계했어요. ${composition}. ${missing.length ? `집계에 나타나지 않는 요소: ${missing.join('·')}. 성격의 부족함을 뜻하지 않아요. ` : ''}이 숫자만으로 사주의 강약이나 길흉을 판단하지 않아요.`;

  return {
    version: CONTENT_VERSION,
    master,
    note: coverageNote(result),
    composition,
    compositionText,
    saju: [
      { title: `나의 일간: ${master.name}`, text: `${master.intro} ${ELEMENTS[result.features.dayMaster.element].tip}` },
      { title: result.features.partial ? '확인 가능한 오행 구성' : '나의 오행 구성', text: compositionText },
      ...GLOSSARY,
    ],
    personality: {
      title: master.title,
      intro: master.intro,
      tags: master.tags,
      details: [
        { title: '나의 행동 방식', text: master.behavior },
        { title: '발휘해 볼 강점', text: master.strength },
        { title: '관계를 맺는 방식', text: master.relationship },
        { title: '스트레스를 느낄 때', text: master.stress },
        { title: '균형을 잡는 작은 습관', text: master.balance },
      ],
    },
  };
}

export function interpretToday(result, dateKey = koreaDate()) {
  if (!result) return null;
  const dailyPillar = dayPillarForDate(dateKey);
  const birth = interpretBirth(result);
  // Use only certain birth data. Display name and unconfirmed pillars never seed content.
  const basis = `${formatCalendarDate(result.dates.solar)}|${result.pillars.day.hanja}`;
  const seed = stableHash(basis);
  const ordinal = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);
  const theme = DAILY_THEMES[modulo(ordinal + seed, DAILY_THEMES.length)];
  const actionIndex = modulo(Math.floor(ordinal / DAILY_THEMES.length) + seed, theme.actions.length);
  const action = theme.actions[actionIndex];
  const detail = actionIndex === 0 ? theme : DAILY_DETAILS[theme.id][actionIndex - 1];

  return {
    version: CONTENT_VERSION,
    dateKey,
    dailyPillar,
    themeId: theme.id,
    mode: theme.mode,
    variantId: `${theme.id}-${actionIndex}`,
    keyword: theme.keyword,
    title: theme.title,
    intro: detail.intro,
    note: theme.note,
    caution: theme.caution,
    master: birth.master,
    personalityTitle: birth.personality.title,
    action: { ...action, id: `${theme.id}-${actionIndex}` },
    // The entire bundle comes from one theme; incompatible themes are never merged.
    hints: [
      { icon: '♡', title: '관계', text: detail.relationship, badge: theme.keyword },
      { icon: '↗', title: '일 · 공부', text: detail.work, badge: theme.keyword },
      { icon: '♧', title: '생활', text: detail.life, badge: theme.keyword },
      { icon: '!', title: '오늘의 주의점', text: theme.caution, badge: '가볍게 점검' },
    ],
    explanation: `${dateKey} · 오늘의 일진 ${dailyPillar.hangul}(${dailyPillar.hanja}). 날짜와 출생일·일주에 맞춰 고른 생활 제안이며 실제 사건을 예측하는 점수는 아니에요.`,
    coverage: birth.note,
  };
}
