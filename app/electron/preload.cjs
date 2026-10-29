const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopWorkspace', Object.freeze({
  read: () => ipcRenderer.invoke('workspace:read'),
  choose: () => ipcRenderer.invoke('workspace:choose'),
  reset: () => ipcRenderer.invoke('workspace:reset'),
  save: request => ipcRenderer.invoke('workspace:save', request),
}))

// Fixed operations only. The launch token stays in main; copying is an explicit
// Settings action, not a generic clipboard setter or a renderer-readable secret.
contextBridge.exposeInMainWorld('desktopMcp', Object.freeze({
  status: () => ipcRenderer.invoke('mcp:status'),
  copyAddress: () => ipcRenderer.invoke('mcp:copy-address'),
  copyToken: () => ipcRenderer.invoke('mcp:copy-token'),
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
