import { calculateFortunePeriods } from './fortune-periods.js';
import { interpretDetailedFortune } from './fortune-interpreter.js';
import { FORTUNE_VIEW_KEY, koreaClock, validYear, validSelection, defaultSelection, formatFortuneRange } from './fortune-view-state.js';

const AREAS = { overview: '총론', wealth: '재물운', work: '직장·사업운', homeHealth: '가정·건강운', relationships: '이성·대인관계' };
const $ = (selector) => document.querySelector(selector);
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};

function basisDetails(basis) {
  const node = element('details', null, 'fortune-basis');
  node.append(element('summary', '해석 기준 보기'));
  node.append(element('p', `일간 ${basis.dayMaster} · ${basis.cycleYear} 세운 ${basis.annualPillar} / ${basis.annualTenGod}${basis.monthlyPillar ? ` · 월주 ${basis.monthlyPillar} / ${basis.monthlyTenGod}` : ''}`, 'muted'));
  return node;
}

// A controller per page; storage failure never prevents an in-memory selection.
export function createFortuneView() {
  let result = null;
  let selection = null;
  let pinned = false;
  let restored;
  let signature = '';
  let optionsMinimum;
  try { restored = JSON.parse(sessionStorage.getItem(FORTUNE_VIEW_KEY)); } catch { restored = null; }
  const yearSelect = $('#fortune-year');
  const status = $('#fortune-status');

  function save() {
    if (!selection || selection.cycleYear == null) return;
    try { sessionStorage.setItem(FORTUNE_VIEW_KEY, JSON.stringify(selection)); } catch { /* Memory remains usable. */ }
  }

  function clear(message) {
    status.textContent = message;
    $('#fortune-content').hidden = true;
    $('#fortune-areas').replaceChildren();
    $('#fortune-month-content').replaceChildren();
    signature = '';
  }

  function render(now = new Date()) {
    yearSelect.disabled = !result;
    if (!result) { clear('출생 정보를 입력하면 분야별 운세와 12개월 월운을 확인할 수 있어요.'); return; }
    const minimum = Math.max(1901, result.dates.solar.year);
    if (optionsMinimum !== minimum) {
      yearSelect.replaceChildren(element('option', '연도를 선택해 주세요'));
      yearSelect.firstChild.value = '';
      for (let year = minimum; year <= 2050; year += 1) {
        const option = element('option', `${year}년`);
        option.value = year;
        yearSelect.append(option);
      }
      optionsMinimum = minimum;
    }
    const requested = restored;
    restored = null;
    let year = requested && validYear(requested.year, result) ? requested.year
      : pinned && validYear(selection?.year, result) ? selection.year : koreaClock(now).year;
    if (!validYear(year, result)) {
      selection = null;
      pinned = false;
      yearSelect.value = '';
      clear(`현재 연도는 지원 범위 밖이에요. ${minimum}~2050년 중 조회할 연도를 선택해 주세요.`);
      return;
    }
    try {
      let periods = calculateFortunePeriods(result, year, now);
      if (requested) {
        if (validSelection(requested, periods)) { selection = { year: requested.year, cycleYear: requested.cycleYear, month: requested.month }; pinned = true; }
        else {
          pinned = false;
          year = koreaClock(now).year;
          if (!validYear(year, result)) { yearSelect.value = ''; clear(`저장된 선택을 사용할 수 없어요. ${minimum}~2050년 중 선택해 주세요.`); return; }
          periods = calculateFortunePeriods(result, year, now);
        }
      }
      if (!pinned || !validSelection(selection, periods)) {
        const previous = selection;
        selection = defaultSelection(periods, now);
        if (pinned && previous?.year === year) selection.month = previous.month;
      }
      yearSelect.value = year;
      const reading = interpretDetailedFortune(result, periods);
      if (reading.status === 'unavailable-day-master') { clear('일간을 확정할 수 없어 상세 해석을 제공하지 못해요. 출생 정보를 확인해 주세요.'); return; }
      $('#fortune-content').hidden = false;
      status.textContent = `${year}년 양력 기준 · ${formatFortuneRange(reading.range)}${reading.partial ? ' · 부분 사주: 미확정 기둥 제외' : ''}${reading.current.nearBoundary ? ' · 절입 ±60초: 현재 구간을 확정하지 않아요.' : ''}`;
      $('#fortune-note').textContent = reading.note;
      const nextSignature = JSON.stringify([selection, reading.current, reading.contentStatus]);
      if (signature === nextSignature) return;
      signature = nextSignature;
      const focused = document.activeElement;
      const focusedMonth = focused?.closest('#fortune-months') ? focused.dataset.month : null;
      const focusedCycle = focused?.closest('#fortune-cycles') ? focused.dataset.cycle : null;
      renderCycles(reading, now);
      renderAnnual(reading);
      renderMonths(reading);
      if (focusedMonth) $(`#fortune-months [data-month="${focusedMonth}"]`)?.focus({ preventScroll: true });
      if (focusedCycle) $(`#fortune-cycles [data-cycle="${focusedCycle}"]`)?.focus({ preventScroll: true });
      save();
    } catch {
      clear('기간을 계산하지 못했어요. 다른 연도를 선택하거나 출생 정보를 다시 확인해 주세요.');
    }
  }

  function renderCycles(reading, now) {
    const container = $('#fortune-cycles');
    container.replaceChildren();
    const nearSpring = reading.annualReadings.some((annual) => Math.abs(Date.parse(annual.sourceStart) - now.getTime()) <= 60000);
    for (const annual of reading.annualReadings) {
      const button = element('button', null, 'button button-outline fortune-cycle');
      button.type = 'button';
      button.dataset.cycle = annual.cycleYear;
      button.setAttribute('aria-pressed', String(selection.cycleYear === annual.cycleYear));
      const current = !nearSpring && Date.parse(annual.start) <= now.getTime() && now.getTime() < Date.parse(annual.end);
      button.append(element('strong', `${annual.cycleYear} 세운 · ${annual.pillar.hangul}(${annual.pillar.hanja})${current ? ' · 현재 구간' : ''}`), element('span', formatFortuneRange(annual), 'small'));
      button.addEventListener('click', () => { selection.cycleYear = annual.cycleYear; pinned = true; render(); $('#fortune-cycles [aria-pressed="true"]')?.focus(); });
      container.append(button);
    }
  }

  function renderAnnual(reading) {
    const container = $('#fortune-areas');
    container.replaceChildren();
    const annual = reading.annualReadings.find((item) => item.cycleYear === selection.cycleYear);
    if (!annual) { container.append(element('p', '입춘 경계의 두 세운 후보 중 읽을 구간을 직접 선택해 주세요.', 'info-note')); return; }
    for (const [key, label] of Object.entries(AREAS)) {
      const area = annual.areas[key];
      const card = element('article', null, 'card fortune-area');
      card.append(element('h3', label));
      if (area.status !== 'available') card.append(element('p', area.message), element('p', formatFortuneRange(annual), 'muted small'));
      else {
        card.append(element('h4', area.title), element('p', area.summary, 'info-note'));
        for (const paragraph of area.paragraphs) card.append(element('p', paragraph, 'body-copy'));
        for (const [field, title] of [['opportunity', '살펴볼 기회'], ['caution', '주의할 점'], ['action', '실천 제안']]) {
          card.append(element('h4', title), element('p', area[field], 'body-copy'));
        }
        card.append(basisDetails(annual.basis));
      }
      container.append(card);
    }
  }

  function renderMonths(reading) {
    const navigation = $('#fortune-months');
    navigation.replaceChildren();
    for (const month of reading.monthlyReadings) {
      const button = element('button', `${month.month}월${month.status === 'before-birth' ? ' · 출생 전' : ''}`, 'button button-outline');
      button.type = 'button';
      button.dataset.month = month.month;
      button.setAttribute('aria-pressed', String(month.month === selection.month));
      button.setAttribute('aria-controls', 'fortune-month-content');
      button.addEventListener('click', () => { selection.month = month.month; pinned = true; render(); $(`#fortune-months [data-month="${month.month}"]`).focus(); });
      navigation.append(button);
    }
    const container = $('#fortune-month-content');
    container.replaceChildren(element('h4', `${selection.year}년 ${selection.month}월`));
    const month = reading.monthlyReadings.find((item) => item.month === selection.month);
    if (!month || month.status === 'calculation-error') { container.append(element('p', '이 월의 기간을 계산하지 못했어요.')); return; }
    if (month.status === 'before-birth') { container.append(element('p', '출생 전 기간으로 개인별 해석을 제공하지 않아요.', 'info-note')); return; }
    for (const segment of month.segments) {
      const card = element('article', null, 'annual-card fortune-month-segment');
      const active = reading.current.activeSegmentId === segment.id;
      const candidate = reading.current.candidateSegmentIds.includes(segment.id);
      card.append(element('h5', `${segment.pillar.hangul}(${segment.pillar.hanja}) · ${segment.tenGod}${active ? ' · 현재 구간' : candidate ? ' · 경계 후보' : ''}`));
      card.append(element('p', formatFortuneRange(segment), 'muted small'));
      if (segment.continuedFromPreviousMonth) card.append(element('p', '전월에서 이어지는 절기 구간이에요.', 'muted small'));
      if (segment.status !== 'available') card.append(element('p', segment.message || '이 해석을 준비하지 못했어요.'));
      else {
        card.append(element('p', segment.reading.title, 'badge'), element('p', segment.reading.summary.text, 'info-note'), element('p', segment.bridge.text, 'body-copy'));
        for (const [field, label] of Object.entries({ wealth: AREAS.wealth, work: AREAS.work, homeHealth: AREAS.homeHealth, relationships: AREAS.relationships, caution: '주의할 점', action: '실천 제안' })) {
          card.append(element('h6', label), element('p', segment.reading[field].text, 'body-copy'));
        }
        card.append(basisDetails(segment.basis));
      }
      container.append(card);
    }
  }

  yearSelect.addEventListener('change', () => {
    const year = Number(yearSelect.value);
    if (!validYear(year, result)) { clear('지원 범위 안의 연도를 선택해 주세요.'); return; }
    try { selection = defaultSelection(calculateFortunePeriods(result, year)); pinned = true; render(); } catch { clear('기간을 계산하지 못했어요.'); }
  });
  document.addEventListener('luck:clock-tick', () => render());
  return {
    update(value) { result = value; signature = ''; render(); },
    open(year) {
      if (!validYear(year, result)) return;
      selection = { year, cycleYear: year, month: 1 };
      pinned = true;
      render();
      $('#annual-detail').scrollIntoView({ block: 'start' });
      yearSelect.focus({ preventScroll: true });
    },
  };
}
