import { download } from '../export.ts'

export type WorkspacePreference = { root: string; isDefault: boolean }
export type DesktopWorkspace = {
  read(): Promise<WorkspacePreference>
  choose(): Promise<WorkspacePreference | { canceled: true }>
  reset(): Promise<WorkspacePreference>
  save(request: { documentId: string; filename: string; mimeType: string; bytes: Uint8Array }): Promise<boolean>
}
declare global { interface Window { desktopWorkspace?: DesktopWorkspace } }

export async function saveWorkspaceExport(blob: Blob, filename: string, documentId: string): Promise<boolean> {
  if (!window.desktopWorkspace) { download(blob, filename); return true }
  if (blob.size < 1 || blob.size > 64 * 1024 * 1024) throw new Error('Export exceeds desktop byte bounds.')
  return window.desktopWorkspace.save({ documentId, filename, mimeType: blob.type, bytes: new Uint8Array(await blob.arrayBuffer()) })
}
