import {
  MONTHLY_NARRATIVE_VERSION, MONTH_PERSONALITY, MONTH_NARRATIVES, MONTH_ANNUAL_CONTEXT,
} from './content/monthly-narratives.js';
import { tenGodForStems } from './saju-calculator.js';

// A segment's confirmed day master and annual/monthly stem relations select
// continuous prose. Names, random values and date hashes never select copy.
export function interpretMonthlyNarrative(basis) {
  if (!basis || typeof basis.annualPillar !== 'string' || typeof basis.monthlyPillar !== 'string'
    || tenGodForStems(basis.dayMaster, basis.annualPillar[0]) !== basis.annualTenGod
    || tenGodForStems(basis.dayMaster, basis.monthlyPillar[0]) !== basis.monthlyTenGod) {
    throw new RangeError('월운 풀이의 계산 근거를 확인해 주세요.');
  }
  const monthly = MONTH_NARRATIVES[basis.monthlyTenGod];
  const personality = MONTH_PERSONALITY[basis.dayMaster];
  const annual = MONTH_ANNUAL_CONTEXT[basis.annualTenGod];
  if (!monthly || !personality || !annual) throw new RangeError('월운 풀이 원고를 확인해 주세요.');
  return {
    version: MONTHLY_NARRATIVE_VERSION,
    title: monthly.title,
    paragraphs: [monthly.paragraphs[0], personality, ...monthly.paragraphs.slice(1), annual],
    contentIds: [
      `month.personal.${basis.dayMaster}`,
      ...monthly.paragraphs.map((_, index) => `month.narrative.${basis.monthlyTenGod}.${index}`),
      `month.annual.${basis.annualTenGod}`,
    ],
    basis: { ...basis },
  };
}
