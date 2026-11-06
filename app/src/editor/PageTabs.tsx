import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'

export type PageTab = { id: string; title: string }
export type PageTabsProps = {
  pages: PageTab[]
  activeId: string
  /** Present mode: tabs navigate only; add/rename/reorder controls are hidden. */
  presenting: boolean
  /** False when read-only, loading or otherwise not editable. */
  editable: boolean
  onSelect(id: string): void
  onAdd(): void
  /** Returns false when the rename was refused; the draft then stays open. */
  onRename(id: string, title: string): boolean
  onReorder(ids: string[]): void
}

const PAGE_DRAG_TYPE = 'application/x-diagrammer-page'
const MAX_TITLE = 120
const LOCAL_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Delete', 'Backspace', 'F2', 'Enter', ' ', 'ContextMenu', 'F10'])
const pageName = (page: PageTab, index: number) => page.title.trim() || `Page ${index + 1}`

/** Moves `id` to `target` and returns the exact new permutation (unchanged order for no-ops). */
export function movePage(ids: readonly string[], id: string, target: number): string[] {
  const from = ids.indexOf(id)
  if (from < 0) return [...ids]
  const to = Math.max(0, Math.min(ids.length - 1, target))
  const next = ids.filter(candidate => candidate !== id)
  next.splice(to, 0, id)
  return next
}

// Bottom page tabs (DGM-151B). One home for page navigation and page-level
// editing: select, add, rename, drag reorder and accessible move left/right.
// The strip scrolls horizontally instead of wrapping, so the canvas keeps its
// height at narrow widths. No delete/duplicate/close in this slice.
export function PageTabs(props: PageTabsProps) {
  const { pages, activeId, presenting, editable } = props
  const canEdit = editable && !presenting
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const composing = useRef(false)
  // Escape abandons the draft; a blur caused by the input unmounting must not commit it.
  const abandoned = useRef(false)
  const strip = useRef<HTMLDivElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const renameInput = useRef<HTMLInputElement>(null)
  const ids = pages.map(page => page.id)
  const activeIndex = Math.max(0, ids.indexOf(activeId))

  // Keep the active tab visible in the overflowing strip.
  useLayoutEffect(() => {
    const tab = tabElement(activeId)
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeId, pages.length])
  useEffect(() => { if (renaming) { renameInput.current?.focus(); renameInput.current?.select() } }, [renaming?.id])
  // Leaving edit mode (Present, read-only) abandons an open rename draft explicitly.
  useEffect(() => { if (!canEdit) { setRenaming(null); setMenuOpen(false) } }, [canEdit])
  useEffect(() => { if (renaming && !ids.includes(renaming.id)) setRenaming(null) }, [ids.join('\u0000')])
  useEffect(() => {
    if (!menuOpen) return
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && event.target !== menuButton.current) setMenuOpen(false) }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [menuOpen])

  function tabElement(id: string) {
    return [...(strip.current?.querySelectorAll<HTMLElement>('[data-page-id]') ?? [])].find(element => element.dataset.pageId === id)
  }
  function focusTab(index: number) {
    const tabs = strip.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[Math.max(0, Math.min((tabs?.length ?? 1) - 1, index))]?.focus()
  }
  function startRename(id: string) {
    if (!canEdit) return
    setMenuOpen(false)
    abandoned.current = false
    setRenaming({ id, draft: pages.find(page => page.id === id)?.title ?? '' })
  }
  function commitRename() {
    if (abandoned.current) { abandoned.current = false; return }
    if (!renaming || composing.current) return
    if (props.onRename(renaming.id, renaming.draft.slice(0, MAX_TITLE))) {
      const id = renaming.id
      setRenaming(null)
      requestAnimationFrame(() => tabElement(id)?.focus())
    }
  }
  function cancelRename() {
    const id = renaming?.id
    abandoned.current = true
    setRenaming(null)
    if (id) requestAnimationFrame(() => tabElement(id)?.focus())
  }
  function move(delta: -1 | 1) {
    setMenuOpen(false)
    const next = movePage(ids, activeId, activeIndex + delta)
    if (next.some((id, index) => id !== ids[index])) props.onReorder(next)
    menuButton.current?.focus()
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number, id: string) {
    const targets: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: pages.length - 1 }
    if (event.key in targets) { event.preventDefault(); event.stopPropagation(); focusTab(targets[event.key]); return }
    if (event.key === 'F2' && canEdit) { event.preventDefault(); event.stopPropagation(); startRename(id) }
  }
  function dragStart(event: DragEvent<HTMLButtonElement>, id: string) {
    if (!canEdit) { event.preventDefault(); return }
    event.dataTransfer.setData(PAGE_DRAG_TYPE, id)
    event.dataTransfer.effectAllowed = 'move'
    setDragging(id)
  }
  function dragOver(event: DragEvent<HTMLElement>, id: string) {
    if (!canEdit || !dragging || !event.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget(id)
  }
  function drop(event: DragEvent<HTMLElement>, id: string) {
    if (!canEdit || !event.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return
    event.preventDefault()
    const moved = event.dataTransfer.getData(PAGE_DRAG_TYPE) || dragging
    setDragging(null); setDropTarget(null)
    if (!moved || !ids.includes(moved)) return
    const next = movePage(ids, moved, ids.indexOf(id))
    if (next.some((candidate, index) => candidate !== ids[index])) props.onReorder(next)
  }

  if (presenting && pages.length < 2) return null
  // Canvas shortcuts (nudge, Delete, F2 label edit, context menu) must not act on the
  // canvas selection while focus is in the page strip; Escape and Ctrl shortcuts still reach the editor.
  return <nav className={`page-tabs${presenting ? ' presenting' : ''}`} aria-label="Pages"
    onKeyDown={event => { if (LOCAL_KEYS.has(event.key) && !event.ctrlKey && !event.metaKey) event.stopPropagation() }}>
    <div ref={strip} className="page-tab-strip" role="tablist" aria-label="Workbook pages" aria-orientation="horizontal">
      {pages.map((page, index) => {
        const active = page.id === activeId
        if (renaming?.id === page.id) return <span key={page.id} className="page-tab renaming" data-page-id={page.id}>
          <input ref={renameInput} aria-label="Page title" value={renaming.draft} maxLength={MAX_TITLE}
            onChange={event => setRenaming({ id: page.id, draft: event.target.value })}
            onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
            onKeyDown={event => {
              event.stopPropagation()
              if (event.nativeEvent.isComposing || composing.current) return
              if (event.key === 'Enter') { event.preventDefault(); commitRename() }
              if (event.key === 'Escape') { event.preventDefault(); cancelRename() }
            }}
            onBlur={() => commitRename()} />
        </span>
        return <button key={page.id} type="button" role="tab" data-page-id={page.id} id={`page-tab-${page.id}`}
          className={`page-tab${active ? ' active' : ''}${dragging === page.id ? ' dragging' : ''}${dropTarget === page.id && dragging !== page.id ? ' drop-target' : ''}`}
          aria-selected={active} tabIndex={active ? 0 : -1} title={pageName(page, index)}
          draggable={canEdit} onDragStart={event => dragStart(event, page.id)} onDragEnd={() => { setDragging(null); setDropTarget(null) }}
          onDragOver={event => dragOver(event, page.id)} onDragLeave={() => setDropTarget(current => current === page.id ? null : current)} onDrop={event => drop(event, page.id)}
          onClick={() => props.onSelect(page.id)} onDoubleClick={() => startRename(page.id)} onKeyDown={event => tabKey(event, index, page.id)}>
          <span className="page-tab-label">{pageName(page, index)}</span>
        </button>
      })}
    </div>
    {!presenting && <div className="page-tab-actions">
      <button type="button" className="page-tab-action" aria-label="Add page" title="Add page" disabled={!canEdit || pages.length >= 100} onClick={props.onAdd}><Plus size={15} /></button>
      <button ref={menuButton} type="button" className="page-tab-action" aria-label="Page actions" title="Page actions" aria-haspopup="menu" aria-expanded={menuOpen} disabled={!canEdit}
        onClick={() => setMenuOpen(open => !open)}><MoreHorizontal size={15} /></button>
      {menuOpen && <div ref={menu} className="page-tab-menu" role="menu" aria-label="Page actions"
        onKeyDown={event => {
          event.stopPropagation()
          const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
          const at = items.indexOf(document.activeElement as HTMLButtonElement)
          if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); menuButton.current?.focus() }
          if (event.key === 'ArrowDown') { event.preventDefault(); items[(at + 1) % items.length]?.focus() }
          if (event.key === 'ArrowUp') { event.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus() }
        }}>
        <button type="button" role="menuitem" onClick={() => startRename(activeId)}>Rename page</button>
        <button type="button" role="menuitem" disabled={activeIndex <= 0} onClick={() => move(-1)}>Move page left</button>
        <button type="button" role="menuitem" disabled={activeIndex >= pages.length - 1} onClick={() => move(1)}>Move page right</button>
      </div>}
    </div>}
  </nav>
}
