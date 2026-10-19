import { LIFE_MASTER_VOICES, LIFE_RELATION_VOICES, LIFE_BALANCE_VOICES, LIFE_CROSS_VOICES, LIFE_RELATION_GROUPS } from './content/lifetime-narratives.js';
import { LIFE_PROFILE_DEPTH } from './content/lifetime-depth.js';
import { NATAL_PERSONAL_VERSION, NATAL_DAY_VOICES, NATAL_STRESS_VOICES, NATAL_RELATION_VOICES } from './content/natal-personal.js';

// Display adapter over validated natal interpretation. It never fills missing
// calculation features or overrides the catalog's unavailable-content states.
export function interpretNatalPersonal(reading) {
  if (!reading || reading.status !== 'available') return null;
  const facts = reading.facts;
  const D = facts.dayMaster.hanja;
  const P = facts.dayPillar.hanja;
  const outer = facts.context.tenGod;
  const inner = facts.pillars.day.hiddenStems[0].tenGod;
  const master = LIFE_MASTER_VOICES[D];
  const depth = LIFE_PROFILE_DEPTH[D];
  const summary = [master.core, ...depth.overview];
  if (facts.pillars.month) summary.push(LIFE_CROSS_VOICES[LIFE_RELATION_GROUPS[outer]][LIFE_RELATION_GROUPS[inner]]);
  const sections = {
    overview: { title: master.title, paragraphs: summary },
    dayMaster: { title: '당신의 기본 기질과 강점', paragraphs: [master.temperament, ...depth.temperament] },
    dayPillar: { title: '가까이에서 드러나는 당신의 모습', paragraphs: [NATAL_DAY_VOICES[P], LIFE_RELATION_VOICES[inner].private] },
    temperament: { title: '당신이 스트레스를 받는 순간', paragraphs: [NATAL_STRESS_VOICES[D], LIFE_RELATION_VOICES[outer].outward] },
    workResources: { title: '당신에게 맞는 일과 돈을 관리하는 방식', paragraphs: [master.work, ...depth.work,
      LIFE_RELATION_VOICES[outer].work, master.money, ...depth.money, LIFE_RELATION_VOICES[outer].money] },
    relationships: { title: '당신의 애정 표현과 잘 맞는 관계', paragraphs: [master.relationship, ...depth.relationship] },
    dailyBalance: { title: '당신에게 맞는 생활과 회복 방식', paragraphs: [master.rhythm, ...depth.rhythm, LIFE_BALANCE_VOICES[inner]] },
  };
  if (facts.season) {
    const season = facts.season;
    const seasons = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
    sections.season = { title: '당신이 태어난 절기와 계절', paragraphs: [
      `당신의 출생 월주는 ${facts.pillars.month.pillar.hangul}(${facts.pillars.month.pillar.hanja})입니다. 절기 기준으로 ${seasons[season.key]}에 해당하며, ${season.termName}에 시작하는 ${season.monthBranch.hangul}(${season.monthBranch.hanja})월에 속합니다.`,
      '이 계절 정보는 당신의 출생 원국을 설명하는 배경입니다. 현재의 계절이나 몸의 상태를 뜻하지 않으며, 이 값만으로 성격의 강약을 정하지 않습니다.',
    ] };
  }
  for (const section of reading.sections) {
    if (section.key.startsWith('tenGod.')) sections[section.key] = {
      title: section.title.replace('실제 위치와 생활 질문', '당신에게 나타나는 행동 방식'),
      paragraphs: [NATAL_RELATION_VOICES[section.basis.tenGod]],
    };
  }
  return {
    version: NATAL_PERSONAL_VERSION,
    // No personal copy is substituted for an unavailable source section.
    sections: Object.fromEntries(reading.sections
      .filter(s => ['available', 'partial-content'].includes(s.status) && sections[s.key])
      .map(s => [s.key, { ...sections[s.key], sourceStatus: s.status }])),
  };
}
