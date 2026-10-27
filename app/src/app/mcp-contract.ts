import type { DocumentCommand, StarterKey } from '../contracts.ts'
import type { Diagram, Direction } from '../model.ts'

export type McpOperation =
  | { name: 'edit_diagram'; arguments: { stateToken: string; commands: Exclude<DocumentCommand, { type: 'applyLayout' }>[] } }
  | { name: 'create_diagram'; arguments: { stateToken: string; template?: StarterKey } }
  | { name: 'arrange_diagram'; arguments: { stateToken: string; direction: Direction } }
  | { name: 'undo'; arguments: { stateToken: string } }
  | { name: 'redo'; arguments: { stateToken: string } }
export type McpDocumentState = { document: Diagram; stateToken: string }
export type McpMutationResult = { ok: true; value: McpDocumentState } | { ok: false; message: string }
export type McpMutationRequest = { id: string; deadline: number; operation: McpOperation }
