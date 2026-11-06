import { describe, expect, it } from 'vitest'
import { createDocument } from './model.ts'
import { addWorkbookPage, changedPageIds, createWorkbook, MAX_WORKBOOK_PAGES, parseWorkspace, promoteWorkbook, reorderWorkbookPages, updateWorkbookMetadata, updateWorkbookPage, validateWorkbook, validateWorkspace, workspaceCommit, workspaceHistory, workspaceUndo } from './workbook.ts'

describe('workbook', () => {
  it('should_reject_duplicate_page_ids_when_validating_a_workbook', () => {
    const page = createDocument('page')
    expect(validateWorkbook({ kind: 'workbook', schemaVersion: 1, id: 'book', title: 'Book', revision: 0, pages: [page, page] }).ok).toBe(false)
  })
  it('should_change_only_the_updated_page_when_committing_a_page_edit', () => {
    const first = createDocument('first'), second = createDocument('second')
    const root = promoteWorkbook('book', first)
    const withSecond = { ...root, pages: [first, second] }
    const next = updateWorkbookPage(withSecond, 'first', { ...first, title: 'Changed', revision: 1 })
    expect(next.pages[1]).toBe(second)
    expect(next.revision).toBe(1)
  })
  it('should_require_an_exact_page_permutation_when_reordering', () => {
    const first = createDocument('first'), second = createDocument('second')
    const root = { ...promoteWorkbook('book', first), pages: [first, second] }
    expect(() => reorderWorkbookPages(root, ['first'])).toThrow('exact permutation')
  })
  it('should_keep_legacy_diagram_as_diagram_when_parsing_without_kind_DGM151A', () => {
    const page = createDocument('legacy')
    const parsed = parseWorkspace(JSON.stringify(page))
    expect(parsed.ok && !('kind' in parsed.value)).toBe(true)
  })
  it('should_fail_whole_input_when_kind_or_schema_version_is_unknown_DGM151A', () => {
    const page = createDocument('page')
    expect(validateWorkspace({ kind: 'notebook', schemaVersion: 1, id: 'book', title: 'Book', revision: 0, pages: [page] }).ok).toBe(false)
    expect(validateWorkspace({ kind: 'workbook', schemaVersion: 2, id: 'book', title: 'Book', revision: 0, pages: [page] }).ok).toBe(false)
    expect(validateWorkspace({ kind: 'workbook', schemaVersion: 1, id: 'book', title: 'Book', revision: 0, pages: [page], extra: true }).ok).toBe(false)
  })
  it('should_reject_empty_and_over_limit_page_counts_DGM151A', () => {
    const base = { kind: 'workbook', schemaVersion: 1, id: 'book', title: 'Book', revision: 0 }
    expect(validateWorkbook({ ...base, pages: [] }).ok).toBe(false)
    const many = Array.from({ length: MAX_WORKBOOK_PAGES + 1 }, (_, index) => createDocument(`page${index}`))
    expect(validateWorkbook({ ...base, pages: many }).ok).toBe(false)
  })
  it('should_reject_a_page_over_five_mebibytes_even_when_root_fits_DGM151A', () => {
    const page = { ...createDocument('big'), description: 'x'.repeat(5 * 1024 * 1024) }
    expect(validateWorkbook({ kind: 'workbook', schemaVersion: 1, id: 'book', title: 'Book', revision: 0, pages: [page] }).ok).toBe(false)
  })
  it('should_bound_legacy_diagram_text_at_five_mebibytes_but_workbook_text_at_sixty_four_DGM151A', () => {
    // Whitespace padding grows the raw text without changing either parsed value.
    const pad = ' '.repeat(5 * 1024 * 1024 + 1)
    const legacy = parseWorkspace(JSON.stringify(createDocument('legacy')) + pad)
    expect(legacy.ok).toBe(false)
    if (!legacy.ok) expect(legacy.errors[0]!.message).toMatch(/5 MiB/)
    const root = addWorkbookPage(createWorkbook('book', 'one'), createDocument('two'))
    const workbook = parseWorkspace(JSON.stringify(root) + pad)
    expect(workbook.ok && workbook.value).toEqual(root)
    const oversized = parseWorkspace(JSON.stringify(root) + ' '.repeat(64 * 1024 * 1024))
    expect(oversized.ok).toBe(false)
    if (!oversized.ok) expect(oversized.errors[0]!.message).toMatch(/64 MiB/)
  })
  it('should_round_trip_a_valid_workbook_through_parse_DGM151A', () => {
    const root = addWorkbookPage(createWorkbook('book', 'one', 'Plan'), createDocument('two'))
    const parsed = parseWorkspace(JSON.stringify(root))
    expect(parsed.ok && parsed.value).toEqual(root)
  })
  it('should_share_untouched_pages_and_report_only_changed_page_DGM151A', () => {
    const root = addWorkbookPage(createWorkbook('book', 'one'), createDocument('two'))
    const next = updateWorkbookPage(root, 'two', { ...root.pages[1], title: 'Changed', revision: 1 })
    expect(next.pages[0]).toBe(root.pages[0])
    expect(changedPageIds(root, next)).toEqual(['two'])
  })
  it('should_return_same_root_for_noop_reorder_and_metadata_so_history_is_unchanged_DGM151A', () => {
    const root = addWorkbookPage(createWorkbook('book', 'one'), createDocument('two'))
    const history = workspaceHistory(root)
    expect(workspaceCommit(history, reorderWorkbookPages(root, ['one', 'two']))).toBe(history)
    expect(workspaceCommit(history, updateWorkbookMetadata(root, { title: root.title }))).toBe(history)
  })
  it('should_advance_root_revision_and_undo_structural_change_DGM151A', () => {
    const root = addWorkbookPage(createWorkbook('book', 'one'), createDocument('two'))
    const reordered = reorderWorkbookPages(root, ['two', 'one'])
    expect(reordered.revision).toBe(root.revision + 1)
    expect(workspaceUndo(workspaceCommit(workspaceHistory(root), reordered)).present).toBe(root)
  })
  it('should_reject_duplicate_added_page_and_overlong_metadata_DGM151A', () => {
    const root = createWorkbook('book', 'one')
    expect(() => addWorkbookPage(root, createDocument('one'))).toThrow('unique')
    expect(() => updateWorkbookMetadata(root, { title: 'x'.repeat(121) })).toThrow()
    const described = updateWorkbookMetadata(root, { description: '# Notes' })
    expect(described.description).toBe('# Notes')
    expect('description' in updateWorkbookMetadata(described, { description: '' })).toBe(false)
  })})
