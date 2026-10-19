// Node 22+, an already running static server and a Chromium CDP endpoint required.
// No browser packages or site runtime dependencies are installed.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.LUCK_QA_BASE || 'http://127.0.0.1:8765';
const debug = process.env.LUCK_QA_CDP || 'http://127.0.0.1:9225';
const page = await (await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    clearTimeout(callback.timeout);
    if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
    else callback.resolve(message.result);
  }
});

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitFor(expression) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Not ready: ${expression}`);
}

async function capture(name) {
  if (!process.env.LUCK_QA_SCREENSHOTS) return;
  const directory = resolve(process.env.LUCK_QA_SCREENSHOTS);
  mkdirSync(directory, { recursive: true });
  const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(directory, name + '.png'), Buffer.from(screenshot.data, 'base64'));
}

const profile = { birthDate: '1990-05-15', birthTime: '12:00', calendar: 'solar', leapMonth: false, unknownTime: false };
async function chooseYear(year) {
  await evaluate(`document.querySelector('#fortune-year').value = '${year}'; document.querySelector('#fortune-year').dispatchEvent(new Event('change'))`);
}
async function navigate() {
  await call('Page.navigate', { url: `${base}/lifetime.html` });
  await waitFor("document.querySelector('#fortune-year')?.options.length > 1");
}
async function clock(instant) {
  await evaluate(`window.originalDate ||= Date; window.Date = class extends window.originalDate { constructor(...args) { super(...(args.length ? args : ['${instant}'])); } static now() { return new window.originalDate('${instant}').getTime(); } }; document.dispatchEvent(new Event('luck:clock-tick'))`);
}

try {
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Page.bringToFront');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 950, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: `${base}/lifetime.html` });
  await waitFor("document.querySelector('[name=birthYear]')?.options.length > 1");
  assert.equal(await evaluate("document.querySelector('#fortune-content').hidden"), true);
  await evaluate(`sessionStorage.setItem('luck.birthProfile.v1', ${JSON.stringify(JSON.stringify(profile))}); sessionStorage.setItem('luck.fortuneView.v1', '{broken')`);
  await navigate();
  await waitFor("document.querySelectorAll('#fortune-months button').length === 12");
  assert.equal(await evaluate("document.querySelector('#fortune-areas')"), null);
  assert.equal(await evaluate("document.querySelector('#fortune-cycles')"), null);
  assert.equal(await evaluate("document.querySelectorAll('#fortune-months button').length"), 12);
  assert.equal(await evaluate("document.querySelectorAll('#fortune-month-content h6').length"), 0);
  assert.ok(await evaluate("Array.from(document.querySelectorAll('.fortune-month-segment')).every(card => card.querySelectorAll(':scope > .body-copy').length === 7)"));
  assert.ok(await evaluate("document.querySelector('.fortune-month-segment > .body-copy').textContent.startsWith('이 시기의 당신은')"));
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.fortune-month-segment > .body-copy')).some(node => /살펴보|적어보|확인해 보세요/.test(node.textContent))"), false);
  const summaryYear = await evaluate("Number(document.querySelector('#annual-cards h3').textContent.slice(0, 4))");
  await evaluate("document.querySelector('#annual-cards button').click()");
  assert.equal(await evaluate("Number(document.querySelector('#fortune-year').value)"), summaryYear);
  await chooseYear(2024);
  await evaluate("document.querySelector('[data-month=\"2\"]').click()");
  const monthText = await evaluate("document.querySelector('#fortune-month-content').textContent");
  assert.ok(monthText.includes('2024-02-01') && monthText.includes('2024-03-01'));
  await clock('2027-03-01T00:00:00+09:00');
  assert.equal(await evaluate("document.querySelector('#fortune-year').value"), '2024');
  await navigate();
  assert.equal(await evaluate("document.querySelector('#fortune-year').value"), '2024');
  assert.equal(await evaluate("document.querySelector('#fortune-months [aria-pressed=true]').dataset.month"), '2');
  await evaluate("document.querySelector('[data-month=\"3\"]').focus()");
  assert.equal(await evaluate("document.activeElement.dataset.month"), '3');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await evaluate("document.querySelector('#fortune-months [aria-pressed=true]').dataset.month"), '3');
  assert.equal(await evaluate("document.activeElement.dataset.month"), '3');
  await chooseYear(1990);
  await evaluate("document.querySelector('[data-month=\"1\"]').click()");
  assert.ok((await evaluate("document.querySelector('#fortune-month-content').textContent")).includes('출생 전 기간'));
  await chooseYear(2050);
  await evaluate("document.querySelector('[data-month=\"12\"]').click()");
  assert.ok((await evaluate("document.querySelector('#fortune-month-content').textContent")).includes('2051-01-01'));
  // Edit the actual shared form: retain a valid year, reset an invalid year.
  await chooseYear(2024);
  await evaluate(`(() => {
    document.querySelector('#edit-profile').click();
    const form = document.querySelector('#profile-form');
    for (const [key, value] of [['birthYear', '2025'], ['birthMonth', '7'], ['birthDay', '25']]) {
      form.elements[key].value = value; form.dispatchEvent(new Event('change'));
    }
    form.elements.unknownTime.checked = true; form.dispatchEvent(new Event('change')); form.requestSubmit();
  })()`);
  await waitFor("!document.querySelector('#profile-dialog').open");
  assert.notEqual(await evaluate("document.querySelector('#fortune-year').value"), '2024');
  assert.ok((await evaluate("document.querySelector('#fortune-status').textContent")).includes('부분 사주'));
  await chooseYear(2025);
  await evaluate("document.querySelector('[data-month=\"7\"]').click()");
  assert.ok((await evaluate("document.querySelector('#fortune-month-content').textContent")).includes('2025-07-25'));
  await call('Page.navigate', { url: `${base}/saju.html` });
  await waitFor("document.querySelector('[name=birthYear]')?.options.length > 1");
  await evaluate("document.querySelector('a[href=\"./lifetime.html#annual-detail\"]').click()");
  await waitFor("document.querySelector('#fortune-year')?.value === '2025'");
  for (const width of [320, 360, 768, 1280]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 700 });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, `overflow ${width}`);
    await evaluate("document.querySelector('#annual-detail').scrollIntoView()");
    await capture(`detail-${width}`);
    await evaluate("document.querySelector('.fortune-monthly').scrollIntoView()");
    await capture(`monthly-${width}`);
  }
  // Automatic selection tracks year, month and spring while preserving uncertainty.
  await evaluate(`sessionStorage.setItem('luck.birthProfile.v1', ${JSON.stringify(JSON.stringify(profile))}); sessionStorage.setItem('luck.fortuneView.v1', JSON.stringify({ year: 2024, cycleYear: 1900, month: 99 }))`);
  await navigate();
  await clock('2026-01-01T00:00:00+09:00');
  assert.equal(await evaluate("document.querySelector('#fortune-months [aria-pressed=true]').dataset.month"), '1');
  const spring = await evaluate("import('./js/saju-calculator.js').then(module => module.springBoundary(2026).instant)");
  await clock(spring);
  assert.equal(await evaluate("[...document.querySelectorAll('#fortune-month-content h5')].filter(node => node.textContent.includes('현재 구간')).length"), 0);
  assert.ok((await evaluate("document.querySelector('#fortune-status').textContent")).includes('±60초'));
  // Inspect every monthly boundary in the actual rendered page, not just the engine.
  const boundaries = await evaluate(`Promise.all([import('./js/common.js'), import('./js/fortune-periods.js')]).then(([common, periods]) => {
    let result; const unsubscribe = common.onBirthResult(value => { result = value; }); unsubscribe();
    return periods.calculateFortunePeriods(result, 2026).months.map(month => month.segments[1].start);
  })`);
  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = Date.parse(boundaries[index]);
    await clock(new Date(boundary - 61000).toISOString());
    assert.equal(await evaluate("document.querySelector('#fortune-months [aria-pressed=true]').dataset.month"), String(index + 1));
    assert.equal(await evaluate("[...document.querySelectorAll('#fortune-month-content h5')].filter(node => node.textContent.includes('현재 구간')).length"), 1);
    await clock(new Date(boundary).toISOString());
    assert.equal(await evaluate("[...document.querySelectorAll('#fortune-month-content h5')].filter(node => node.textContent.includes('경계 후보')).length"), 2);
    assert.equal(await evaluate("[...document.querySelectorAll('#fortune-month-content h5')].filter(node => node.textContent.includes('현재 구간')).length"), 0);
    await clock(new Date(boundary + 61000).toISOString());
    assert.equal(await evaluate("[...document.querySelectorAll('#fortune-month-content h5')].filter(node => node.textContent.includes('현재 구간')).length"), 1);
  }
  await clock('2027-01-01T00:00:00+09:00');
  assert.equal(await evaluate("document.querySelector('#fortune-year').value"), '2027');
  assert.equal(await evaluate("document.querySelector('#fortune-months [aria-pressed=true]').dataset.month"), '1');
  await clock('2026-03-01T00:00:00+09:00');
  assert.equal(await evaluate("document.querySelector('#fortune-months [aria-pressed=true]').dataset.month"), '3');
  // Manual selection and focus survive the monthly boundary refresh.
  await evaluate("document.querySelector('[data-month=\"4\"]').click()");
  await clock(boundaries[3]);
  assert.equal(await evaluate("document.activeElement.dataset.month"), '4');
  assert.equal(await evaluate("document.querySelector('#fortune-months [aria-pressed=true]').dataset.month"), '4');
  await evaluate("sessionStorage.removeItem('luck.fortuneView.v1')");
  await navigate();
  await clock('2051-01-01T00:00:00+09:00');
  assert.equal(await evaluate("document.querySelector('#fortune-content').hidden"), true);
  await chooseYear(2050);
  assert.equal(await evaluate("document.querySelector('#fortune-content').hidden"), false);
  // Storage denied: selections and updates continue in memory.
  await evaluate("Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }");
  await chooseYear(2049);
  await evaluate("document.querySelector('[data-month=\"8\"]').click()");
  assert.equal(await evaluate("document.querySelector('#fortune-months [aria-pressed=true]').dataset.month"), '8');
  // Inject a calculation failure through the same event the shared input uses.
  await evaluate("import('./js/common.js').then(module => { const unsubscribe = module.onBirthResult(result => { result.dates.solar.month = 99; }); unsubscribe(); document.dispatchEvent(new Event('luck:birth-result')); })");
  assert.equal(await evaluate("document.querySelector('#fortune-content').hidden"), true);
  assert.ok((await evaluate("document.querySelector('#fortune-status').textContent")).includes('계산하지 못'));
  assert.deepEqual(errors, []);
  console.log('PASS: monthly UI without duplicate annual areas, periods, selection/restore, editing, keyboard, widths, clock boundaries, storage denial and failure states');
} finally {
  socket.close();
  await fetch(`${debug}/json/close/${page.id}`).catch(() => {});
}

