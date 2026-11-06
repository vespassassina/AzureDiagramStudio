import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'

export type PageTab = { id: string; title: string }
export type PageTabsProps = {
  pages: PageTab[]
  activeId: string
  presenting: boolean
  editable: boolean
  onSelect(id: string): void
  onAdd(): void
  onRemove(id: string): void
  onRename(id: string, title: string): boolean
  onReorder(ids: string[]): void
}

const PAGE_DRAG_TYPE = 'application/x-diagrammer-page'
const MAX_TITLE = 120
const LOCAL_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'F2', 'Enter', ' ', 'Delete', 'Backspace'])
const pageName = (page: PageTab, index: number) => page.title.trim() || `Page ${index + 1}`

export function movePage(ids: readonly string[], id: string, target: number): string[] {
  const from = ids.indexOf(id)
  if (from < 0) return [...ids]
  const next = ids.filter(candidate => candidate !== id)
  next.splice(Math.max(0, Math.min(next.length, target)), 0, id)
  return next
}

export function PageTabs(props: PageTabsProps) {
  const { pages, activeId, presenting, editable } = props
  const canEdit = editable && !presenting
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const composing = useRef(false)
  const blurredWhileComposing = useRef(false)
  const committing = useRef(false)
  const escaped = useRef(false)
  const strip = useRef<HTMLDivElement>(null)
  const renameInput = useRef<HTMLInputElement>(null)
  const ids = pages.map(page => page.id)

  function tabElement(id: string) { return [...(strip.current?.querySelectorAll<HTMLElement>('[data-page-id]') ?? [])].find(item => item.dataset.pageId === id) }
  function focusTab(index: number) { strip.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[Math.max(0, Math.min(pages.length - 1, index))]?.focus() }
  function startRename(id: string) {
    if (!canEdit) return
    escaped.current = false
    committing.current = false
    setRenaming({ id, draft: pages.find(page => page.id === id)?.title ?? '' })
  }
  function finishRename() {
    if (committing.current) return
    if (escaped.current) { escaped.current = false; return }
    if (!renaming || composing.current) return
    if (props.onRename(renaming.id, renaming.draft.slice(0, MAX_TITLE))) { committing.current = true; setRenaming(null) }
  }
  function cancelRename() { const id = renaming?.id; escaped.current = true; setRenaming(null); if (id) requestAnimationFrame(() => tabElement(id)?.focus()) }
  useLayoutEffect(() => { tabElement(activeId)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }) }, [activeId, pages.length])
  useEffect(() => { if (renaming) { renameInput.current?.focus(); renameInput.current?.select() } }, [renaming?.id])
  useEffect(() => { if (!canEdit) setRenaming(null) }, [canEdit])
  useEffect(() => { if (renaming && !ids.includes(renaming.id)) setRenaming(null) }, [ids.join('\u0000')])

  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number, id: string) {
    if (event.altKey && event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && canEdit) {
      event.preventDefault(); event.stopPropagation()
      const next = movePage(ids, id, index + (event.key === 'ArrowLeft' ? -1 : 1))
      if (next.some((candidate, position) => candidate !== ids[position])) props.onReorder(next)
      return
    }
    const target: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: pages.length - 1 }
    if (event.key in target) { event.preventDefault(); event.stopPropagation(); focusTab(target[event.key]); return }
    if ((event.key === 'F2' || event.key === 'Enter') && canEdit) { event.preventDefault(); event.stopPropagation(); startRename(id) }
  }
  function dragStart(event: DragEvent<HTMLButtonElement>, id: string) {
    if (!canEdit) { event.preventDefault(); return }
    event.dataTransfer.setData(PAGE_DRAG_TYPE, id); event.dataTransfer.effectAllowed = 'move'; setDragging(id)
  }
  function drop(event: DragEvent<HTMLElement>, id: string) {
    if (!canEdit || !event.dataTransfer.types.includes(PAGE_DRAG_TYPE)) return
    event.preventDefault()
    const moved = event.dataTransfer.getData(PAGE_DRAG_TYPE) || dragging
    setDragging(null); setDropTarget(null)
    if (!moved) return
    const next = movePage(ids, moved, ids.indexOf(id))
    if (next.some((candidate, index) => candidate !== ids[index])) props.onReorder(next)
  }

  if (presenting && pages.length < 2) return null
  return <nav className={`page-tabs${presenting ? ' presenting' : ''}`} aria-label="Pages" onKeyDown={event => { if (LOCAL_KEYS.has(event.key) && !event.ctrlKey && !event.metaKey) event.stopPropagation() }}>
    <div ref={strip} className="page-tab-strip" role="tablist" aria-label="Workbook pages" aria-orientation="horizontal">
      {pages.map((page, index) => renaming?.id === page.id
        ? <span key={page.id} className="page-tab renaming" data-page-id={page.id}><input ref={renameInput} aria-label="Page title" value={renaming.draft} maxLength={MAX_TITLE}
          onChange={event => setRenaming({ id: page.id, draft: event.target.value })} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false; if (blurredWhileComposing.current) { blurredWhileComposing.current = false; queueMicrotask(finishRename) } }}
          onKeyDown={event => { event.stopPropagation(); if (event.nativeEvent.isComposing || composing.current) return; if (event.key === 'Enter') { event.preventDefault(); finishRename() } if (event.key === 'Escape') { event.preventDefault(); cancelRename() } }}
          onBlur={() => { if (composing.current) blurredWhileComposing.current = true; else finishRename() }} /></span>
        : <div key={page.id} className={`page-tab-wrap${dragging === page.id ? ' dragging' : ''}${dropTarget === page.id && dragging !== page.id ? ' drop-target' : ''}`} data-page-id={page.id}
          onDragOver={event => { if (canEdit && dragging && event.dataTransfer.types.includes(PAGE_DRAG_TYPE)) { event.preventDefault(); setDropTarget(page.id) } }} onDrop={event => drop(event, page.id)}>
          <button type="button" role="tab" className={`page-tab${page.id === activeId ? ' active' : ''}`} aria-selected={page.id === activeId} tabIndex={page.id === activeId ? 0 : -1} title={pageName(page, index)}
            draggable={canEdit} onDragStart={event => dragStart(event, page.id)} onDragEnd={() => { setDragging(null); setDropTarget(null) }} onClick={() => props.onSelect(page.id)} onDoubleClick={() => startRename(page.id)} onKeyDown={event => tabKey(event, index, page.id)}><span className="page-tab-label">{pageName(page, index)}</span></button>
          {!presenting && <button type="button" className="page-tab-close" aria-label={pages.length === 1 ? 'Cannot remove the last page' : `Remove ${pageName(page, index)}`} title={pages.length === 1 ? 'A workbook must keep one page' : `Remove ${pageName(page, index)}`} disabled={!canEdit || pages.length === 1}
            onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); props.onRemove(page.id) }}><X size={14} /></button>}
        </div>)}
      {!presenting && <button type="button" className="page-tab-action page-tab-add" aria-label="Add diagram" title="Add diagram" disabled={!canEdit || pages.length >= 100} onClick={props.onAdd}><Plus size={15}/></button>}
    </div>
  </nav>
}
