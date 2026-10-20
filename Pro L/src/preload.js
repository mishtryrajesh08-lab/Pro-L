const { contextBridge, ipcRenderer: r } = require('electron');
// Only Pro L's own pages (file://) get the API; websites never see it.
if (location.protocol === 'file:')
  contextBridge.exposeInMainWorld('pro', {
    inv: (c, ...a) => r.invoke(c, ...a),
    on: (c, f) => r.on(c, (_, d) => f(d))
  });
