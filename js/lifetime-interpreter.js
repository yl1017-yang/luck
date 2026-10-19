import { DAY_MASTERS } from './content/interpretations.js';
import { LIFE_ELEMENTS, ANNUAL_READINGS, LIFETIME_VERSION } from './content/lifetime.js';
import { annualPillar, springBoundary, tenGodForStems } from './saju-calculator.js';
import { koreaDate } from './profile.js';
import { interpretLifeNarrative } from './lifetime-narrative.js';
import { interpretAnnualNarrative } from './annual-narrative.js';

export function interpretLifetime(result, now = new Date()) {
  if (!result) return null;
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new RangeError('올바른 조회 시각을 지정해 주세요.');
  const dateKey = koreaDate(now);
  const calendarYear = Number(dateKey.slice(0, 4));
  if (calendarYear < 1901 || calendarYear > 2050) throw new RangeError('연도별 흐름은 1901~2050년에 조회할 수 있어요.');
  const boundary = springBoundary(calendarYear);
  const delta = now.getTime() - Date.parse(boundary.instant);
  const activeYear = delta >= 0 ? calendarYear : calendarYear - 1;
  const nearBoundary = Math.abs(delta) <= 60000;
  const master = DAY_MASTERS[result.features.dayMaster.hanja];
  const life = LIFE_ELEMENTS[result.features.dayMaster.element];
  const years = [];
  const endYear = Math.min(activeYear + 1, 2050);
  for (let year = activeYear; year <= endYear; year += 1) {
    const annual = annualPillar(year);
    const tenGod = tenGodForStems(result.features.dayMaster.hanja, annual.pillar.stem.hanja);
    years.push({ ...annual, tenGod, reading: ANNUAL_READINGS[tenGod],
      narrative: interpretAnnualNarrative(result.features.dayMaster.hanja, annual),
      current: year === activeYear && !nearBoundary });
  }
  return {
    version: LIFETIME_VERSION,
    narrative: interpretLifeNarrative(result),
    dateKey,
    master,
    title: life.title,
    overview: `${master.intro} ${life.overview}`,
    details: [
      { title: '오래 발휘할 수 있는 강점', text: master.strength },
      { title: '일과 배움의 방향', text: life.work },
      { title: '관계를 이어가는 방식', text: life.relationship },
      { title: '시간과 자원을 돌보는 습관', text: life.resources },
      { title: '전환점을 만났을 때', text: life.turning },
      { title: '나를 지탱하는 생활 습관', text: `${life.habit} ${master.balance}` },
    ],
    years,
    nearBoundary,
    note: `${result.features.partial ? '출생 시간 미상 또는 절입 경계의 미확정 기둥이 있어 일간 중심으로 설명해요. ' : ''}인생 전반의 경향은 일간 이미지 기반 자기 성찰용 해석이에요. 수명·결혼·재산이나 특정 나이의 사건을 예측하지 않아요.`,
    annualNote: `${nearBoundary ? '조회 시각이 입춘 1분 이내라 현재 연도 구분을 확정하기 어려워요. ' : ''}연도 구간은 한국 표준시 입춘부터 다음 입춘 직전까지예요. 내 일간과 그해 천간의 십성 관계를 생활 주제로 풀었으며, 대운 시작 나이·진행 방향이나 지지 합충은 계산하지 않아요.`,
  };
}
