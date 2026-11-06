import { download } from '../export.ts'

export type WorkspacePreference = { root: string; isDefault: boolean }
export type DesktopWorkspace = {
  read(): Promise<WorkspacePreference>
  choose(): Promise<WorkspacePreference | { canceled: true }>
  reset(): Promise<WorkspacePreference>
  save(request: { documentId: string; filename: string; mimeType: string; bytes: Uint8Array }): Promise<boolean | { saved: boolean; recentError?: string }>
  saveDiagram(request: { filename: string; mimeType: 'application/json'; bytes: Uint8Array }): Promise<{ saved: boolean; filename?: string; recentError?: string }>
  saveDiagramAs(request: { filename: string; mimeType: 'application/json'; bytes: Uint8Array }): Promise<{ saved: boolean; filename?: string; recentError?: string }>
}
declare global { interface Window { desktopWorkspace?: DesktopWorkspace } }

export async function saveWorkspaceExport(blob: Blob, filename: string, documentId: string): Promise<boolean | { saved: boolean; recentError?: string }> {
  if (!window.desktopWorkspace) { download(blob, filename); return true }
  if (blob.size < 1 || blob.size > 64 * 1024 * 1024) throw new Error('Export exceeds desktop byte bounds.')
  return window.desktopWorkspace.save({ documentId, filename, mimeType: blob.type, bytes: new Uint8Array(await blob.arrayBuffer()) })
}

export async function saveWorkspaceDiagram(blob: Blob, filename: string, saveAs = false): Promise<{ saved: boolean; filename?: string; recentError?: string }> {
  // DGM-151: a workbook root may be up to 64 MiB; legacy Diagrams keep their 5 MiB
  // bound in the session before reaching this bridge.
  if (blob.size < 1 || blob.size > 64 * 1024 * 1024) throw new Error('Diagram exceeds desktop byte bounds.')
  if (!window.desktopWorkspace) {
    download(blob, filename)
    return { saved: true, filename }
  }
  const request = { filename, mimeType: 'application/json' as const, bytes: new Uint8Array(await blob.arrayBuffer()) }
  return saveAs ? window.desktopWorkspace.saveDiagramAs(request) : window.desktopWorkspace.saveDiagram(request)
}
