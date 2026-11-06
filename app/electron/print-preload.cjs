const { contextBridge, ipcRenderer } = require('electron')

// DGM-151C print host bridge: read the one structured job, report done. No
// filesystem, URL, HTML or printer access is exposed.
contextBridge.exposeInMainWorld('printHost', Object.freeze({
  job: () => ipcRenderer.invoke('print:job'),
  done: result => ipcRenderer.send('print:done', result),
}))
