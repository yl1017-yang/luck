import { calculateNatalFeatures } from './natal-features.js';
import {
  LIFE_NARRATIVE_VERSION, LIFE_MASTER_VOICES, LIFE_RELATION_VOICES,
  LIFE_MIDDLE_VOICES, LIFE_BALANCE_VOICES, LIFE_RELATION_GROUPS, LIFE_CROSS_VOICES,
} from './content/lifetime-narratives.js';
import { LIFE_PROFILE_DEPTH } from './content/lifetime-depth.js';
import { LIFE_STAGE_DEPTH } from './content/lifetime-stage-depth.js';

const LABELS = { year: '연주', month: '월주', day: '일주', hour: '시주' };

// Explicit natal features select editorial copy. Names and query dates do not.
// Life-stage lenses are not calculated luck cycles or verified personal history.
export function interpretLifeNarrative(result) {
  const facts = calculateNatalFeatures(result);
  if (!facts || facts.status !== 'available') return null;
  const contentIds = new Set();
  const select = (table, key, field, prefix) => {
    const copy = field ? table[key]?.[field] : table[key];
    if (typeof copy !== 'string' || !copy.trim()) throw new RangeError('평생 풀이 원고를 확인해 주세요.');
    contentIds.add(`${prefix}.${key}${field ? `.${field}` : ''}`);
    return copy;
  };
  const expand = (table, key, field, prefix) => {
    const copies = table[key]?.[field];
    if (!Array.isArray(copies) || copies.length === 0
      || copies.some(copy => typeof copy !== 'string' || !copy.trim())) {
      throw new RangeError('평생 상세 원고를 확인해 주세요.');
    }
    return copies.map((copy, index) => {
      contentIds.add(`${prefix}.${key}.${field}.${index}`);
      return copy;
    });
  };
  const D = facts.dayMaster.hanja;
  const outer = facts.context.tenGod;
  const inner = facts.pillars.day.hiddenStems[0].tenGod;
  const master = (field) => select(LIFE_MASTER_VOICES, D, field, 'life.master');
  const voice = (god, field) => select(LIFE_RELATION_VOICES, god, field, 'life.relation');
  const depth = (field) => expand(LIFE_PROFILE_DEPTH, D, field, 'life.depth.master');
  const stageDepth = (god, stage) => expand(LIFE_STAGE_DEPTH, god, stage, 'life.depth.stage');
  const basis = (key) => {
    const value = facts.pillars[key];
    if (!value) return null;
    const relation = value.stemRelation.tenGod;
    const main = value.hiddenStems[0];
    return `${LABELS[key]} ${value.pillar.hangul}(${value.pillar.hanja}), ${relation ? `천간 ${relation}, ` : ''}지지 본기 ${main.stem.hangul}(${main.stem.hanja})·${main.tenGod}`;
  };
  const dayBasis = basis('day');
  const contextBasis = facts.context.source === 'month-stem'
    ? `일간 ${facts.dayMaster.hangul}(${D})과 월간 ${facts.context.stem.hangul}(${facts.context.stem.hanja})의 관계: ${outer}`
    : `월주 미확정으로 일지 본기 ${facts.context.stem.hangul}(${facts.context.stem.hanja})·${outer} 사용. 사회생활과 가까운 생활의 차이는 비교하지 않음`;
  const unavailable = (title) => ({ title, paragraphs: ['출생 정보에서 이 부분의 기둥을 확정하지 못해 풀이를 보류했어요.'],
    basis: '출생 시간 미상 또는 절입 경계로 해당 기둥 미확정', unavailable: true });

  const earlyPillar = facts.pillars.year;
  const early = earlyPillar ? {
    title: '초년운 — 나의 기준이 만들어지는 때',
    paragraphs: [
      ...[...new Set([earlyPillar.stemRelation.tenGod, earlyPillar.hiddenStems[0].tenGod])]
        .map((god) => voice(god, 'early')),
      ...stageDepth(earlyPillar.stemRelation.tenGod, 'early'),
    ],
    basis: `${basis('year')}. 연주의 두 관계를 초년의 배움과 반응 방식에 연결한 해석`,
  } : unavailable('초년운 — 나의 기준이 만들어지는 때');
  const middle = {
    title: '중년운 — 쌓아 온 것을 내 삶으로 만드는 때',
    paragraphs: [select(LIFE_MIDDLE_VOICES, inner, null, 'life.middle'), ...stageDepth(inner, 'middle')],
    basis: `${dayBasis}. 일지 본기 십성을 중년의 선택 과제에 연결한 해석`,
  };
  const latePillar = facts.pillars.hour;
  const later = latePillar ? {
    title: '말년운 — 내게 맞는 생활을 남기는 때',
    paragraphs: [
      ...[...new Set([latePillar.stemRelation.tenGod, latePillar.hiddenStems[0].tenGod])]
        .map((god) => voice(god, 'later')),
      ...stageDepth(latePillar.stemRelation.tenGod, 'later'),
    ],
    basis: `${basis('hour')}. 시주의 두 관계를 삶의 후반에 이어갈 활동에 연결한 해석`,
  } : unavailable('말년운 — 내게 맞는 생활을 남기는 때');

  const overview = [master('core'), ...depth('overview')];
  if (facts.pillars.month) {
    overview.push(select(LIFE_CROSS_VOICES[LIFE_RELATION_GROUPS[outer]],
      LIFE_RELATION_GROUPS[inner], null, `life.cross.${LIFE_RELATION_GROUPS[outer]}`));
  }
  const areas = [
    { title: '성격 — 잘하는 모습과 마음이 지치는 순간',
      paragraphs: [master('temperament'), ...depth('temperament'), voice(outer, 'outward')], basis: contextBasis },
    { title: '직업운 — 실력을 쓰기 좋은 자리',
      paragraphs: [master('work'), ...depth('work'), voice(outer, 'work')],
      action: voice(outer, 'action'), basis: contextBasis },
    { title: '재물운 — 돈을 쓰고 관리하는 방식',
      paragraphs: [master('money'), ...depth('money'), voice(outer, 'money')], basis: contextBasis },
    { title: '애정·가족·대인관계 — 가까울수록 반복되는 모습',
      paragraphs: [master('relationship'), ...depth('relationship'), voice(inner, 'private')], basis: dayBasis },
    { title: '생활 균형 — 무리하지 않고 오래 가는 방식',
      paragraphs: [master('rhythm'), ...depth('rhythm'), select(LIFE_BALANCE_VOICES, inner, null, 'life.balance')], basis: dayBasis },
  ];
  return {
    version: LIFE_NARRATIVE_VERSION,
    title: LIFE_MASTER_VOICES[D].title,
    tags: [...LIFE_MASTER_VOICES[D].tags],
    overview,
    basis: `${['year', 'month', 'day', 'hour'].map(basis).filter(Boolean).join(' / ')}. ${contextBasis}. 일간을 기본으로 월간과 일지 본기의 생활 맥락을 연결했으며, 십성의 세력이나 실제 성격을 측정한 결과가 아님`,
    stages: [early, middle, later],
    areas,
    contentIds: [...contentIds],
    note: `${facts.partial ? '미확정 기둥을 제외한 부분 풀이예요. ' : ''}사주에 따른 전통적 해석이며 실제 성격이나 살아온 이력을 확인한 결과는 아니에요. 초년·중년·말년은 연주·일주·시주에 연결한 관점이고, 나이별 대운이나 사건 시점은 계산하지 않아요. 같은 계산 특징에는 같은 문구가 쓰여요.`,
  };
}
