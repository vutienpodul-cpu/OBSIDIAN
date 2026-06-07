/**
 * OBSIDIAN — AI BRIDGE CONTROLLER
 * Wraps Playwright (Google Chrome preferred, bundled Chromium fallback):
 *   - Click Sequence picker: user clicks elements one-by-one, each captured as a numbered step
 *   - Step replay: execute saved steps in order, with param injection
 *   - Legacy record/replay kept for backwards compat
 */
import { chromium } from 'playwright';
import { app } from 'electron';
import { join } from 'path';
import fs from 'fs/promises';

const SESSION_ROOT = () => join(app.getPath('userData'), 'sessions');

const LAUNCH_OPTS = {
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: ['--disable-blink-features=AutomationControlled', '--no-default-browser-check', '--no-first-run'],
};

/** Bundled Chromium path — arm64 fallback when Playwright resolves missing x64 on Apple Silicon. */
async function resolveBundledChromiumExecutable() {
  const preferred = chromium.executablePath();
  try {
    await fs.access(preferred);
    return preferred;
  } catch {}

  const alt = preferred.replace('chrome-mac-x64', 'chrome-mac-arm64');
  if (alt !== preferred) {
    try {
      await fs.access(alt);
      return alt;
    } catch {}
  }
  return preferred;
}

/** Prefer installed Google Chrome; fall back to Playwright's bundled Chromium. */
async function launchBrowserContext(sessionDir, onLog) {
  try {
    onLog('Launching Google Chrome (system)...');
    return await chromium.launchPersistentContext(sessionDir, {
      ...LAUNCH_OPTS,
      channel: 'chrome',
    });
  } catch (err) {
    onLog(`Chrome not available (${err.message}) — falling back to bundled Chromium`);
    const executablePath = await resolveBundledChromiumExecutable();
    onLog(`Chromium: ${executablePath}`);
    return chromium.launchPersistentContext(sessionDir, {
      ...LAUNCH_OPTS,
      executablePath,
    });
  }
}

// ─── Click Picker — inject vào trang để user chọn element ───────────────────
// Khi user di chuột qua element, nó sẽ được highlight đỏ.
// Khi user click trái/phải, selector + info được lưu vào window.__obsidianPicked
const CLICK_PICKER_SCRIPT = `
(() => {
  if (window.__obsidianPickerActive) return;
  window.__obsidianPickerActive = true;
  let done = false;

  const hl = document.createElement('div');
  hl.id = '__obs_hl';
  hl.style.cssText = [
    'position:fixed','pointer-events:none','z-index:2147483647',
    'border:2px solid #DC2855','background:rgba(220,40,85,0.12)',
    'border-radius:3px','transition:all 80ms ease','box-sizing:border-box',
    'display:none'
  ].join(';');
  document.body.appendChild(hl);

  const badge = document.createElement('div');
  badge.id = '__obs_badge';
  badge.style.cssText = [
    'position:fixed','z-index:2147483648','pointer-events:none',
    'background:#DC2855','color:#fff','font-size:11px','font-weight:700',
    'padding:2px 8px','border-radius:10px','font-family:monospace',
    'box-shadow:0 2px 8px rgba(0,0,0,0.4)','display:none'
  ].join(';');
  document.body.appendChild(badge);

  function cssPath(el) {
    if (!el || el === document.body) return 'body';
    const path = [];
    let cur = el;
    while (cur && cur !== document.body && cur.nodeType === Node.ELEMENT_NODE) {
      let sel = cur.nodeName.toLowerCase();
      if (cur.id) { sel += '#' + CSS.escape(cur.id); path.unshift(sel); break; }
      if (cur.getAttribute('data-testid')) { sel += '[data-testid="' + cur.getAttribute('data-testid') + '"]'; path.unshift(sel); break; }
      if (cur.getAttribute('name')) { sel += '[name="' + cur.getAttribute('name') + '"]'; path.unshift(sel); break; }
      if (cur.getAttribute('placeholder')) { sel += '[placeholder="' + cur.getAttribute('placeholder').replace(/"/g,'') + '"]'; path.unshift(sel); break; }
      if (cur.getAttribute('aria-label')) { sel += '[aria-label="' + cur.getAttribute('aria-label').replace(/"/g,'') + '"]'; path.unshift(sel); break; }
      let sib = cur, idx = 1;
      while ((sib = sib.previousElementSibling)) if (sib.nodeName === cur.nodeName) idx++;
      if (idx > 1) sel += ':nth-of-type(' + idx + ')';
      path.unshift(sel);
      cur = cur.parentNode;
    }
    return path.slice(-5).join(' > ');
  }

  function moveHL(el) {
    if (!el || el.id === '__obs_hl' || el.id === '__obs_badge') { hl.style.display='none'; badge.style.display='none'; return; }
    const r = el.getBoundingClientRect();
    hl.style.cssText = hl.style.cssText
      .replace(/left:[^;]+;?/,'').replace(/top:[^;]+;?/,'')
      .replace(/width:[^;]+;?/,'').replace(/height:[^;]+;?/,'');
    Object.assign(hl.style, {
      display:'block', left:r.left+'px', top:r.top+'px',
      width:r.width+'px', height:r.height+'px'
    });
    badge.style.display = 'block';
    badge.style.left = (r.left + r.width/2 - 30) + 'px';
    badge.style.top  = Math.max(0, r.top - 24) + 'px';
  }

  function cleanup() {
    hl.remove(); badge.remove();
    document.removeEventListener('mouseover', onOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('contextmenu', onContext, true);
    window.__obsidianPickerActive = false;
  }

  function finishPick(el, e, action) {
    if (done) return;
    done = true;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();

    window.__obsidianPicked = {
      action,
      selector: cssPath(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 80),
      isInput: ['input','textarea','select'].includes(el.tagName.toLowerCase()),
      inputType: el.type || '',
      placeholder: el.getAttribute('placeholder') || '',
      x: Math.round(e.clientX), y: Math.round(e.clientY),
      pageUrl: location.href,
    };
    cleanup();
  }

  function onOver(e) {
    if (e.target.id === '__obs_hl' || e.target.id === '__obs_badge') return;
    moveHL(e.target);
  }
  function onClick(e) {
    const el = e.target;
    if (el.id === '__obs_hl' || el.id === '__obs_badge') return;
    finishPick(el, e, 'click');
  }
  function onContext(e) {
    const el = e.target;
    if (el.id === '__obs_hl' || el.id === '__obs_badge') return;
    finishPick(el, e, 'right_click');
  }

  document.addEventListener('mouseover', onOver, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('contextmenu', onContext, true);
})();
`;

// ─── Legacy recorder (kept for backwards compat) ──────────────────────────
const RECORDER_SCRIPT = `
(() => {
  if (window.__obsidianRecorderInstalled) return;
  window.__obsidianRecorderInstalled = true;
  window.__obsidianActions = [];
  function cssPath(el) {
    if (!(el instanceof Element)) return null;
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
      let sel = el.nodeName.toLowerCase();
      if (el.id) { sel += '#' + el.id; path.unshift(sel); break; }
      let sib = el, idx = 1;
      while ((sib = sib.previousElementSibling)) { if (sib.nodeName.toLowerCase() === sel) idx++; }
      if (idx > 1) sel += ':nth-of-type(' + idx + ')';
      path.unshift(sel); el = el.parentNode;
    }
    return path.join(' > ');
  }
  function record(action) { action.t = Date.now(); action.url = location.href; window.__obsidianActions.push(action); }
  document.addEventListener('click', e => { record({ type:'click', selector:cssPath(e.target), text:(e.target.innerText||'').slice(0,64) }); }, true);
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT')
      record({ type:'input', selector:cssPath(t), value:t.value, inputType:t.type||t.tagName.toLowerCase() });
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key==='Enter'&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'))
      record({ type:'press', key:'Enter', selector:cssPath(e.target) });
  }, true);
})();
`;

export class BridgeController {
  constructor(nodeId, { onEvent } = {}) {
    this.nodeId = nodeId;
    this.onEvent = onEvent || (() => {});
    this.context = null;
    this.page = null;
    this.recording = false;
  }

  emit(event) { this.onEvent(event); }

  async open(url) {
    await fs.mkdir(SESSION_ROOT(), { recursive: true });
    const sessionDir = join(SESSION_ROOT(), this.nodeId);
    this.emit({ kind: 'log', level: 'info', msg: `Opening browser · session ${this.nodeId}` });

    const log = (msg) => this.emit({ kind: 'log', level: 'info', msg });
    this.context = await launchBrowserContext(sessionDir, log);
    await this.context.addInitScript({ content: RECORDER_SCRIPT });
    this.page = this.context.pages()[0] || await this.context.newPage();
    if (url) {
      this.emit({ kind: 'log', level: 'info', msg: `Navigating to ${url}` });
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    }
    this.emit({ kind: 'ready', url: this.page.url() });
  }

  // ─── Click Sequence Picker ─────────────────────────────────────────────
  /**
   * Inject picker vào page, đợi user click 1 element.
   * Trả về { selector, tag, text, isInput, ... }
   * stepNumber chỉ để hiển thị badge.
   */
  async captureClick(stepNumber = 1) {
    if (!this.page) throw new Error('Browser chưa mở — nhấn OPEN BROWSER trước');

    await this.page.evaluate(() => {
      window.__obsidianPickerActive = false;
      delete window.__obsidianPicked;
    }).catch(() => {});

    const script = CLICK_PICKER_SCRIPT.replace(
      "badge.style.display = 'block';",
      `badge.style.display = 'block'; badge.textContent = 'Step ${stepNumber} · R=right';`
    );

    this.emit({ kind: 'log', level: 'info', msg: `Đang chờ click step ${stepNumber} (trái hoặc phải)...` });
    this.emit({ kind: 'picking', step: stepNumber });

    await this.page.evaluate(script);

    const start = Date.now();
    while (Date.now() - start < 120000) {
      const picked = await this.page.evaluate(() => {
        const p = window.__obsidianPicked;
        if (p) delete window.__obsidianPicked;
        return p || null;
      });
      if (picked) {
        this.emit({ kind: 'picked', step: stepNumber, info: picked });
        return picked;
      }
      await this.page.waitForTimeout(200);
    }

    await this.page.evaluate(() => {
      window.__obsidianPickerActive = false;
      delete window.__obsidianPicked;
    }).catch(() => {});
    throw new Error(`Timeout — không nhận được click trong 120 giây`);
  }

  /**
   * Run a Click Sequence — danh sách steps đã định nghĩa trước.
   * Step types: click | right_click | type | wait | goto | press
   * injectMap: { stepIndex: 'value to inject' } — inject upstream data vào type steps
   */
  async runSteps(steps, injectMap = {}) {
    if (!this.page) throw new Error('Browser chưa mở');
    this.emit({ kind: 'replay', state: 'started', total: steps.length });

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      this.emit({ kind: 'replay', state: 'step', index: i, total: steps.length, action: s });

      try {
        if (s.type === 'goto') {
          await this.page.goto(s.url || s.value, { waitUntil: 'domcontentloaded' });

        } else if (s.type === 'click') {
          await this.page.waitForSelector(s.selector, { timeout: 10000 }).catch(() => null);
          try {
            await this.page.click(s.selector, { timeout: 5000 });
          } catch {
            if (s.x && s.y) await this.page.mouse.click(s.x, s.y);
            else throw new Error(`Không tìm thấy element: ${s.selector}`);
          }

        } else if (s.type === 'right_click') {
          await this.page.waitForSelector(s.selector, { timeout: 10000 }).catch(() => null);
          try {
            await this.page.click(s.selector, { button: 'right', timeout: 5000 });
          } catch {
            if (s.x && s.y) await this.page.mouse.click(s.x, s.y, { button: 'right' });
            else throw new Error(`Không tìm thấy element: ${s.selector}`);
          }

        } else if (s.type === 'type') {
          const value = injectMap[i] !== undefined ? injectMap[i] : (s.value || '');
          await this.page.waitForSelector(s.selector, { timeout: 10000 }).catch(() => null);
          await this.page.click(s.selector, { timeout: 5000 });
          await this.page.fill(s.selector, String(value));

        } else if (s.type === 'press') {
          await this.page.keyboard.press(s.key || 'Enter');

        } else if (s.type === 'wait') {
          const ms = Number(s.value) || 2000;
          await this.page.waitForTimeout(ms);

        } else if (s.type === 'screenshot') {
          await this.page.screenshot({ path: s.value || undefined });
        }

        // Natural delay between steps
        await this.page.waitForTimeout(s.delay || 300);

      } catch (err) {
        this.emit({ kind: 'replay', state: 'error', index: i, msg: err.message, step: s });
        throw err;
      }
    }

    this.emit({ kind: 'replay', state: 'done' });
  }

  // ─── Legacy record/replay ──────────────────────────────────────────────
  async startRecording() {
    if (!this.page) throw new Error('No page open');
    await this.page.evaluate(() => { window.__obsidianActions = []; });
    this.recording = true;
    this.emit({ kind: 'recording', state: 'started' });
  }

  async stopRecording() {
    if (!this.page) throw new Error('No page open');
    const actions = await this.page.evaluate(() => window.__obsidianActions || []);
    this.recording = false;
    this.emit({ kind: 'recording', state: 'stopped', steps: actions.length });
    return actions;
  }

  async replay(actions, params = {}) {
    if (!this.page) throw new Error('No page open');
    this.emit({ kind: 'replay', state: 'started', total: actions.length });
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      this.emit({ kind: 'replay', state: 'step', index: i, total: actions.length, action: a });
      try {
        if (a.url && this.page.url() !== a.url && i === 0) await this.page.goto(a.url, { waitUntil: 'domcontentloaded' });
        if (a.type === 'click') { await this.page.waitForSelector(a.selector, { timeout: 8000 }); await this.page.click(a.selector); }
        else if (a.type === 'input') { await this.page.waitForSelector(a.selector, { timeout: 8000 }); const v = params[a.selector] !== undefined ? params[a.selector] : a.value; await this.page.fill(a.selector, String(v)); }
        else if (a.type === 'press') { await this.page.waitForSelector(a.selector, { timeout: 8000 }); await this.page.press(a.selector, a.key); }
        else if (a.type === 'goto') { await this.page.goto(a.url, { waitUntil: 'domcontentloaded' }); }
        await this.page.waitForTimeout(180);
      } catch (err) { this.emit({ kind: 'replay', state: 'error', index: i, msg: err.message }); throw err; }
    }
    this.emit({ kind: 'replay', state: 'done' });
  }

  async waitForStable(selector, timeout = 180000) {
    if (!this.page) throw new Error('No page open');
    this.emit({ kind: 'log', level: 'info', msg: `Waiting for stable: ${selector}` });
    await this.page.waitForSelector(selector, { timeout });
    await this.page.evaluate(([sel, ms]) => new Promise((res, rej) => {
      const start = Date.now(); let last = Date.now();
      const t = document.querySelector(sel); if (!t) return rej('Selector vanished');
      const obs = new MutationObserver(() => { last = Date.now(); });
      obs.observe(t, { childList: true, subtree: true, attributes: true });
      const iv = setInterval(() => {
        if (Date.now() - last > 2000) { clearInterval(iv); obs.disconnect(); res(); }
        else if (Date.now() - start > ms) { clearInterval(iv); obs.disconnect(); rej('Timeout'); }
      }, 200);
    }), [selector, timeout]);
    this.emit({ kind: 'log', level: 'info', msg: `Stable: ${selector}` });
  }

  async grabOutput(selector, attr = 'src') {
    if (!this.page) throw new Error('No page open');
    const values = await this.page.$$eval(selector, (els, a) => els.map(el => a === 'text' ? el.innerText : el.getAttribute(a)), attr);
    this.emit({ kind: 'log', level: 'info', msg: `Grabbed ${values.length} outputs from ${selector}` });
    return values;
  }

  async screenshot(path) {
    if (!this.page) return null;
    return this.page.screenshot({ path, fullPage: false });
  }

  async close() {
    if (this.context) {
      try { await this.context.close(); } catch {}
      this.context = null; this.page = null;
    }
  }
}
