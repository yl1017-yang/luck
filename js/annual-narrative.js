import { ANNUAL_NARRATIVE_VERSION, ANNUAL_PERSONALITY, ANNUAL_NARRATIVES } from './content/annual-narratives.js';
import { tenGodForStems } from './saju-calculator.js';

export function interpretAnnualNarrative(dayMaster, annual) {
  if (!annual || !Number.isInteger(annual.year) || !annual.pillar?.stem?.hanja) {
    throw new RangeError('연도별 풀이의 계산 결과를 확인해 주세요.');
  }
  const tenGod = tenGodForStems(dayMaster, annual.pillar.stem.hanja);
  const entry = ANNUAL_NARRATIVES[tenGod];
  const personality = ANNUAL_PERSONALITY[dayMaster];
  if (!entry || !personality) throw new RangeError('연도별 풀이 원고를 확인해 주세요.');
  return {
    version: ANNUAL_NARRATIVE_VERSION,
    title: entry.title,
    paragraphs: [`${annual.year}년의 ${entry.paragraphs[0]}`, personality, ...entry.paragraphs.slice(1)],
    contentIds: [`year.personal.${dayMaster}`, ...entry.paragraphs.map((_, i) => `year.narrative.${tenGod}.${i}`)],
    basis: { dayMaster, year: annual.year, annualPillar: annual.pillar.hanja, annualTenGod: tenGod },
  };
}
