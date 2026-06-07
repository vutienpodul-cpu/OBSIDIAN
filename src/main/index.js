/**
 * OBSIDIAN — Electron Main Process
 */
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import fs from 'fs/promises';
import https from 'https';
import { BridgeController } from './bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let mainWindow = null;
const bridges = new Map(); // sessionId -> BridgeController

// ─── Paths ───────────────────────────────────────────────────────────────
const ACCOUNTS_FILE = () => join(app.getPath('userData'), 'accounts.json');
const SESSION_ROOT  = () => join(app.getPath('userData'), 'sessions');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, height: 1000,
    minWidth: 1280, minHeight: 720,
    backgroundColor: '#0A0A0F',
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0A0A0F', symbolColor: '#D4A574', height: 52 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/* ============================================
   IPC — Workflow file I/O
   ============================================ */
ipcMain.handle('workflow:save', async (_e, { workflow, filePath } = {}) => {
  let target = filePath || null;
  if (!target) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save OBSIDIAN workflow',
      defaultPath: `${workflow?.name || 'workflow'}.obsidian.json`,
      filters: [{ name: 'OBSIDIAN Workflow', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    target = result.filePath;
  }
  await fs.writeFile(target, JSON.stringify(workflow, null, 2), 'utf-8');
  return { ok: true, path: target };
});

ipcMain.handle('workflow:load', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open OBSIDIAN workflow',
    filters: [{ name: 'OBSIDIAN Workflow', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  const data = await fs.readFile(result.filePaths[0], 'utf-8');
  return { ok: true, path: result.filePaths[0], workflow: JSON.parse(data) };
});

ipcMain.handle('output:save', async (_e, { defaultName, buffer }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export output', defaultPath: defaultName
  });
  if (result.canceled || !result.filePath) return { ok: false };
  await fs.writeFile(result.filePath, Buffer.from(buffer));
  return { ok: true, path: result.filePath };
});

ipcMain.handle('shell:open-path', async (_e, p) => shell.openPath(p));

ipcMain.handle('dialog:pick-folder', async (_e, { defaultPath } = {}) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Chọn thư mục export',
    defaultPath: defaultPath || app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  return { ok: true, path: result.filePaths[0] };
});

function formatToExt(format) {
  switch (format) {
    case 'PNG sequence': return 'png';
    case 'MP4 (H.265)': return 'mp4';
    case 'ProRes 4K': return 'mov';
    case 'PSD': return 'psd';
    case 'PPTX': return 'pptx';
    case 'GLB': return 'glb';
    default: return 'png';
  }
}

function mimeToExt(mime) {
  if (!mime) return null;
  const m = mime.split(';')[0].trim().toLowerCase();
  const map = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4',
  };
  return map[m] || null;
}

function extFromUrl(url) {
  try {
    const p = new URL(url).pathname;
    const ext = extname(p).replace(/^\./, '').toLowerCase();
    return ext || null;
  } catch {
    return null;
  }
}

async function fetchRemoteItem(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = extFromUrl(url) || mimeToExt(res.headers.get('content-type')) || 'bin';
  return { buffer, ext };
}

async function decodeDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;,]+)?(?:;base64)?,(.+)$/);
  if (!match) throw new Error('Invalid data URL');
  const isBase64 = dataUrl.includes(';base64,');
  const payload = match[2];
  const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf-8');
  const ext = mimeToExt(match[1]) || 'bin';
  return { buffer, ext };
}

function isLocalPath(str) {
  return str.startsWith('/') || /^[A-Za-z]:[\\/]/.test(str);
}

ipcMain.handle('export:write-files', async (_e, { folderPath, items, format }) => {
  if (!folderPath) return { ok: false, error: 'Chưa chọn thư mục export' };

  await fs.mkdir(folderPath, { recursive: true });
  const defaultExt = formatToExt(format);
  const saved = [];
  const errors = [];
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) {
    const manifest = join(folderPath, 'export_manifest.json');
    await fs.writeFile(manifest, JSON.stringify({
      format,
      items: [],
      exportedAt: new Date().toISOString(),
      note: 'No upstream items — manifest only',
    }, null, 2), 'utf-8');
    return { ok: true, folderPath, saved: [manifest], errors: [], count: 1 };
  }

  for (let i = 0; i < list.length; i++) {
    const str = String(list[i] ?? '').trim();
    if (!str) continue;
    const seq = String(i + 1).padStart(3, '0');

    try {
      let buffer;
      let ext = defaultExt;

      if (str.startsWith('data:')) {
        ({ buffer, ext } = await decodeDataUrl(str));
      } else if (str.startsWith('http://') || str.startsWith('https://')) {
        ({ buffer, ext } = await fetchRemoteItem(str));
      } else if (str.startsWith('file://')) {
        const local = fileURLToPath(str);
        buffer = await fs.readFile(local);
        ext = extname(local).replace(/^\./, '') || defaultExt;
      } else if (isLocalPath(str)) {
        buffer = await fs.readFile(str);
        ext = extname(str).replace(/^\./, '') || defaultExt;
      } else {
        buffer = Buffer.from(str, 'utf-8');
        ext = 'txt';
      }

      const filePath = join(folderPath, `export_${seq}.${ext}`);
      await fs.writeFile(filePath, buffer);
      saved.push(filePath);
    } catch (err) {
      errors.push({ index: i, item: str.slice(0, 120), error: err.message || String(err) });
    }
  }

  if (saved.length === 0 && errors.length > 0) {
    return { ok: false, error: errors[0].error, folderPath, saved, errors, count: 0 };
  }

  return { ok: true, folderPath, saved, errors, count: saved.length };
});

/* ============================================
   IPC — ACCOUNTS
   ============================================ */
ipcMain.handle('accounts:load', async () => {
  try {
    const data = await fs.readFile(ACCOUNTS_FILE(), 'utf-8');
    return { ok: true, accounts: JSON.parse(data) };
  } catch {
    return { ok: true, accounts: [] };
  }
});

ipcMain.handle('accounts:save', async (_e, accounts) => {
  await fs.writeFile(ACCOUNTS_FILE(), JSON.stringify(accounts, null, 2), 'utf-8');
  return { ok: true };
});

ipcMain.handle('accounts:delete-session', async (_e, accountId) => {
  try {
    const dir = join(SESSION_ROOT(), accountId);
    await fs.rm(dir, { recursive: true, force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('accounts:session-exists', async (_e, accountId) => {
  try {
    await fs.access(join(SESSION_ROOT(), accountId));
    return { ok: true, exists: true };
  } catch {
    return { ok: true, exists: false };
  }
});

/* ============================================
   IPC — AI BRIDGE (Playwright control)
   Now accepts sessionId (accountId or nodeId)
   ============================================ */
ipcMain.handle('bridge:open', async (_e, { nodeId, url, sessionId }) => {
  const sid = sessionId || nodeId;
  try {
    if (bridges.has(sid)) {
      await bridges.get(sid).close();
      bridges.delete(sid);
    }
    const b = new BridgeController(sid, {
      onEvent: (event) => {
        mainWindow?.webContents.send('bridge:event', { nodeId, sessionId: sid, ...event });
      }
    });
    bridges.set(sid, b);
    await b.open(url);
    return { ok: true, sessionId: sid };
  } catch (e) {
    bridges.delete(sid);
    return { ok: false, error: e.message || String(e) };
  }
});

ipcMain.handle('bridge:record-start', async (_e, { nodeId, sessionId }) => {
  const sid = sessionId || nodeId;
  const b = bridges.get(sid);
  if (!b) return { ok: false, error: 'Bridge not open' };
  await b.startRecording();
  return { ok: true };
});

ipcMain.handle('bridge:record-stop', async (_e, { nodeId, sessionId }) => {
  const sid = sessionId || nodeId;
  const b = bridges.get(sid);
  if (!b) return { ok: false, error: 'Bridge not open' };
  const actions = await b.stopRecording();
  return { ok: true, actions };
});

ipcMain.handle('bridge:replay', async (_e, { nodeId, sessionId, actions, params }) => {
  const sid = sessionId || nodeId;
  const b = bridges.get(sid);
  if (!b) return { ok: false, error: 'Bridge not open' };
  await b.replay(actions, params);
  return { ok: true };
});

ipcMain.handle('bridge:grab-output', async (_e, { nodeId, sessionId, selector, attr }) => {
  const sid = sessionId || nodeId;
  const b = bridges.get(sid);
  if (!b) return { ok: false, error: 'Bridge not open' };
  const result = await b.grabOutput(selector, attr);
  return { ok: true, result };
});

ipcMain.handle('bridge:wait-stable', async (_e, { nodeId, sessionId, selector, timeout }) => {
  const sid = sessionId || nodeId;
  const b = bridges.get(sid);
  if (!b) return { ok: false, error: 'Bridge not open' };
  await b.waitForStable(selector, timeout);
  return { ok: true };
});

// ─── Click Sequence ─────────────────────────────────────────────────────
ipcMain.handle('bridge:capture-click', async (_e, { nodeId, sessionId, stepNumber }) => {
  const sid = sessionId || nodeId;
  let b = bridges.get(sid);
  if (!b) return { ok: false, error: 'Browser chưa mở — nhấn OPEN BROWSER trước' };
  try {
    const info = await b.captureClick(stepNumber || 1);
    return { ok: true, info };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('bridge:run-steps', async (_e, { nodeId, sessionId, steps, injectMap }) => {
  const sid = sessionId || nodeId;
  const b = bridges.get(sid);
  if (!b) return { ok: false, error: 'Bridge not open' };
  try {
    await b.runSteps(steps || [], injectMap || {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('bridge:check-selector', async (_e, { nodeId, sessionId, selector }) => {
  const sid = sessionId || nodeId;
  const b = bridges.get(sid);
  if (!b) return { ok: true, found: false };
  try {
    const found = await b.page.locator(selector).count() > 0;
    return { ok: true, found };
  } catch {
    return { ok: true, found: false };
  }
});

ipcMain.handle('bridge:is-open', async (_e, { nodeId, sessionId }) => {
  const sid = sessionId || nodeId;
  return { ok: true, open: bridges.has(sid) };
});

ipcMain.handle('bridge:close', async (_e, { nodeId, sessionId }) => {
  const sid = sessionId || nodeId;
  const b = bridges.get(sid);
  if (b) { await b.close(); bridges.delete(sid); }
  return { ok: true };
});

/* ============================================
   IPC — TEMP MAIL (GuerillaMail API)
   ============================================ */
// Simple HTTPS GET helper using Node's built-in https module
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// In-memory session cookie per renderer session
let gmailSid = '';

ipcMain.handle('tempmail:new', async () => {
  try {
    const res = await httpsGet('https://api.guerrillamail.com/ajax.php?f=get_email_address&lang=en');
    if (res.body && res.body.email_addr) {
      // Extract SID from set-cookie header
      const cookie = res.headers['set-cookie'];
      if (cookie) {
        const match = String(cookie).match(/PHPSESSID=([^;]+)/);
        if (match) gmailSid = match[1];
      }
      return {
        ok: true,
        email: res.body.email_addr,
        sid: res.body.sid_token || '',
        token: res.body.sid_token || ''
      };
    }
    return { ok: false, error: 'No email returned' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('tempmail:set-address', async (_e, { user }) => {
  try {
    const url = `https://api.guerrillamail.com/ajax.php?f=set_email_user&email_user=${encodeURIComponent(user)}&lang=en`;
    const headers = gmailSid ? { Cookie: `PHPSESSID=${gmailSid}` } : {};
    const res = await httpsGet(url, headers);
    if (res.body && res.body.email_addr) {
      return { ok: true, email: res.body.email_addr, token: res.body.sid_token || '' };
    }
    return { ok: false, error: 'Failed to set address' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('tempmail:inbox', async (_e, { token, seq = 0 }) => {
  try {
    const headers = gmailSid ? { Cookie: `PHPSESSID=${gmailSid}` } : {};
    const url = `https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0&seq=${seq}&sid_token=${encodeURIComponent(token || '')}`;
    const res = await httpsGet(url, headers);
    if (res.body && res.body.list) {
      return { ok: true, emails: res.body.list, count: res.body.count };
    }
    return { ok: true, emails: [], count: 0 };
  } catch (e) {
    return { ok: false, error: e.message, emails: [] };
  }
});

ipcMain.handle('tempmail:read', async (_e, { emailId, token }) => {
  try {
    const headers = gmailSid ? { Cookie: `PHPSESSID=${gmailSid}` } : {};
    const url = `https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${emailId}&sid_token=${encodeURIComponent(token || '')}`;
    const res = await httpsGet(url, headers);
    if (res.body && res.body.mail_body) {
      return {
        ok: true,
        subject: res.body.mail_subject || '',
        from: res.body.mail_from || '',
        body: res.body.mail_body || '',
        // Extract links from body
        links: (res.body.mail_body.match(/https?:\/\/[^\s"<>]+/g) || [])
      };
    }
    return { ok: false, error: 'No body' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('tempmail:forget', async () => {
  try {
    const headers = gmailSid ? { Cookie: `PHPSESSID=${gmailSid}` } : {};
    await httpsGet('https://api.guerrillamail.com/ajax.php?f=forget_me', headers);
    gmailSid = '';
    return { ok: true };
  } catch {
    return { ok: true };
  }
});

/* ============================================
   App lifecycle
   ============================================ */
app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', async () => {
  for (const b of bridges.values()) { try { await b.close(); } catch {} }
  bridges.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  for (const b of bridges.values()) { try { await b.close(); } catch {} }
});
