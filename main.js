// Prime Launcher — العملية الرئيسية (Electron).
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { version } = require('./package.json');   // الإصدار يُقرأ مرة واحدة هنا
const keys = require('./src/config/keys');
const store = require('./src/config/store');
const sys = require('./src/services/system');
const accounts = require('./src/services/accounts');
const ms = require('./src/services/msauth');
const skins = require('./src/services/skins');
const launcher = require('./src/services/launcher');
const mods = require('./src/services/mods');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 760, minWidth: 1000, minHeight: 620,
    frame: false, show: false, backgroundColor: '#1e1e1e',
    title: 'Prime Launcher',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.setMenu(null);
  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  ipcMain.handle('app:info', () => ({ version, platform: process.platform, userData: app.getPath('userData') }));
  ipcMain.on('win:minimize', () => win?.minimize());
  ipcMain.on('win:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
  ipcMain.on('win:close', () => win?.close());
  ipcMain.handle('keys:status', () => keys.hasKeys());
  ipcMain.handle('keys:save', (_e, input) => keys.saveKeys(input));
  ipcMain.handle('keys:test', (_e, which, typed) => keys.testKey(which, typed));
  ipcMain.handle('shell:open', (_e, url) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) shell.openExternal(url);
  });

  /* --- المرحلة 2: النسخ، الإصدارات، جافا، مربعات الحوار --- */
  ipcMain.handle('installs:get', () => store.get('installations', null));
  ipcMain.handle('installs:set', (_e, list) => {
    const clean = sys.sanitizeInstalls(list);
    store.set('installations', clean);
    for (const x of clean) {
      if (path.isAbsolute(x.gameDir)) { try { fs.mkdirSync(x.gameDir, { recursive: true }); } catch { /* تجاهل */ } }
    }
    return clean;
  });
  // يفتح مجلد نسخة محفوظة فقط (لا يقبل مسارات عشوائية من الواجهة).
  ipcMain.handle('installs:open', async (_e, id) => {
    const x = (store.get('installations', []) || []).find((i) => i.id === id);
    if (!x || !path.isAbsolute(x.gameDir)) return false;
    try { fs.mkdirSync(x.gameDir, { recursive: true }); } catch { return false; }
    return (await shell.openPath(x.gameDir)) === '';
  });
  ipcMain.handle('versions:get', () => sys.getVersions());
  ipcMain.handle('java:detect', () => sys.detectJava());
  ipcMain.handle('dialog:folder', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('dialog:file', async (_e, exts) => {
    const filters = Array.isArray(exts) && exts.length ? [{ name: 'Java', extensions: exts.filter((x) => /^[\w]+$/.test(x)) }, { name: 'All', extensions: ['*'] }] : undefined;
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
    return r.canceled ? null : r.filePaths[0];
  });

  /* --- المرحلة 3: الحسابات والسكنات --- */
  ipcMain.handle('accounts:list', () => accounts.view());
  ipcMain.handle('accounts:offline', (_e, name) => {
    const r = accounts.addOffline(name);
    if (!r.error) skins.reapplyActive().catch(() => {});
    return r;
  });
  ipcMain.handle('accounts:active', (_e, id) => {
    const r = accounts.setActive(typeof id === 'string' ? id : '');
    skins.reapplyActive().catch(() => {});
    return r;
  });
  ipcMain.handle('accounts:remove', (_e, id) => accounts.remove(typeof id === 'string' ? id : ''));
  ipcMain.handle('ms:start', () => ms.start((payload) => win?.webContents.send('ms:done', payload)));
  ipcMain.handle('ms:cancel', () => { ms.cancel(); });
  ipcMain.handle('skins:list', () => skins.list());
  ipcMain.handle('skins:save', (_e, input) => skins.save(input || {}));
  ipcMain.handle('skins:delete', (_e, id) => skins.remove(String(id)));
  ipcMain.handle('skins:apply', (_e, id) => skins.apply(id === null ? null : String(id)));
  ipcMain.handle('prefs:get', () => ({ skinsForAll: !!store.get('skinsForAll', false) }));
  ipcMain.handle('prefs:set', (_e, p) => { if (p && typeof p.skinsForAll === 'boolean') store.set('skinsForAll', p.skinsForAll); return { skinsForAll: !!store.get('skinsForAll', false) }; });

  /* --- المرحلة 4: المودات والتشغيل الفعلي --- */
  ipcMain.handle('mods:search', (_e, platform, params) => mods.search(platform === 'curseforge' ? 'curseforge' : 'modrinth', params));
  ipcMain.handle('mods:install', (_e, req) => mods.install({ platform: req?.platform === 'curseforge' ? 'curseforge' : 'modrinth', id: req?.id, type: req?.type, instanceId: req?.instanceId }));
  ipcMain.handle('launch:start', (_e, id) => launcher.launch(String(id), (ch, payload) => win?.webContents.send(ch, payload)));

  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
