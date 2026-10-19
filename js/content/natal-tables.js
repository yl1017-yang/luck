// Versioned conventions fixed by doc/NATAL_DETAIL_SPEC.md (not strength weights).
export const NATAL_TABLE_VERSION = '1.0.0';
export const HIDDEN_STEMS_TABLE_ID = 'hidden-stems-lunar-1.7.7-v1';
export const NATAL_TABLE_SOURCES = Object.freeze({
  hiddenStems: 'https://github.com/6tail/lunar-javascript/blob/v1.7.7/lunar.js',
  api: 'https://6tail.cn/calendar/lunar.bazi.html',
});

export const HIDDEN_STEMS = Object.freeze(Object.fromEntries(Object.entries({
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
}).map(([branch, stems]) => [branch, Object.freeze(stems)])));

// Array positions are this service's display convention, not days of seasonal rule.
export const HIDDEN_STEM_ROLES = Object.freeze(['main', 'middle', 'residual']);
export const MONTH_SEASONS = Object.freeze(Object.fromEntries([
  ['寅', 'spring', '입춘'], ['卯', 'spring', '경칩'], ['辰', 'spring', '청명'],
  ['巳', 'summer', '입하'], ['午', 'summer', '망종'], ['未', 'summer', '소서'],
  ['申', 'autumn', '입추'], ['酉', 'autumn', '백로'], ['戌', 'autumn', '한로'],
  ['亥', 'winter', '입동'], ['子', 'winter', '대설'], ['丑', 'winter', '소한'],
].map(([branch, key, termName]) => [branch, Object.freeze({ key, termName })])));
