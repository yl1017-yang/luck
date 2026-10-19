import { describePillar } from './saju-calculator.js';
import { interpretNatalPersonal } from './natal-personal.js';

const $ = (selector) => document.querySelector(selector);
const LABELS = { year: '연주', month: '월주', day: '일주', hour: '시주' };
const ELEMENTS = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };
const ROLES = { main: '본기', middle: '중기', residual: '여기' };
const SEASONS = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const node = (tag, text, className) => {
  const result = document.createElement(tag);
  if (text != null) result.textContent = text;
  if (className) result.className = className;
  return result;
};
const letter = (stem) => `${stem.hangul}(${stem.hanja}) · ${ELEMENTS[stem.element]}`;
const pillarName = (pillar) => `${pillar.hangul}(${pillar.hanja})`;

function missingMessage(section) {
  if (section.status !== 'unavailable-feature') return section.message || '이 해석을 준비하지 못했어요.';
  if (section.reason === 'unknown-time') return '출생 시간을 몰라 시주와 시주의 십성·지장간은 제외했어요.';
  if (section.key === 'season') return '월주를 확정하지 못해 출생 계절과 절기 월 설명은 제외했어요.';
  return '절입 경계 또는 미확정 기둥에 의존하는 설명은 제외했어요. 후보를 임의로 선택하지 않아요.';
}

function basisView(section) {
  const details = node('details', null, 'natal-basis');
  details.append(node('summary', '계산 근거 보기'));
  const basis = section.basis;
  const lines = [];
  if (basis.dayMaster) {
    const day = describePillar(basis.dayPillar);
    lines.push(`비교 기준: 출생 일간 ${letter(day.stem)}, 일주 ${pillarName(day)}.`);
  }
  if (basis.dayBranchMain) {
    const main = basis.dayBranchMain;
    lines.push(`일지 본기: ${letter(main.stem)} · 일간 대비 ${main.tenGod}.`);
  }
  if (basis.context) {
    const context = basis.context;
    lines.push(`분야별 맥락: ${LABELS[context.pillarKey]} ${context.source === 'month-stem' ? '천간' : '일지 본기'} ${letter(context.stem)} · ${context.tenGod}. ${context.source === 'month-stem' ? '확정된 월간을 우선해 읽어요.' : '월주가 미확정이라 확정된 일지 본기를 사용해요.'} 우세 십성이나 강약 순위가 아니에요.`);
  }
  if (basis.season) lines.push(`출생 월주 ${pillarName(basis.month)} · ${SEASONS[basis.season.key]} · ${basis.season.termName}에 시작하는 절기 월. 월지 대표 오행 ${ELEMENTS[basis.season.monthElement]}.`);
  if (basis.positions) {
    for (const position of basis.positions) {
      lines.push(`${LABELS[position.pillarKey]} ${position.source === 'stem' ? '천간' : `지장간 ${ROLES[position.role]}`} · ${letter(position.stem)} · 일간 대비 ${basis.tenGod}.`);
    }
  }
  if (basis.tableId) lines.push('지장간은 채택한 고정표 순서예요. 본기·중기·여기는 표시 규약이며 날짜별 사령이나 세력 비율을 뜻하지 않아요.');
  if (basis.surfaceElements) lines.push(`확정된 천간·지지 ${basis.surfaceElements.total}글자를 각각 한 번 집계했어요. 지장간 개수·계절 가중치·강약 점수가 아니에요.`);
  for (const line of lines) details.append(node('p', line, 'body-copy'));
  return details;
}

function readingCard(section, personal = null) {
  const card = node('article', null, 'card natal-card');
  card.dataset.section = section.key;
  card.append(node('h4', personal?.title || section.title));
  if (['unavailable-feature', 'unavailable-content'].includes(section.status)) {
    card.append(node('p', missingMessage(section), 'info-note'), basisView(section));
    return card;
  }
  if (!personal) card.append(node('p', section.summary, 'info-note'));
  if (section.status === 'partial-content') card.append(node('p', missingMessage(section), 'muted'));
  if (personal) {
    const body = node('div', null, 'natal-copy');
    for (const paragraph of personal.paragraphs) body.append(node('p', paragraph, 'body-copy'));
    card.append(body);
  } else if (section.blocks.length) {
    const body = node('div', null, 'natal-copy');
    for (const block of section.blocks) {
      for (const paragraph of block.paragraphs) body.append(node('p', paragraph, 'body-copy'));
    }
    card.append(body);
  }
  card.append(basisView(section));
  return card;
}

function pillarCard(section) {
  if (section.status !== 'available') return readingCard(section);
  const value = section.basis.pillar;
  const card = node('article', null, 'card natal-card');
  card.dataset.section = section.key;
  card.append(node('h4', `${section.title} · ${pillarName(value.pillar)}`));
  card.append(node('p', `천간 ${letter(value.pillar.stem)} · ${value.stemRelation.kind === 'self' ? '일간·나의 기준 (비교 대상 아님)' : value.stemRelation.tenGod}`, 'info-note'));
  const list = node('ul', null, 'natal-hidden-stems');
  for (const item of value.hiddenStems) list.append(node('li', `${ROLES[item.role]} · ${letter(item.stem)} · ${item.tenGod}`));
  card.append(node('h5', `지지 ${value.pillar.branch.hangul}(${value.pillar.branch.hanja})의 지장간`), list, basisView(section));
  return card;
}

export function renderNatalError(message = '상세 계산을 완료하지 못했어요. 출생 정보를 다시 확인하거나 수정해 주세요.') {
  $('#natal-status').textContent = message;
  $('#natal-status').hidden = false;
  $('#natal-content').replaceChildren();
  $('#natal-content').hidden = true;
  $('#natal-navigation').hidden = true;
}

// Only confirmed facts and authored text are displayed; no innerHTML or private URL state.
export function renderNatalDetails(reading) {
  if (!reading) { renderNatalError('출생 정보를 입력하면 일간·일주와 십성·지장간, 분야별 상세 풀이를 확인할 수 있어요.'); return; }
  if (reading.status !== 'available') { renderNatalError('일간 또는 일주를 확정하지 못해 상세 풀이를 제공하지 않아요. 출생 정보를 확인해 주세요.'); return; }
  const excluded = reading.facts.excludedPillars.map((key) => LABELS[key]);
  $('#natal-status').textContent = `${excluded.length ? `제외한 기둥: ${excluded.join('·')}.` : ''}${reading.contentStatus === 'partial' ? ' 일부 해석 원고를 준비하지 못했어요. 해당 영역에 따로 안내해요.' : ''}`;
  $('#natal-status').hidden = !$('#natal-status').textContent;
  const content = $('#natal-content');
  const personal = interpretNatalPersonal(reading);
  content.replaceChildren();
  const groups = [
    ['natal-summary', '원국 요약', (s) => s.key === 'overview'],
    ['natal-identity', '일간·일주', (s) => ['dayMaster', 'dayPillar'].includes(s.key)],
    ['natal-pillars', '기둥별 십성·지장간', (s) => s.key.startsWith('pillars.') || s.key.startsWith('tenGod.')],
    ['natal-season', '출생 계절·오행', (s) => ['season', 'surfaceElements'].includes(s.key)],
    ['natal-fields', '분야별 원국 해석', (s) => ['temperament', 'workResources', 'relationships', 'dailyBalance'].includes(s.key)],
  ];
  for (const [id, title, match] of groups) {
    const group = node('section', null, 'natal-group');
    const heading = node('h3', title);
    heading.id = id;
    heading.tabIndex = -1;
    group.setAttribute('aria-labelledby', id);
    group.append(heading);
    if (id === 'natal-pillars') group.append(node('p', '아래 간지·십성·지장간은 계산 사실이에요. 같은 십성의 생활 주제는 실제 등장 위치를 모아 한 번 설명해요. 본기·중기·여기는 채택 표의 표시 순서이며 세력 비율이 아니에요.', 'muted body-copy'));
    if (id === 'natal-fields') group.append(node('p', '당신의 성격과 맞는 일, 돈과 관계를 다루는 방식을 설명합니다. 연도·월별 흐름은 평생운세에서 확인할 수 있어요.', 'muted body-copy'));
    for (const section of reading.sections.filter(match)) group.append(section.key.startsWith('pillars.') ? pillarCard(section) : readingCard(section, personal.sections[section.key]));
    content.append(group);
  }
  content.hidden = false;
  $('#natal-navigation').hidden = false;
}

