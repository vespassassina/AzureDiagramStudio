const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('headlessRuntime', Object.freeze({
  ready: () => ipcRenderer.send('headless:ready'),
  respond: (id, result) => ipcRenderer.send('headless:response', id, result),
  renderPdf: job => ipcRenderer.invoke('headless:pdf', job),
  onRequest: callback => {
    const listener = (_event, request) => callback(request)
    ipcRenderer.on('headless:request', listener)
    return () => ipcRenderer.removeListener('headless:request', listener)
  },
}))
