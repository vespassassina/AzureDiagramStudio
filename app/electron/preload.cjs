const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopWorkspace', Object.freeze({
  read: () => ipcRenderer.invoke('workspace:read'),
  choose: () => ipcRenderer.invoke('workspace:choose'),
  reset: () => ipcRenderer.invoke('workspace:reset'),
  save: request => ipcRenderer.invoke('workspace:save', request),
  saveDiagram: request => ipcRenderer.invoke('workspace:saveDiagram', request),
  saveDiagramAs: request => ipcRenderer.invoke('workspace:saveDiagramAs', request),
}))
// DGM-151C: one structured job in, PDF bytes out. No HTML, URL or path input.
contextBridge.exposeInMainWorld('desktopPdf', Object.freeze({
  render: job => ipcRenderer.invoke('pdf:render', job),
}))
contextBridge.exposeInMainWorld('desktopRecent', Object.freeze({
  list: () => ipcRenderer.invoke('recent:list'),
  choose: () => ipcRenderer.invoke('recent:choose'),
  read: id => ipcRenderer.invoke('recent:read', id),
  promote: id => ipcRenderer.invoke('recent:promote', id),
  readChosen: id => ipcRenderer.invoke('recent:read-chosen', id),
  acceptChosen: id => ipcRenderer.invoke('recent:accept-chosen', id),
}))

// Fixed operations only. The main process owns the persisted next-launch port;
// this bridge exposes no filesystem access or arbitrary clipboard writes.
contextBridge.exposeInMainWorld('desktopMcp', Object.freeze({
  status: () => ipcRenderer.invoke('mcp:status'),
  readPort: () => ipcRenderer.invoke('mcp:read-port'),
  savePort: port => ipcRenderer.invoke('mcp:save-port', port),
  copyAddress: () => ipcRenderer.invoke('mcp:copy-address'),
  publishSnapshot: text => ipcRenderer.invoke('mcp:publish', text),
  onMutation: (callback, canceled) => {
    const listener = (_event, request) => callback(request)
    const cancel = (_event, id) => canceled(id)
    ipcRenderer.on('mcp:mutation', listener)
    ipcRenderer.on('mcp:cancel', cancel)
    return () => { ipcRenderer.removeListener('mcp:mutation', listener); ipcRenderer.removeListener('mcp:cancel', cancel) }
  },
  mutationActive: id => ipcRenderer.invoke('mcp:mutation-active', id),
  completeMutation: (id, text) => ipcRenderer.invoke('mcp:mutation-result', id, text),
}))
