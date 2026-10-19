import { calculateNatalFeatures } from './natal-features.js';
import { LIFE_MASTER_VOICES, LIFE_RELATION_VOICES, LIFE_BALANCE_VOICES, LIFE_CROSS_VOICES, LIFE_RELATION_GROUPS } from './content/lifetime-narratives.js';
import { LIFE_PROFILE_DEPTH } from './content/lifetime-depth.js';
import { NATAL_DAY_VOICES, NATAL_STRESS_VOICES, NATAL_RELATION_VOICES } from './content/natal-personal.js';

export function interpretPersonality(result) {
  const facts = calculateNatalFeatures(result);
  if (!facts) return null;
  if (facts.status !== 'available') return { status: 'unavailable', message: '일간과 일주를 확정하지 못했어요. 출생 정보를 확인해 주세요.' };
  const D = facts.dayMaster.hanja;
  const P = facts.dayPillar.hanja;
  const outer = facts.context.tenGod;
  const inner = facts.pillars.day.hiddenStems[0].tenGod;
  const master = LIFE_MASTER_VOICES[D];
  const depth = LIFE_PROFILE_DEPTH[D];
  const overview = [master.core, ...depth.overview];
  if (facts.pillars.month) overview.push(LIFE_CROSS_VOICES[LIFE_RELATION_GROUPS[outer]][LIFE_RELATION_GROUPS[inner]]);
  const details = [
    { title: '당신의 기질과 잘하는 것', paragraphs: [master.temperament, ...depth.temperament, NATAL_DAY_VOICES[P]] },
    { title: '일할 때의 성격과 맞는 환경', paragraphs: [master.work, ...depth.work, LIFE_RELATION_VOICES[outer].work] },
    { title: '애정 표현과 가까운 사람 앞의 모습', paragraphs: [master.relationship, ...depth.relationship, LIFE_RELATION_VOICES[inner].private] },
    { title: '스트레스를 받는 이유와 반복되는 약점', paragraphs: [NATAL_STRESS_VOICES[D], LIFE_RELATION_VOICES[outer].outward, NATAL_RELATION_VOICES[outer]] },
    { title: '당신에게 맞는 휴식과 생활 방식', paragraphs: [master.rhythm, ...depth.rhythm, LIFE_BALANCE_VOICES[inner]] },
    { title: '돈과 선택을 대하는 당신의 성향', paragraphs: [master.money, ...depth.money, LIFE_RELATION_VOICES[outer].money] },
  ];
  const basis = Object.entries(facts.pillars).filter(([, value]) => value).map(([key, value]) =>
    `${{ year: '연주', month: '월주', day: '일주', hour: '시주' }[key]} ${value.pillar.hangul}(${value.pillar.hanja})`);
  basis.push(`일간 ${facts.dayMaster.hangul}(${D}) · ${facts.context.source === 'month-stem' ? '월간' : '월주 미확정으로 일지 본기 사용'} ${facts.context.tenGod} · 일지 본기 ${inner}`);
  return {
    version: '1.0.0', status: 'available', partial: facts.partial,
    title: master.title, tags: [...master.tags], masterName: facts.dayMaster.hangul,
    overview, details, basis,
    selection: { dayMaster: D, dayPillar: P, contextSource: facts.context.source, outer, inner },
  };
}
