// جسر آمن بين الواجهة والعملية الرئيسية. لا يمرّر المفاتيح إلى الواجهة.
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('prime', {
  info: () => call('app:info'),
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
    onState: (cb) => ipcRenderer.on('win:state', (_e, maximized) => cb(maximized))
  },
  keys: {
    status: () => call('keys:status'),
    save: (input) => call('keys:save', input),
    test: (which, typed) => call('keys:test', which, typed)
  },
  installs: {
    get: () => call('installs:get'),
    set: (list) => call('installs:set', list),
    openFolder: (id) => call('installs:open', id)
  },
  versions: { get: () => call('versions:get') },
  java: { detect: () => call('java:detect') },
  dialog: { folder: () => call('dialog:folder'), file: (exts) => call('dialog:file', exts) },
  accounts: {
    list: () => call('accounts:list'),
    addOffline: (name) => call('accounts:offline', name),
    setActive: (id) => call('accounts:active', id),
    remove: (id) => call('accounts:remove', id)
  },
  ms: {
    start: () => call('ms:start'),
    cancel: () => call('ms:cancel'),
    onDone: (cb) => ipcRenderer.on('ms:done', (_e, payload) => cb(payload))
  },
  skins: {
    list: () => call('skins:list'),
    save: (input) => call('skins:save', input),
    remove: (id) => call('skins:delete', id),
    apply: (id) => call('skins:apply', id)
  },
  prefs: { get: () => call('prefs:get'), set: (p) => call('prefs:set', p) },
  mods: {
    search: (platform, params) => call('mods:search', platform, params),
    install: (req) => call('mods:install', req)
  },
  launch: {
    start: (id) => call('launch:start', id),
    on: (cb) => { for (const ch of ['progress', 'started', 'error', 'exit']) ipcRenderer.on('launch:' + ch, (_e, p) => cb(ch, p)); }
  },
  openExternal: (url) => call('shell:open', url)
});
