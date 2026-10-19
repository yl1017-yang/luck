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

try {
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 950, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: `${base}/index.html` });
  await waitFor("document.querySelector('[name=birthYear]')?.options.length > 1");
  assert.equal(await evaluate("document.querySelector('#action-toggle').disabled"), true);
  assert.equal(await evaluate("document.querySelectorAll('.element-column').length"), 0);
  await evaluate("sessionStorage.setItem('luck.birthProfile.v1', '{broken')");
  await call('Page.reload');
  await waitFor("document.querySelector('[name=birthYear]')?.options.length > 1");
  assert.equal(await evaluate("document.querySelector('#action-toggle').disabled"), true);
  await evaluate(`(() => {
    document.querySelector('#edit-profile').click();
    document.querySelector('#profile-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  assert.ok((await evaluate("document.querySelector('#form-error').textContent")).length > 0);
  await evaluate(`(() => {
    const form = document.querySelector('#profile-form');
    form.elements.displayName.dispatchEvent(new Event('input', { bubbles: true }));
    form.elements.birthYear.value = '2001';
    form.dispatchEvent(new Event('change'));
    form.elements.birthMonth.value = '2';
    form.dispatchEvent(new Event('change'));
    window.qaOption = form.elements.birthYear.options[1];
  })()`);
  assert.equal(await evaluate("document.querySelector('[name=birthDay]').options.length"), 29);
  await evaluate("document.querySelector('#profile-form').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("window.qaOption === document.querySelector('[name=birthYear]').options[1]"), true);
  assert.equal(await evaluate("document.querySelector('#form-error').textContent"), '');

  await evaluate(`(() => {
    document.querySelector('#edit-profile').click();
    const form = document.querySelector('#profile-form');
    for (const [name, value] of [['birthYear', '1990'], ['birthMonth', '5'], ['birthDay', '15']]) {
      form.elements[name].value = value;
      form.elements[name].dispatchEvent(new Event('change', { bubbles: true }));
    }
    form.elements.displayName.value = '<b>test</b>';
    form.elements.birthTime.value = '12:00';
    form.requestSubmit();
  })()`);
  await waitFor("!document.querySelector('#profile-dialog').open && !document.querySelector('#action-toggle').disabled");
  assert.equal(await evaluate("document.querySelectorAll('#daily-hints .hint-row').length"), 4);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.element-column > span')).reduce((sum, el) => sum + Number(el.textContent), 0)"), 8);
  assert.equal(await evaluate("document.querySelector('#page-title b') === null"), true);
  const originalTheme = await evaluate("document.querySelector('#daily-keyword').textContent");
  await evaluate("document.querySelector('#action-toggle').click()");
  assert.equal(await evaluate("document.querySelector('#action-toggle').getAttribute('aria-pressed')"), 'true');

  await evaluate("document.querySelector('a[href=\"./personality.html\"]').click()");
  await waitFor("document.querySelectorAll('#personality-details .card').length === 6");
  assert.ok(await evaluate("document.querySelector('#personality-intro > p').textContent.startsWith('당신은')"));
  assert.ok(await evaluate("Array.from(document.querySelectorAll('#personality-details > article')).every(card => card.querySelectorAll('p').length >= 3)"));
  assert.ok((await evaluate("document.querySelector('#page-title').textContent")).includes('<b>test</b>'));
  assert.equal(await evaluate("document.querySelectorAll('#personality-tags span').length"), 3);
  await evaluate("document.querySelector('a[href=\"./saju.html\"]').click()");
  await waitFor("document.querySelector('#saju-status')?.textContent === '계산 완료'");
  assert.equal(await evaluate("document.querySelectorAll('#saju-explanations .card').length"), 4);
  assert.equal(await evaluate("document.querySelector('#natal-content').hidden"), false);
  await evaluate("document.querySelector('a[href=\"./lifetime.html\"]').click()");
  await waitFor("document.querySelectorAll('#annual-cards .annual-card').length === 2");
  assert.ok(await evaluate("Array.from(document.querySelectorAll('#annual-cards > article')).every(card => card.querySelectorAll(':scope > .body-copy').length === 5)"));
  assert.ok(await evaluate("document.querySelector('#annual-cards .body-copy').textContent.includes('년의 당신은')"));
  assert.equal(await evaluate("document.querySelectorAll('#lifetime-details .card').length"), 8);
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#lifetime-details h3')).slice(0, 3).map(el => el.textContent.split(' — ')[0])"), ['초년운', '중년운', '말년운']);
  assert.equal(await evaluate("document.querySelectorAll('#lifetime-details details').length"), 8);
  assert.equal(await evaluate("document.querySelector('#lifetime-intro > p').textContent.includes('이미지')"), false);
  assert.equal(await evaluate("document.querySelector('#lifetime-view').dataset.readingVersion"), '3.1.0');
  assert.equal(await evaluate("document.querySelectorAll('#lifetime-intro > p').length"), 4);
  assert.ok(await evaluate("Array.from(document.querySelectorAll('#lifetime-details > article')).slice(0,3).every(card => card.querySelectorAll(':scope > p').length >= 4)"));
  assert.ok(await evaluate("document.querySelector('#lifetime-intro > p').textContent.startsWith('당신은')"));
  assert.equal(await evaluate("Array.from(document.querySelectorAll('#lifetime-details > article > p')).some(el => /천간|본기|지장간|같은 오행/.test(el.textContent))"), false);
  assert.equal(await evaluate("document.querySelectorAll('.navigation a').length"), 4);
  assert.ok((await evaluate("document.querySelector('#page-title').textContent")).includes('평생운세'));
  await evaluate("document.querySelector('a[href=\"./saju.html\"]').click()");
  await waitFor("document.querySelector('#saju-status')?.textContent === '계산 완료'");

  // Year-specific leap-month guidance and term-day uncertainty.
  await evaluate(`(() => {
    document.querySelector('#edit-profile').click();
    const form = document.querySelector('#profile-form');
    form.elements.birthYear.value = '2022';
    form.elements.calendar.value = 'lunar';
    form.dispatchEvent(new Event('change'));
  })()`);
  assert.equal(await evaluate("document.querySelector('[name=leapMonth]').disabled"), true);
  assert.ok((await evaluate("document.querySelector('#birth-date-help').textContent")).includes('2022년'));
  await evaluate(`(() => {
    const form = document.querySelector('#profile-form');
    form.elements.calendar.value = 'solar';
    for (const [name, value] of [['birthYear', '2024'], ['birthMonth', '2'], ['birthDay', '4']]) {
      form.elements[name].value = value;
      form.dispatchEvent(new Event('change'));
    }
    form.elements.birthTime.value = '17:27';
    form.requestSubmit();
  })()`);
  await waitFor("document.querySelector('#saju-status')?.textContent === '일부 확인 가능'");
  assert.ok((await evaluate("document.querySelector('#saju-note').textContent")).includes('1분 이내'));

  // Edit to a real leap month without leaking the old day/month selections.
  await evaluate(`(() => {
    document.querySelector('#edit-profile').click();
    const form = document.querySelector('#profile-form');
    form.elements.birthYear.value = '2025';
    form.elements.birthYear.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.calendar.value = 'lunar';
    form.dispatchEvent(new Event('change'));
    form.elements.leapMonth.checked = true;
    form.dispatchEvent(new Event('change'));
    form.elements.birthMonth.value = '6';
    form.dispatchEvent(new Event('change'));
    form.elements.birthDay.value = '1';
    form.elements.unknownTime.checked = true;
    form.dispatchEvent(new Event('change'));
    form.requestSubmit();
  })()`);
  await waitFor("document.querySelector('#saju-status')?.textContent === '일부 확인 가능'");
  assert.ok((await evaluate("document.querySelector('#profile-description').textContent")).includes('2025-07-25'));
  await evaluate("document.querySelector('a[href=\"./index.html\"]').click()");
  await waitFor("document.querySelectorAll('.element-column').length === 5");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.element-column > span')).reduce((sum, el) => sum + Number(el.textContent), 0)"), 6);
  assert.equal(await evaluate("document.querySelector('#action-toggle').getAttribute('aria-pressed')"), 'false');

  // Same input survives reload with the same theme.
  const theme = await evaluate("document.querySelector('#daily-keyword').textContent");
  await call('Page.reload');
  await waitFor("!document.querySelector('#action-toggle')?.disabled");
  assert.equal(await evaluate("document.querySelector('#daily-keyword').textContent"), theme);

  // Verify the page's timer-driven Korean midnight path without waiting overnight.
  await evaluate(`(() => {
    const OriginalDate = Date;
    const next = new OriginalDate(OriginalDate.now() + 86400000).getTime();
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [next])); }
      static now() { return next; }
    };
    document.dispatchEvent(new Event('visibilitychange'));
  })()`);
  assert.notEqual(await evaluate("document.querySelector('#daily-keyword').textContent"), theme);

  await evaluate(`(() => {
    document.querySelector('#edit-profile').click();
    const form = document.querySelector('#profile-form');
    form.elements.displayName.value = 'WWWWWWWWWWWWWWWWWWWW';
    form.requestSubmit();
  })()`);

  await evaluate("document.querySelector('a[href=\"./lifetime.html\"]').click()");
  await waitFor("document.querySelectorAll('#annual-cards .annual-card').length === 2");
  await evaluate(`(() => {
    const OriginalDate = Date;
    window.qaOriginalDate = OriginalDate;
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : ['2026-02-04T04:59:00+09:00'])); }
      static now() { return new OriginalDate('2026-02-04T04:59:00+09:00').getTime(); }
    };
    document.dispatchEvent(new Event('visibilitychange'));
  })()`);
  assert.ok((await evaluate("document.querySelector('#annual-cards h3').textContent")).startsWith('2025년'));
  await evaluate(`(() => {
    const OriginalDate = window.qaOriginalDate;
    window.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : ['2026-02-04T05:04:00+09:00'])); }
      static now() { return new OriginalDate('2026-02-04T05:04:00+09:00').getTime(); }
    };
    document.dispatchEvent(new Event('visibilitychange'));
  })()`);
  assert.ok((await evaluate("document.querySelector('#annual-cards h3').textContent")).startsWith('2026년'));
  for (const file of ['index.html', 'saju.html', 'personality.html', 'lifetime.html']) {
    for (const width of [320, 360, 768, 1280]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 500 });
      await call('Page.navigate', { url: `${base}/${file}` });
      await waitFor("document.querySelector('[name=birthYear]')?.options.length > 1");
      assert.equal(await evaluate("document.querySelectorAll('.navigation [aria-current=page]').length"), 1);
      assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), true, `${file} ${width}`);
      assert.equal(await evaluate(`(() => {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('#profile-title'));
        const box = range.getBoundingClientRect();
        return box.left >= 0 && box.right <= window.innerWidth;
      })()`), true, `${file} profile text ${width}`);
      if (width === 360 || width === 1280) await capture(`${file.replace('.html', '')}-${width}`);
      if (file === 'lifetime.html' && (width === 360 || width === 1280)) {
        await evaluate("document.querySelector('.annual-section').scrollIntoView()");
        await capture(`lifetime-years-${width}`);
        await evaluate('window.scrollTo(0, 0)');
      }
      await evaluate("document.querySelector('#edit-profile').click()");
      assert.equal(await evaluate("document.querySelector('#profile-dialog').scrollWidth <= document.querySelector('#profile-dialog').clientWidth + 1"), true, `${file} dialog ${width}`);
      const dialogBox = await evaluate(`(() => {
        const box = document.querySelector('#profile-dialog').getBoundingClientRect();
        return { left: box.left, right: box.right, width: window.innerWidth, scrollX: window.scrollX };
      })()`);
      assert.ok(dialogBox.left >= 0 && dialogBox.right <= dialogBox.width + 1 && dialogBox.scrollX === 0, JSON.stringify({ file, width, dialogBox }));
      if (file === 'index.html' && width === 360) await capture('input-360');
      await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      assert.equal(await evaluate("document.querySelector('#profile-dialog').open"), false);
    }
  }

  await evaluate("sessionStorage.clear()");
  await call('Page.navigate', { url: `${base}/lifetime.html` });
  await waitFor("document.querySelector('[name=birthYear]')?.options.length > 1");
  assert.equal(await evaluate("document.querySelectorAll('#annual-cards .annual-card').length"), 0);
  assert.equal(await evaluate("document.querySelector('#lifetime-status').textContent"), '정보 입력 대기');
  const injection = await call('Page.addScriptToEvaluateOnNewDocument', {
    source: "Storage.prototype.setItem = function () { throw new DOMException('Blocked', 'SecurityError'); };",
  });
  await call('Page.navigate', { url: `${base}/index.html` });
  await waitFor("document.querySelector('[name=birthYear]')?.options.length > 1");
  await evaluate(`(() => {
    document.querySelector('#edit-profile').click();
    const form = document.querySelector('#profile-form');
    for (const [name, value] of [['birthYear', '2000'], ['birthMonth', '2'], ['birthDay', '29']]) {
      form.elements[name].value = value;
      form.dispatchEvent(new Event('change'));
    }
    form.elements.birthTime.value = '00:00';
    form.requestSubmit();
  })()`);
  await waitFor("!document.querySelector('#action-toggle')?.disabled");
  assert.ok((await evaluate("document.querySelector('#profile-description').textContent")).includes('임시 보관 불가'));
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  assert.deepEqual(errors, []);
  console.log('PASS: real browser empty state, input, safe name rendering, all menus, editing lunar leap date, unknown time, reload, day rollover, mobile/desktop widths; initial theme: ' + originalTheme);
} finally {
  socket.close();
  await fetch(`${debug}/json/close/${page.id}`).catch(() => {});
}
