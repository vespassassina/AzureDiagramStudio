import type { DocumentCommand } from './contracts.ts'
import { isStableId } from './document/validation.ts'

export type WorkbookEditCommand =
  | { type: 'newWorkbook'; id: string; pageId: string; title?: string }
  | { type: 'addPage'; pageId: string; title?: string }
  | { type: 'renamePage'; pageId: string; title: string }
  | { type: 'reorderPages'; pageIds: string[] }
  | { type: 'workbookMetadata'; title?: string; description?: string }
  | { type: 'pageCommand'; pageId: string; command: DocumentCommand }

const pageId = isStableId
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Boundary validator shared by the UI/session adapter and MCP dispatcher. */
export function validateWorkbookEdit(value: unknown): value is WorkbookEditCommand[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return false
  return value.every(command => {
    if (!plain(command) || typeof command.type !== 'string') return false
    if (command.type === 'newWorkbook') return pageId(command.id) && pageId(command.pageId) && (command.title === undefined || typeof command.title === 'string' && command.title.length <= 120)
    if (command.type === 'addPage') return pageId(command.pageId) && (command.title === undefined || typeof command.title === 'string' && command.title.length <= 120)
    if (command.type === 'renamePage') return pageId(command.pageId) && typeof command.title === 'string' && command.title.length <= 120
    if (command.type === 'reorderPages') return Array.isArray(command.pageIds) && command.pageIds.length > 0 && command.pageIds.length <= 100 && command.pageIds.every(pageId) && new Set(command.pageIds).size === command.pageIds.length
    if (command.type === 'workbookMetadata') return Object.keys(command).every(key => ['type', 'title', 'description'].includes(key)) && (command.title === undefined || typeof command.title === 'string' && command.title.length <= 120) && (command.description === undefined || typeof command.description === 'string' && command.description.length <= 60000) && (command.title !== undefined || command.description !== undefined)
    return command.type === 'pageCommand' && pageId(command.pageId) && plain(command.command)
  })
}

export const workbookMcpSchemas = Object.freeze({
  get_workbook: { type: 'object', properties: {}, additionalProperties: false },
  edit_workbook: { type: 'object', properties: { stateToken: { type: 'string', minLength: 1, maxLength: 256 }, commands: { type: 'array', minItems: 1, maxItems: 100 } }, required: ['stateToken', 'commands'], additionalProperties: false },
  export_workbook: { type: 'object', properties: { stateToken: { type: 'string', minLength: 1, maxLength: 256 }, scope: { enum: ['page', 'workbook'] }, pageId: { type: 'string', maxLength: 128 }, format: { enum: ['json', 'svg', 'png', 'markdown', 'zip', 'pdf', 'vsdx'] } }, required: ['stateToken', 'scope', 'format'], additionalProperties: false },
})
