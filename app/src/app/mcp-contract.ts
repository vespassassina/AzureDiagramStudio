import type { DocumentCommand, StarterKey } from '../contracts.ts'
import type { Diagram, Direction } from '../model.ts'

export type McpOperation =
  | { name: 'edit_diagram'; arguments: { stateToken: string; commands: Exclude<DocumentCommand, { type: 'applyLayout' }>[] } }
  | { name: 'create_diagram'; arguments: { stateToken: string; template?: StarterKey } }
  | { name: 'arrange_diagram'; arguments: { stateToken: string; direction: Direction; arrangement?: import('../layout.ts').LayoutArrangement } }
  | { name: 'undo'; arguments: { stateToken: string } }
  | { name: 'redo'; arguments: { stateToken: string } }
export type McpDocumentState = { document: Diagram; stateToken: string }
export type McpMutationResult = { ok: true; value: McpDocumentState } | { ok: false; message: string }
export type McpMutationRequest = { id: string; deadline: number; operation: McpOperation }
export type McpOutputOperation =
  | { name: 'snapshot_diagram'; arguments: { stateToken: string } }
  | { name: 'export_diagram'; arguments: { stateToken: string; format: 'png' | 'svg' | 'json' | 'markdown'; scale?: 1 | 2; transparent?: boolean; background?: 'diagram' | 'white'; aspect?: 'content' | '16:9'; includeGrid?: boolean; includeMarkdown?: boolean } }
export type McpOutputContent = { type: 'image'; mimeType: string; data: string; resource?: never } | {
  type: 'resource'; resource: { uri: string; mimeType: string; text?: string; blob?: string }
}
export type McpOutput = { content: [McpOutputContent, { type: 'text'; text: string }] }
export type McpOutputResult = { ok: true; output: McpOutput } | { ok: false; message: string }
/** DGM-151D workbook tools. Tokens are opaque: one per root, one per page. */
export type McpWorkbookEditCommand = import('../workbook-api.ts').WorkbookEditCommand
export type McpWorkbookOperation =
  | { name: 'get_workbook'; arguments: Record<string, never> }
  | { name: 'edit_workbook'; arguments: { stateToken: string; commands: McpWorkbookEditCommand[] } }
  | { name: 'export_workbook'; arguments: { stateToken: string; scope: 'page'; pageId: string; format: 'json' | 'svg' | 'png' | 'markdown' | 'pdf' | 'vsdx' } | { stateToken: string; scope: 'workbook'; format: 'json' | 'zip' | 'pdf' | 'vsdx' } }
export type McpWorkbookState = {
  kind: 'diagram' | 'workbook'; id: string; title: string; description?: string; revision: number
  activePageId: string; stateToken: string; pages: { id: string; title: string; stateToken: string }[]
}
export type McpWorkbookResult = { ok: true; value: McpWorkbookState } | { ok: true; output: McpOutput } | { ok: false; message: string }
export type McpRequest = { id: string; deadline: number; operation: McpOperation | McpOutputOperation | McpWorkbookOperation }
