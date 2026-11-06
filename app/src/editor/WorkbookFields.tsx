import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import type { WorkbookMetadataPatch } from '../workbook.ts'

type WorkbookFieldsProps = {
  title: string
  description: string
  titleLimit: number
  descriptionLimit: number
  disabled: boolean
  /** Returns false when the change was refused; the field then reverts to the accepted value. */
  onCommit(patch: WorkbookMetadataPatch): boolean
}

// DGM-151B: workbook title/description are root metadata, separate from the
// active page's title and Markdown. Each field keeps a local draft and commits
// one history step on blur/Enter (Ctrl+Enter for the Markdown description);
// Escape restores the accepted value. IME composition never commits.
export function WorkbookFields(props: WorkbookFieldsProps) {
  return <div className="workbook-fields" role="group" aria-label="Workbook">
    <span className="workbook-fields-heading">Workbook</span>
    <WorkbookDraft label="Workbook title" value={props.title} limit={props.titleLimit} disabled={props.disabled} onCommit={title => props.onCommit({ title })} />
    <WorkbookDraft label="Workbook description (Markdown)" value={props.description} limit={props.descriptionLimit} disabled={props.disabled} multiline onCommit={description => props.onCommit({ description })} />
  </div>
}

function WorkbookDraft({ label, value, limit, disabled, multiline = false, onCommit }: { label: string; value: string; limit: number; disabled: boolean; multiline?: boolean; onCommit(value: string): boolean }) {
  const [draft, setDraft] = useState(value)
  const editing = useRef(false)
  const composing = useRef(false)
  const abandoned = useRef(false)
  // Accepted external changes (undo, load, MCP) replace the draft unless the user is typing.
  useEffect(() => { if (!editing.current) setDraft(value) }, [value])
  function commit() {
    if (composing.current) return
    editing.current = false
    // Escape blurs before React flushes the reverted draft; never commit the stale draft.
    if (abandoned.current) { abandoned.current = false; return }
    if (draft === value) return
    if (!onCommit(draft.slice(0, limit))) setDraft(value)
  }
  function key(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    event.stopPropagation()
    if (event.nativeEvent.isComposing || composing.current) return
    if (event.key === 'Escape') { event.preventDefault(); editing.current = false; abandoned.current = true; setDraft(value); event.currentTarget.blur() }
    if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.blur() }
  }
  const common = {
    'aria-label': label, value: draft, maxLength: limit, disabled,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { editing.current = true; setDraft(event.target.value) },
    onCompositionStart: () => { composing.current = true },
    onCompositionEnd: () => { composing.current = false },
    onBlur: commit, onKeyDown: key,
  }
  return <label className="property workbook-field"><span>{label}</span>{multiline ? <textarea rows={4} {...common} /> : <input {...common} />}</label>
}
