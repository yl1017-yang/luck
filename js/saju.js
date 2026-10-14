import './common.js';
import { pillars, sajuExplanations } from './data.js';
import { renderCards } from './render.js';

const $ = (selector) => document.querySelector(selector);

$('#pillars').innerHTML = pillars.map((pillar) => `<div class="pillar"><h3 class="pillar-title">${pillar.title}</h3><span class="pillar-letter">${pillar.top}</span><span class="pillar-letter">${pillar.bottom}</span><p class="pillar-reading">${pillar.reading} · ${pillar.meaning}</p></div>`).join('');
renderCards('#saju-explanations', sajuExplanations);
