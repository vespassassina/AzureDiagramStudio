import { validateDocument } from './document/index.ts'
import { MAX_BYTES, inspectJson, isRecord, isStableId } from './document/validation.ts'
import { createDocument } from './model.ts'
import type { Diagram } from './model.ts'
import type { Result } from './contracts.ts'

export const MAX_WORKBOOK_BYTES = 64 * 1024 * 1024
export const MAX_WORKBOOK_PAGES = 100
export const MAX_WORKBOOK_TITLE = 120
export const MAX_WORKBOOK_DESCRIPTION = 60000

/** A persisted workbook is deliberately an envelope, never a Diagram extension. */
export type Workbook = {
  kind: 'workbook'
  schemaVersion: 1
  id: string
  title: string
  description?: string
  revision: number
  pages: Diagram[]
}
/** The persisted root: a legacy single Diagram stays a Diagram until explicitly promoted. */
export type WorkspaceDocument = Diagram | Workbook
export type WorkspaceHistory = { past: WorkspaceDocument[]; present: WorkspaceDocument; future: WorkspaceDocument[] }
export type WorkbookMetadataPatch = { title?: string; description?: string }

const fail = (path: string, message: string): Result<never> => ({ ok: false, errors: [{ path, message }] })
const byteLength = (value: string) => new TextEncoder().encode(value).byteLength

export function isWorkbook(value: WorkspaceDocument): value is Workbook {
  return 'kind' in value && (value as { kind?: unknown }).kind === 'workbook'
}

// Pseudocode:
// 1. Count raw bytes against the 64 MiB root bound before copying anything
//    (descriptor walk; no getters, toJSON hooks or prototype tricks run).
// 2. Require the exact workbook envelope; unknown fields or versions fail.
// 3. Validate each complete page with the 5 MiB page bound and the existing
//    Diagram validator; reject the whole root for any invalid or duplicate page.
// 4. Return only normalized data; callers keep UI state (active page, camera) separately.
export function validateWorkbook(input: unknown): Result<Workbook> {
  const inspection = inspectJson(input, MAX_WORKBOOK_BYTES)
  if (inspection) return { ok: false, errors: [inspection.message.includes('MiB') ? { path: '$', message: 'Workbook exceeds the 64 MiB limit' } : inspection] }
  if (!isRecord(input)) return fail('$', 'Expected a workbook object')
  const allowed = ['kind', 'schemaVersion', 'id', 'title', 'description', 'revision', 'pages']
  for (const key of Object.keys(input)) if (!allowed.includes(key)) return fail(`$.${key}`, 'Unsupported workbook field')
  if (input.kind !== 'workbook') return fail('$.kind', 'Unsupported document kind')
  if (input.schemaVersion !== 1) return fail('$.schemaVersion', 'Unsupported workbook schema version')
  if (!isStableId(input.id)) return fail('$.id', 'Expected a stable workbook ID')
  if (typeof input.title !== 'string' || input.title.length > MAX_WORKBOOK_TITLE) return fail('$.title', 'Expected title of at most 120 characters')
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > MAX_WORKBOOK_DESCRIPTION)) return fail('$.description', 'Expected description of at most 60000 characters')
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0) return fail('$.revision', 'Expected a nonnegative safe integer revision')
  if (!Array.isArray(input.pages) || input.pages.length < 1 || input.pages.length > MAX_WORKBOOK_PAGES) return fail('$.pages', 'Expected 1 to 100 complete pages')
  const pages: Diagram[] = []
  const ids = new Set<string>()
  for (const [index, raw] of input.pages.entries()) {
    const pageInspection = inspectJson(raw)
    if (pageInspection) return fail(`$.pages[${index}]`, pageInspection.message.includes('MiB') ? 'Page exceeds the 5 MiB limit' : pageInspection.message)
    const parsed = validateDocument(raw)
    if (!parsed.ok) return { ok: false, errors: parsed.errors.map(error => ({ path: `$.pages[${index}]${error.path === '$' ? '' : error.path.startsWith('$') ? error.path.slice(1) : `.${error.path}`}`, message: error.message })) }
    if (ids.has(parsed.value.id)) return fail(`$.pages[${index}].id`, 'Duplicate page ID')
    ids.add(parsed.value.id); pages.push(parsed.value)
  }
  return { ok: true, value: { kind: 'workbook', schemaVersion: 1, id: input.id as string, title: input.title, ...(input.description === undefined ? {} : { description: input.description as string }), revision: input.revision as number, pages } }
}

/**
 * Validates either persisted root. Any object carrying a `kind` field must be a
 * supported workbook; everything else keeps the unchanged legacy Diagram path
 * (including its 5 MiB bound), so legacy files never silently become workbooks.
 */
export function validateWorkspace(input: unknown): Result<WorkspaceDocument> {
  if (isRecord(input) && Object.prototype.hasOwnProperty.call(input, 'kind')) return validateWorkbook(input)
  return validateDocument(input)
}

export function parseWorkspace(text: string): Result<WorkspaceDocument> {
  if (typeof text !== 'string') return fail('$', 'Expected JSON text')
  if (text.length > MAX_WORKBOOK_BYTES || byteLength(text) > MAX_WORKBOOK_BYTES) return fail('$', 'Workbook exceeds the 64 MiB limit')
  let value: unknown
  try { value = JSON.parse(text) } catch (error) { return fail('$', `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`) }
  if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'kind')) return validateWorkbook(value)
  if (byteLength(text) > MAX_BYTES) return fail('$', 'JSON exceeds the 5 MiB limit')
  return validateDocument(value)
}

export function createWorkbook(id: string, pageId: string, title = 'Untitled workbook'): Workbook {
  return { kind: 'workbook', schemaVersion: 1, id, title: title.slice(0, MAX_WORKBOOK_TITLE), revision: 0, pages: [createDocument(pageId)] }
}
/** Explicit promotion keeps the legacy Diagram as page one, unchanged by identity. */
export function promoteWorkbook(id: string, document: Diagram): Workbook {
  return { kind: 'workbook', schemaVersion: 1, id, title: document.title.slice(0, MAX_WORKBOOK_TITLE), revision: 0, pages: [document] }
}

// History uses object identity: every root edit produces a new root that shares
// unchanged page objects, so comparing 64 MiB roots by serialization is avoided.
export function workspaceHistory(document: WorkspaceDocument): WorkspaceHistory { return { past: [], present: document, future: [] } }
export function workspaceCommit(history: WorkspaceHistory, next: WorkspaceDocument): WorkspaceHistory {
  return history.present === next ? history : { past: [...history.past, history.present].slice(-100), present: next, future: [] }
}
export function workspaceUndo(history: WorkspaceHistory): WorkspaceHistory {
  return history.past.length ? { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] } : history
}
export function workspaceRedo(history: WorkspaceHistory): WorkspaceHistory {
  return history.future.length ? { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) } : history
}

export function workspacePages(root: WorkspaceDocument): Diagram[] { return isWorkbook(root) ? root.pages : [root] }
export function hasPage(root: WorkspaceDocument, id: string | undefined): boolean {
  return id !== undefined && workspacePages(root).some(page => page.id === id)
}
/** Resolves the requested page, or the first page when the ID is absent/stale. */
export function activePage(root: WorkspaceDocument, id?: string): Diagram {
  if (!isWorkbook(root)) return root
  return root.pages.find(candidate => candidate.id === id) ?? root.pages[0]
}
export function workspaceTitle(root: WorkspaceDocument): string { return root.title }

/** Replaces one page; other page objects are shared and the root revision advances. */
export function updateWorkbookPage(root: Workbook, pageId: string, next: Diagram): Workbook {
  const index = root.pages.findIndex(page => page.id === pageId)
  if (index < 0) throw new Error('Unknown workbook page')
  if (root.pages[index] === next) return root
  if (next.id !== pageId) throw new Error('A page command cannot change the page ID')
  const pages = root.pages.slice(); pages[index] = next
  return { ...root, revision: root.revision + 1, pages }
}
/** Applies a single-page result to either root shape without touching other pages. */
export function replaceWorkspacePage(root: WorkspaceDocument, pageId: string, next: Diagram): WorkspaceDocument {
  if (isWorkbook(root)) return updateWorkbookPage(root, pageId, next)
  if (root.id !== pageId) throw new Error('Unknown workbook page')
  return next
}
export function reorderWorkbookPages(root: Workbook, order: readonly string[]): Workbook {
  if (order.length !== root.pages.length || new Set(order).size !== order.length || order.some(id => !root.pages.some(page => page.id === id))) throw new Error('Page order must be an exact permutation')
  if (order.every((id, index) => root.pages[index].id === id)) return root
  const pages = order.map(id => root.pages.find(page => page.id === id)!)
  return { ...root, revision: root.revision + 1, pages }
}
export function addWorkbookPage(root: Workbook, page: Diagram, index = root.pages.length): Workbook {
  if (root.pages.length >= MAX_WORKBOOK_PAGES) throw new Error('A workbook can hold at most 100 pages')
  if (!isStableId(page.id) || root.pages.some(candidate => candidate.id === page.id)) throw new Error('Page ID must be unique')
  const at = Math.max(0, Math.min(root.pages.length, index))
  return { ...root, revision: root.revision + 1, pages: [...root.pages.slice(0, at), page, ...root.pages.slice(at)] }
}
export function updateWorkbookMetadata(root: Workbook, patch: WorkbookMetadataPatch): Workbook {
  if (patch.title !== undefined && (typeof patch.title !== 'string' || patch.title.length > MAX_WORKBOOK_TITLE)) throw new Error('Workbook title must be at most 120 characters')
  if (patch.description !== undefined && (typeof patch.description !== 'string' || patch.description.length > MAX_WORKBOOK_DESCRIPTION)) throw new Error('Workbook description must be at most 60000 characters')
  const title = patch.title ?? root.title
  const description = patch.description === undefined ? root.description : patch.description || undefined
  if (title === root.title && description === root.description) return root
  const { description: _previous, ...rest } = root
  return { ...rest, title, ...(description === undefined ? {} : { description }), revision: root.revision + 1 }
}

/** Page IDs whose content object changed between two roots, in the newer root's order. */
export function changedPageIds(before: WorkspaceDocument, after: WorkspaceDocument): string[] {
  const previous = new Map(workspacePages(before).map(page => [page.id, page]))
  return workspacePages(after).filter(page => previous.get(page.id) !== page).map(page => page.id)
}
