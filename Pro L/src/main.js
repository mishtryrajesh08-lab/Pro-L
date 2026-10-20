const { app, BrowserWindow, WebContentsView, ipcMain, session, shell, Menu } = require('electron');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');

const SITES = {
  youtube:['YouTube','https://www.youtube.com','#ff4b3e'], google:['Google','https://www.google.com','#4285f4'],
  gmail:['Gmail','https://mail.google.com','#ea4335'], github:['GitHub','https://github.com','#8b949e'],
  wikipedia:['Wikipedia','https://www.wikipedia.org','#9aa0a6'], reddit:['Reddit','https://www.reddit.com','#ff5700'],
  x:['X','https://x.com','#e7e9ea'], facebook:['Facebook','https://www.facebook.com','#1877f2'],
  instagram:['Instagram','https://www.instagram.com','#e1306c'], whatsapp:['WhatsApp','https://web.whatsapp.com','#25d366'],
  linkedin:['LinkedIn','https://www.linkedin.com','#0a66c2'], netflix:['Netflix','https://www.netflix.com','#e50914'],
  amazon:['Amazon','https://www.amazon.in','#ff9900'], spotify:['Spotify','https://open.spotify.com','#1db954'],
  maps:['Maps','https://www.google.com/maps','#34a853'], claude:['Claude','https://claude.ai','#d4a27f']
};
const ENGINES = {
  google:['Google','https://www.google.com/search?q='], duckduckgo:['DuckDuckGo','https://duckduckgo.com/?q='],
  bing:['Bing','https://www.bing.com/search?q='], brave:['Brave Search','https://search.brave.com/search?q='],
  ecosia:['Ecosia','https://www.ecosia.org/search?q='], startpage:['Startpage','https://www.startpage.com/do/search?q='],
  yahoo:['Yahoo','https://search.yahoo.com/search?p=']
};
const DEF = { setupDone:false, side:'left', sites:['youtube','google','gmail','github','wikipedia','reddit'], engine:'google',
  theme:'graphite', accent:'#8f9bff', adblock:true, https:true, phish:true, home:'pro://newtab', bookmarks:[] };
const CFG = () => path.join(app.getPath('userData'), 'prol.json');
let S = { ...DEF };
try { S = { ...DEF, ...JSON.parse(fs.readFileSync(CFG(), 'utf8')) }; } catch {}
const save = () => { try { fs.writeFileSync(CFG(), JSON.stringify(S)); } catch {} };

// ---- Protection lists (small built-in set; extend freely) ----
const AD = ['doubleclick.net','googlesyndication.com','googleadservices.com','adservice.google.com','google-analytics.com',
  'googletagmanager.com','adnxs.com','taboola.com','outbrain.com','criteo.com','pubmatic.com','rubiconproject.com','openx.net',
  'amazon-adsystem.com','scorecardresearch.com','moatads.com','adsrvr.org','casalemedia.com','popads.net','propellerads.com',
  'exoclick.com','mgid.com','hotjar.com','quantserve.com','advertising.com','smartadserver.com','2mdn.net','adform.net',
  'teads.tv','zedo.com','bidswitch.net','yieldmo.com','media.net','adcolony.com','unityads.unity3d.com'];
const BRANDS = ['paypal','google','facebook','amazon','apple','microsoft','netflix','instagram','whatsapp','github','paytm','sbi'];
const SAFE = ['googleusercontent.com','googleapis.com','googlevideo.com','githubusercontent.com','amazonaws.com','microsoftonline.com','gstatic.com'];
const m = (h, l) => l.some(d => h === d || h.endsWith('.' + d));
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;
function fake(h) {
  if (/(^|\.)xn--/.test(h)) return 'look-alike (punycode) address';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) && !LOCAL.test(h)) return 'raw IP address';
  if (/\.(zip|mov|tk|ml|ga|cf|gq)$/.test(h)) return 'high-risk domain ending';
  if (!m(h, SAFE)) for (const b of BRANDS)
    if (h.includes(b) && !new RegExp('(^|\\.)' + b + '\\.[a-z.]{2,6}$').test(h)) return 'imitates ' + b;
}

// ---- Tabs ----
const TOP = 88, SIDE = 64;
let win, active = null, nid = 1; const tabs = new Map();
const PAGE = n => pathToFileURL(path.join(__dirname, 'pages.html')).href + '#' + n;
const disp = u => (u.startsWith('file:') && u.includes('pages.html#')) ? 'pro://' + u.split('#')[1].split(':')[0] : u;
function resolve(t) {
  t = (t || '').trim();
  if (!t) return PAGE('newtab');
  if (/^pro:\/\//i.test(t)) return PAGE(t.slice(6));
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t;
  if (/^(localhost|[^\s/]+\.[a-z]{2,})(:\d+)?([/?#]\S*)?$/i.test(t)) return 'https://' + t;
  return ENGINES[S.engine][1] + encodeURIComponent(t);
}
const cur = () => tabs.get(active)?.v.webContents;
const wcs = () => [win.webContents, ...[...tabs.values()].map(t => t.v.webContents)].filter(w => !w.isDestroyed());
const send = (c, d) => wcs().forEach(w => w.send(c, d));
function push() {
  if (!win) return;
  const list = [...tabs.values()].map(t => {
    const w = t.v.webContents, H = w.navigationHistory, u = disp(w.getURL() || '');
    return { id: t.id, title: t.title, icon: t.icon, url: u, loading: w.isLoading(),
      back: H.canGoBack(), fwd: H.canGoForward(), bm: S.bookmarks.some(b => b.url === w.getURL()) };
  });
  win.webContents.send('tabs', { list, active });
}
function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize(), x = S.side === 'left' ? SIDE : 0;
  for (const t of tabs.values()) {
    const on = t.id === active; t.v.setVisible(on);
    if (on) t.v.setBounds({ x, y: TOP, width: Math.max(0, w - SIDE), height: Math.max(0, h - TOP) });
  }
}
function newTab(u, select = true) {
  const id = nid++;
  const v = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true } });
  const w = v.webContents, t = { id, v, title: 'New tab', icon: '' };
  tabs.set(id, t); win.contentView.addChildView(v);
  w.on('page-title-updated', (_, x) => { t.title = x; push(); });
  w.on('page-favicon-updated', (_, f) => { t.icon = f[0] || ''; push(); });
  ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page'].forEach(e => w.on(e, push));
  w.setWindowOpenHandler(({ url }) => { newTab(url); return { action: 'deny' }; });
  w.on('before-input-event', keys);
  w.loadURL(resolve(u || S.home));
  if (select) selectTab(id); else push();
  return id;
}
function selectTab(id) { if (!tabs.has(id)) return; active = id; layout(); push(); }
function closeTab(id) {
  const t = tabs.get(id); if (!t) return;
  const ids = [...tabs.keys()], i = ids.indexOf(id);
  win.contentView.removeChildView(t.v); t.v.webContents.close(); tabs.delete(id);
  if (!tabs.size) return app.quit();
  if (active === id) selectTab(ids[i + 1] ?? ids[i - 1]); else push();
}
function toggleBm() {
  const w = cur(); if (!w) return; const u = w.getURL();
  if (!/^https?:/.test(u)) return;
  const i = S.bookmarks.findIndex(b => b.url === u);
  i >= 0 ? S.bookmarks.splice(i, 1) : S.bookmarks.unshift({ title: w.getTitle() || u, url: u });
  save(); send('settings', S); push();
}
function keys(e, i) {
  if (i.type !== 'keyDown') return;
  const c = i.control || i.meta, k = i.key.toLowerCase(), w = cur(), ids = [...tabs.keys()];
  const stop = f => { e.preventDefault(); f(); };
  if (c && k === 't') stop(() => newTab());
  else if (c && k === 'w') stop(() => closeTab(active));
  else if (c && k === 'l') stop(() => { win.webContents.focus(); win.webContents.send('focus-url'); });
  else if (c && k === 'd') stop(toggleBm);
  else if ((c && k === 'r') || k === 'f5') stop(() => w?.reload());
  else if (c && k === 'tab') stop(() => selectTab(ids[(ids.indexOf(active) + (i.shift ? -1 : 1) + ids.length) % ids.length]));
  else if (i.alt && k === 'arrowleft') stop(() => w?.navigationHistory.goBack());
  else if (i.alt && k === 'arrowright') stop(() => w?.navigationHistory.goForward());
  else if (c && (k === '=' || k === '+')) stop(() => w?.setZoomLevel(w.getZoomLevel() + 0.5));
  else if (c && k === '-') stop(() => w?.setZoomLevel(w.getZoomLevel() - 0.5));
  else if (c && k === '0') stop(() => w?.setZoomLevel(0));
}

// ---- Downloads ----
const DL = [];
const dls = () => DL.map(({ item, ...r }) => r);
function watchDownloads() {
  session.defaultSession.on('will-download', (_, item) => {
    const d = { id: Date.now() + Math.random(), name: item.getFilename(), total: 0, got: 0, state: 'progressing', path: '', item };
    DL.unshift(d);
    const up = () => { d.total = item.getTotalBytes(); d.got = item.getReceivedBytes(); d.path = item.getSavePath(); send('downloads', dls()); };
    item.on('updated', (_, s) => { d.state = s; up(); });
    item.once('done', (_, s) => { d.state = s; up(); });
    up();
  });
}

// ---- Privacy filters ----
function filters() {
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => {
    let u; try { u = new URL(d.url); } catch { return cb({}); }
    if (!/^(https?|wss?):$/.test(u.protocol)) return cb({});
    const h = u.hostname, main = d.resourceType === 'mainFrame';
    if (S.adblock && !main && m(h, AD)) return cb({ cancel: true });
    if (S.phish && main) {
      const why = fake(h);
      if (why) {
        const t = [...tabs.values()].find(x => x.v.webContents.id === d.webContentsId);
        if (t) setImmediate(() => t.v.webContents.loadURL(PAGE('blocked:' + encodeURIComponent(h + ' - ' + why))));
        return cb({ cancel: true });
      }
    }
    if (S.https && u.protocol === 'http:' && !LOCAL.test(h)) { u.protocol = 'https:'; return cb({ redirectURL: u.href }); }
    cb({});
  });
}

// ---- IPC (only from Pro L's own file:// pages) ----
const H = (c, f) => ipcMain.handle(c, (e, ...a) => e.senderFrame.url.startsWith('file:') ? f(...a) : null);
H('state', () => ({ S, sites: SITES, engines: Object.fromEntries(Object.entries(ENGINES).map(([k, v]) => [k, v[0]])), dl: dls(),
  tabs: { list: [], active } }));
H('set', p => { Object.assign(S, p); save(); send('settings', S); layout(); });
H('tab', (a, x) => a === 'new' ? newTab(x) : a === 'close' ? closeTab(x) : a === 'select' ? selectTab(x) : 0);
H('nav', (a, x) => {
  const w = cur(); if (!w) return;
  if (a === 'go') w.loadURL(resolve(x));
  else if (a === 'back') w.navigationHistory.goBack();
  else if (a === 'fwd') w.navigationHistory.goForward();
  else if (a === 'reload') w.isLoading() ? w.stop() : w.reload();
});
H('bm', a => { if (a === 'toggle') toggleBm(); });
H('dl', (id, a) => { const d = DL.find(x => x.id === id); if (!d) return;
  if (a === 'open') shell.openPath(d.path); else if (a === 'show') shell.showItemInFolder(d.path); else if (a === 'cancel') d.item.cancel(); });
H('clear', async () => { await session.defaultSession.clearStorageData(); await session.defaultSession.clearCache(); });
H('tabsNow', () => { push(); });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({ width: 1360, height: 860, minWidth: 820, minHeight: 520, backgroundColor: '#17161a',
    title: 'Pro L', icon: path.join(__dirname, 'logo.png'), titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#17161a', symbolColor: '#c8c7c8', height: 40 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true } });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('before-input-event', keys);
  win.on('resize', layout);
  filters(); watchDownloads();
  win.webContents.once('did-finish-load', () => newTab(S.setupDone ? S.home : 'pro://setup'));
});
app.on('window-all-closed', () => app.quit());
