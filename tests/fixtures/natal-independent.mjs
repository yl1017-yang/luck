// Manually transcribed facts, checked 2026-10-19. No imports from the app or engine.
export const referenceSources = {
  hidden: ['https://sajumania.com/ebook/to01-06/to01-06-01-61.htm', 'https://www.donglishuzhai.net/chapter/12808.html'],
  relations: ['https://www.donglishuzhai.net/chapter/12812.html', 'https://zh.wikisource.org/zh-hant/三命通會/卷五'],
  cycle: 'https://www.hko.gov.hk/en/gts/time/stemsandbranches.htm',
  terms: 'https://www.hko.gov.hk/en/gts/time/24solarterms.htm',
};

// Poem order, NOT a ranking of main/middle/residual strength.
export const classicalHiddenOrder = {
  子: ['癸'], 丑: ['癸', '辛', '己'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['乙', '戊', '癸'], 巳: ['庚', '丙', '戊'], 午: ['丁', '己'], 未: ['乙', '己', '丁'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['辛', '丁', '戊'], 亥: ['壬', '甲'],
};

// Explicit HKO table order, converted to hanja from its romanized stem/branch names.
export const hkoCycle = [
  '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥',
  '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未', '甲申', '乙酉', '丙戌', '丁亥',
  '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥',
  '庚子', '辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥',
  '壬子', '癸丑', '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
];

// A/B wood examples explicitly stated by 論日爲主. No prediction clauses reused.
export const classicalExamples = [
  ['甲', '庚', '편관'], ['甲', '辛', '정관'], ['乙', '庚', '정관'], ['乙', '辛', '편관'],
  ['甲', '己', '정재'], ['乙', '戊', '정재'], ['甲', '癸', '정인'], ['乙', '壬', '정인'],
  ['甲', '壬', '편인'], ['乙', '癸', '편인'], ['甲', '丙', '식신'], ['甲', '丁', '상관'],
  ['乙', '丁', '식신'], ['乙', '丙', '상관'],
];

// A separately tabulated reference derived from five-element/polarity conventions.
// This is NOT 100 examples quoted from the classical source, nor a second engine.
// Columns: 甲 乙 丙 丁 戊 己 庚 辛 壬 癸. 七殺 is normalized to 편관.
export const referenceTenGodRows = {
  甲: ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'],
  乙: ['겁재', '비견', '상관', '식신', '정재', '편재', '정관', '편관', '정인', '편인'],
  丙: ['편인', '정인', '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관'],
  丁: ['정인', '편인', '겁재', '비견', '상관', '식신', '정재', '편재', '정관', '편관'],
  戊: ['편관', '정관', '편인', '정인', '비견', '겁재', '식신', '상관', '편재', '정재'],
  己: ['정관', '편관', '정인', '편인', '겁재', '비견', '상관', '식신', '정재', '편재'],
  庚: ['편재', '정재', '편관', '정관', '편인', '정인', '비견', '겁재', '식신', '상관'],
  辛: ['정재', '편재', '정관', '편관', '정인', '편인', '겁재', '비견', '상관', '식신'],
  壬: ['식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인', '비견', '겁재'],
  癸: ['상관', '식신', '정재', '편재', '정관', '편관', '정인', '편인', '겁재', '비견'],
};

// Named season commencements and their ecliptic longitudes from HKO, not weather seasons.
export const seasonStarts = [
  { key: 'spring', term: '입춘', longitude: 315, branches: ['寅', '卯', '辰'] },
  { key: 'summer', term: '입하', longitude: 45, branches: ['巳', '午', '未'] },
  { key: 'autumn', term: '입추', longitude: 135, branches: ['申', '酉', '戌'] },
  { key: 'winter', term: '입동', longitude: 225, branches: ['亥', '子', '丑'] },
];
