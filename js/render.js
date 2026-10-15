export function renderCards(selector, items) {
  const container = document.querySelector(selector);
  container.replaceChildren();
  items.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'card';
    const number = document.createElement('span');
    number.className = 'explanation-number';
    number.textContent = `${String(index + 1).padStart(2, '0')} / INSIGHT`;
    const title = document.createElement('h3');
    title.textContent = item.title;
    const text = document.createElement('p');
    text.textContent = item.text;
    card.append(number, title, text);
    container.append(card);
  });
}

export function renderHints(selector, items) {
  const container = document.querySelector(selector);
  container.replaceChildren();
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'hint-row';
    const icon = document.createElement('span');
    icon.className = 'hint-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = item.title;
    const text = document.createElement('p');
    text.textContent = item.text;
    const badge = document.createElement('span');
    badge.className = 'badge badge-mint hint-badge';
    badge.textContent = item.badge;
    copy.append(title, text);
    row.append(icon, copy, badge);
    container.append(row);
  }
}
