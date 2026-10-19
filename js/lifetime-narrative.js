import { calculateNatalFeatures } from './natal-features.js';
import {
  LIFE_RELATION_VOICES, LIFE_MIDDLE_VOICES,
} from './content/lifetime-narratives.js';
import { LIFE_STAGE_DEPTH } from './content/lifetime-stage-depth.js';
import { LIFETIME_PATH_VERSION, LIFETIME_PATHS, LIFETIME_DEVELOPMENT, LIFETIME_STAGE_THEMES } from './content/lifetime-paths.js';

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
  const path = LIFETIME_PATHS[D];
  const voice = (god, field) => select(LIFE_RELATION_VOICES, god, field, 'life.relation');
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

  const overview = [select(LIFETIME_PATHS, D, 'intro', 'life.path'),
    ...expand(LIFETIME_DEVELOPMENT, outer, 'overview', 'life.development')];
  if (facts.pillars.month) {
    const earlyTheme = earlyPillar ? LIFETIME_STAGE_THEMES[earlyPillar.stemRelation.tenGod] : null;
    const middleTheme = LIFETIME_STAGE_THEMES[inner];
    const lateTheme = latePillar ? LIFETIME_STAGE_THEMES[latePillar.stemRelation.tenGod] : null;
    overview.push(`${earlyTheme ? `삶의 앞부분에서는 ${earlyTheme}을 마련하는 일이, ` : ''}중년에는 ${middleTheme}을 실제 일과 생활에 연결하는 일이 중심 과제입니다. ${lateTheme ? `후반에는 ${lateTheme}을 지금의 생활에 맞게 남기는 방향이 중요해집니다.` : '출생 시간이 없어 후반의 구체적인 흐름은 보류합니다.'} 각 시기의 경험을 다음 기반으로 이어 가는 것이 당신의 인생 흐름을 읽는 핵심입니다.`);
    contentIds.add(`life.stage-link.${earlyPillar?.stemRelation.tenGod || 'unknown'}.${inner}.${latePillar?.stemRelation.tenGod || 'unknown'}`);
  }
  const areas = [
    { title: '직업운 — 경력을 쌓고 역할을 넓혀 가는 흐름',
      paragraphs: expand(LIFETIME_DEVELOPMENT, outer, 'work', 'life.development'), basis: contextBasis },
    { title: '재물운 — 생활의 기반을 만들고 유지하는 흐름',
      paragraphs: expand(LIFETIME_DEVELOPMENT, outer, 'wealth', 'life.development'), basis: contextBasis },
    { title: '가정·인연운 — 시기마다 달라지는 관계와 역할',
      paragraphs: expand(LIFETIME_DEVELOPMENT, inner, 'family', 'life.development'), basis: dayBasis },
    { title: '전환과 후반의 생활 — 이어갈 것과 내려놓을 것',
      paragraphs: expand(LIFETIME_DEVELOPMENT, inner, 'stability', 'life.development'), basis: dayBasis },
  ];
  return {
    version: LIFETIME_PATH_VERSION,
    title: path.title,
    tags: [...path.tags],
    overview,
    basis: `${['year', 'month', 'day', 'hour'].map(basis).filter(Boolean).join(' / ')}. ${contextBasis}. 일간을 기본으로 월간과 일지 본기의 생활 맥락을 연결했으며, 십성의 세력이나 실제 성격을 측정한 결과가 아님`,
    stages: [early, middle, later],
    areas,
    contentIds: [...contentIds],
    note: `${facts.partial ? '미확정 기둥을 제외한 부분 풀이예요. ' : ''}사주에 따른 전통적 해석이며 실제 성격이나 살아온 이력을 확인한 결과는 아니에요. 초년·중년·말년은 연주·일주·시주에 연결한 관점이고, 나이별 대운이나 사건 시점은 계산하지 않아요. 같은 계산 특징에는 같은 문구가 쓰여요.`,
  };
}
