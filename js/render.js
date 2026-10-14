export function renderCards(selector, items) {
  document.querySelector(selector).innerHTML = items.map((item, index) => `<article class="card"><span class="explanation-number">0${index + 1} / INSIGHT</span><h3>${item.title}</h3><p>${item.text}</p></article>`).join('');
}
