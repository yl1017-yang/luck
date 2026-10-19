// Reproducible editorial samples from actual test birth dates, never user data.
import { writeFileSync } from 'node:fs';
import { calculateSaju } from '../js/saju-calculator.js';
import { calculateNatalFeatures } from '../js/natal-features.js';
import { interpretNatalDetails } from '../js/natal-interpreter.js';

const base = { birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
const dates = new Map();
for (let i = 0; i < 60; i += 1) {
  const birthDate = new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10);
  const result = calculateSaju({ ...base, birthDate }, '2026-10-19');
  dates.set(result.pillars.day.hanja, birthDate);
}
const cases = [
  { title: '갑자 일주', profile: { ...base, birthDate: dates.get('甲子') } },
  { title: '갑오 일주', profile: { ...base, birthDate: dates.get('甲午') } },
  { title: '입춘일 시간 미상', profile: { ...base, birthDate: '2024-02-04', unknownTime: true, birthTime: null } },
  { title: '음력 윤달 입력', profile: { ...base, birthDate: '2025-06-01', calendar: 'lunar', leapMonth: true } },
];
const lines = ['# 원국 상세 대표 출력 검수', '', '2026-10-19 · 원국 콘텐츠 1.0.0. 실제 계산 결과로 생성한 테스트 표본이다. 전문 감수나 화면 검수 기록은 아니다.', '',
  '재현: `node tests/preview-natal.mjs`. 같은 일간의 다른 일주·부분 사주·음력 윤달을 포함한다.', ''];
for (const item of cases) {
  const input = calculateSaju(item.profile, '2026-10-19');
  const features = calculateNatalFeatures(input);
  const reading = interpretNatalDetails(features);
  lines.push(`## ${item.title}`, '',
    `입력: ${item.profile.calendar} ${item.profile.birthDate}${item.profile.leapMonth ? ' (윤달)' : ''} ${item.profile.birthTime ?? '시간 미상'}.`, '',
    `확정 일간/일주: ${features.dayMaster.hanja} / ${features.dayPillar.hanja}. 계절: ${features.season?.key ?? '미확정'}. 맥락: ${features.context.tenGod} (${features.context.source}). 제외: ${features.excludedPillars.join(', ') || '없음'}.`, '',
    `상태: ${reading.contentStatus}. ${reading.note}`, '');
  for (const section of reading.sections.filter((s) => ['dayPillar', 'overview', 'temperament', 'workResources', 'relationships', 'dailyBalance'].includes(s.key))) {
    lines.push(`### ${section.title}`, '', `근거: ${JSON.stringify(section.basis)}`, '');
    for (const block of section.blocks) {
      lines.push(`**${block.title}** (${block.id}; ${block.role})`, '', block.summary, '', ...block.paragraphs.flatMap((p) => [p, '']),
        `점검 질문: ${block.question}`, '');
      if (block.action) lines.push(`실천: ${block.action}`, '');
    }
  }
}
writeFileSync(new URL('../doc/NATAL_CONTENT_SAMPLES.md', import.meta.url), lines.join('\n') + '\n');
console.log('Wrote 4 natal editorial samples to doc/NATAL_CONTENT_SAMPLES.md');
