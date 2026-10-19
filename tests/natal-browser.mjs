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

async function navigate(page = 'saju.html') {
  await call('Page.navigate', { url: `${base}/${page}` });
  await waitFor("document.querySelector('[name=birthYear]')?.options.length > 1");
}
async function edit(date, unknown = false, name = '') {
  const [year, month, day] = date.split('-').map(Number);
  await evaluate(`(() => {
    document.querySelector('#edit-profile').click();
    const form = document.querySelector('#profile-form');
    form.elements.calendar.value = 'solar'; form.elements.leapMonth.checked = false;
    form.elements.unknownTime.checked = ${unknown}; form.dispatchEvent(new Event('change'));
    for (const [key, value] of ${JSON.stringify([['birthYear', year], ['birthMonth', month], ['birthDay', day]])}) {
      form.elements[key].value = String(value); form.dispatchEvent(new Event('change'));
    }
    form.elements.birthTime.value = ${unknown ? '""' : '"12:00"'};
    form.elements.displayName.value = ${JSON.stringify(name)};
    form.requestSubmit();
  })()`);
  await waitFor("!document.querySelector('#profile-dialog').open");
}
async function pressEnter() {
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}
const directRender = `Promise.all([import('./js/common.js'), import('./js/natal-features.js'), import('./js/natal-interpreter.js'), import('./js/natal-view.js'), import('./js/content/natal-details.js')]).then(([common, calc, interpreter, view, content]) => {
  let result; const unsubscribe = common.onBirthResult(value => { result = value; }); unsubscribe();
  const features = calc.calculateNatalFeatures(result); const catalog = structuredClone(content.NATAL_CATALOG);
  return { result, features, catalog, interpreter, view, calc };
})`;

try {
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Page.bringToFront');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 950, deviceScaleFactor: 1, mobile: false });
  await navigate();
  assert.equal(await evaluate("document.querySelector('#natal-content').hidden"), true);
  assert.equal(await evaluate("document.querySelector('#natal-navigation').hidden"), true);
  assert.equal(await evaluate("document.querySelectorAll('#saju-explanations .card').length"), 4);
  assert.equal(await evaluate("document.querySelector('.natal-glossary').open"), false);
  await edit('2000-01-07', false, '<b>테스트</b>');
  await waitFor("!document.querySelector('#natal-content').hidden");
  assert.equal(await evaluate("document.querySelectorAll('#pillars .pillar').length"), 4);
  assert.equal(await evaluate("document.querySelectorAll('.natal-group').length"), 5);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.natal-group > h3')].map(n => n.textContent)"), ['원국 요약', '일간·일주', '기둥별 십성·지장간', '출생 계절·오행', '분야별 원국 해석']);
  assert.ok((await evaluate("document.querySelector('[data-section=\"dayPillar\"]').textContent")).includes('배움으로 방향을 다듬기'));
  assert.ok((await evaluate("document.querySelector('#page-title').textContent")).includes('<b>테스트</b>'));
  assert.equal(await evaluate("document.querySelectorAll('#page-title b').length"), 0);
  assert.ok((await evaluate("document.querySelector('[data-section=\"pillars.day\"]').textContent")).includes('일간·나의 기준'));
  const expected = await evaluate(`${directRender}.then(({features, interpreter}) => {
    const reading = interpreter.interpretNatalDetails(features);
    return reading.sections.filter(s => !s.key.startsWith('pillars.')).map(s => ({ key:s.key, summary:s.summary, paragraphs:s.blocks.flatMap(b=>b.paragraphs) }));
  })`);
  for (const part of expected) {
    const actual = await evaluate(`document.querySelector('[data-section="${part.key}"]').textContent`);
    assert.ok(actual.includes(part.summary), part.key);
    for (const paragraph of part.paragraphs) assert.ok(actual.includes(paragraph), part.key);
  }
  // Native details open through actual keyboard input, retaining focus.
  await evaluate("document.querySelector('[data-section=\"workResources\"] .natal-copy > summary').focus()");
  await pressEnter();
  assert.equal(await evaluate("document.querySelector('[data-section=\"workResources\"] .natal-copy').open"), true);
  await evaluate("document.querySelector('[data-section=\"workResources\"] .natal-basis > summary').focus()");
  await pressEnter();
  assert.equal(await evaluate("document.querySelector('[data-section=\"workResources\"] .natal-basis').open"), true);
  const focused = await evaluate("document.activeElement.textContent");
  const stable = await evaluate("window.natalQaNode = document.querySelector('#natal-content').firstChild; true");
  assert.ok(stable);
  await evaluate("document.dispatchEvent(new Event('luck:clock-tick'))");
  assert.equal(await evaluate("window.natalQaNode === document.querySelector('#natal-content').firstChild"), true);
  assert.equal(await evaluate('document.activeElement.textContent'), focused);
  await evaluate("document.querySelector('.natal-glossary > summary').focus()");
  await pressEnter();
  assert.equal(await evaluate("document.querySelector('.natal-glossary').open"), true);
  await evaluate("document.querySelector('#natal-navigation a[href=\"#natal-fields\"]').focus()");
  await pressEnter();
  assert.equal(await evaluate('location.hash'), '#natal-fields');
  assert.equal(await evaluate('document.activeElement.id'), 'natal-fields');
  const before = await evaluate("document.querySelector('[data-section=\"dayPillar\"]').textContent");
  await edit('2000-02-06');
  const after = await evaluate("document.querySelector('[data-section=\"dayPillar\"]').textContent");
  assert.notEqual(before, after);
  assert.ok(after.includes('목표를 개선할 질문 찾기'));
  assert.equal(after.includes('배움으로 방향을 다듬기'), false);
  const content = await evaluate("document.querySelector('#natal-content').textContent");
  await navigate('personality.html');
  await evaluate("document.querySelector('a[href=\"./saju.html\"]').click()");
  await waitFor("document.querySelector('#natal-content')?.hidden === false");
  assert.equal(await evaluate("document.querySelector('#natal-content').textContent"), content);
  await call('Page.reload');
  await waitFor("document.querySelector('#natal-content')?.hidden === false");
  assert.equal(await evaluate("document.querySelector('#natal-content').textContent"), content);
  // Navigation to the distinct annual/monthly view keeps the same birth profile.
  await evaluate("document.querySelector('a[href=\"./lifetime.html#annual-detail\"]').click()");
  await waitFor("document.querySelector('#fortune-content')?.hidden === false");
  assert.ok((await evaluate('location.hash')).includes('annual-detail'));
  await navigate();
  await edit('2024-02-04', true);
  assert.ok((await evaluate("document.querySelector('#natal-status').textContent")).includes('연주·월주·시주'));
  assert.ok((await evaluate("document.querySelector('[data-section=\"season\"]').textContent")).includes('월주를 확정하지 못해'));
  assert.ok((await evaluate("document.querySelector('[data-section=\"overview\"] .natal-basis').textContent")).includes('일지 본기를 사용'));
  assert.equal(await evaluate("document.querySelectorAll('[data-section=\"pillars.month\"] .natal-hidden-stems li').length"), 0);
  assert.ok((await evaluate("document.querySelector('[data-section=\"surfaceElements\"]').textContent")).includes('2글자'));
  await edit('1990-05-15', true);
  assert.ok((await evaluate("document.querySelector('[data-section=\"pillars.hour\"]').textContent")).includes('출생 시간을 몰라'));
  assert.ok((await evaluate("document.querySelector('[data-section=\"surfaceElements\"]').textContent")).includes('6글자'));
  await edit('1990-05-15');
  for (const width of [320, 360, 768, 1280]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 700 });
    await evaluate("document.querySelectorAll('#natal-content details').forEach(d => { d.open = true; })");
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, `natal overflow ${width}`);
    for (const [id, name] of [['natal-summary', 'natal-summary'], ['natal-pillars', 'natal-pillars'], ['natal-fields', 'natal-fields']]) {
      await evaluate(`document.getElementById('${id}').scrollIntoView()`);
      await capture(`${name}-${width}`);
    }
  }
  // Diagnostic catalog injection tests the renderer's content fallback, not user input.
  await evaluate(`${directRender}.then(({features,catalog,interpreter,view}) => {
    delete catalog.dayPillars[features.dayPillar.hanja];
    delete catalog.contexts[features.context.tenGod].workResources;
    view.renderNatalDetails(interpreter.interpretNatalDetails(features,catalog));
  })`);
  assert.ok((await evaluate("document.querySelector('[data-section=\"dayPillar\"]').textContent")).includes('이 해석을 준비하지 못했어요'));
  assert.ok((await evaluate("document.querySelector('[data-section=\"workResources\"]').textContent")).includes('일부 보조 해석'));
  await evaluate(`${directRender}.then(({result,calc,interpreter,view}) => {
    const copy=structuredClone(result); copy.features.dayMaster=null;
    view.renderNatalDetails(interpreter.interpretNatalDetails(calc.calculateNatalFeatures(copy)));
  })`);
  assert.equal(await evaluate("document.querySelector('#natal-content').hidden"), true);
  await evaluate("import('./js/common.js').then(common => { const unsub=common.onBirthResult(result => { result.features.elements.wood += 1; }); unsub(); document.dispatchEvent(new Event('luck:birth-result')); })");
  assert.equal(await evaluate("document.querySelectorAll('#pillars .pillar').length"), 0);
  assert.equal(await evaluate("document.querySelector('#natal-content').textContent"), '');
  assert.ok((await evaluate("document.querySelector('#natal-status').textContent")).includes('상세 계산'));
  await evaluate("Storage.prototype.setItem = () => { throw new DOMException('Blocked','SecurityError'); }");
  await edit('2000-01-07');
  assert.equal(await evaluate("document.querySelector('#natal-content').hidden"), false);
  assert.ok((await evaluate("document.querySelector('#profile-description').textContent")).includes('임시 보관 불가'));
  assert.deepEqual(errors, []);
  console.log('PASS: natal UI, actual copy/basis, input/restore, missing features/content, no stale results, keyboard details, clock stability, links, storage and responsive widths');
} finally {
  socket.close();
  await fetch(`${debug}/json/close/${page.id}`).catch(() => {});
}

