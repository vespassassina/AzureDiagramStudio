import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type EditorAction = { label: string; icon: LucideIcon; disabled: boolean; run(): void }

export function CommandMenu({ actions, onCancel, onExecute }: { actions: EditorAction[]; onCancel(): void; onExecute(action: EditorAction): void }) {
  const id = useId()
  const search = useRef<HTMLInputElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const invoked = useRef(false)
  const [query, setQuery] = useState('')
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const results = actions.filter(action => action.label.toLowerCase().includes(query.trim().toLowerCase()))
  const enabled = results.filter(action => !action.disabled)
  const active = enabled.find(action => action.label === activeLabel) ?? enabled[0]
  const activeIndex = results.indexOf(active)
  useLayoutEffect(() => { search.current?.focus() }, [])
  useLayoutEffect(() => { if (activeIndex >= 0) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' }) }, [id, activeIndex, query])
  function execute(action: EditorAction) {
    if (action.disabled || invoked.current) return
    invoked.current = true; onExecute(action)
  }
  return <div className="command-overlay" onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); return }
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const index = enabled.indexOf(active)
      const next = enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]
      setActiveLabel(next?.label ?? null); return
    }
    if (event.key === 'Enter' && event.target === search.current) { event.preventDefault(); if (active) execute(active); return }
    if (event.key === 'Tab') { event.preventDefault(); if (document.activeElement === search.current) close.current?.focus(); else search.current?.focus() }
  }}>
    <button className="command-backdrop" type="button" tabIndex={-1} aria-label="Dismiss commands" onClick={onCancel} />
    <section className="command-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <header><h2 id={`${id}-title`}>Commands</h2><button ref={close} type="button" aria-label="Close commands" title="Close commands" onClick={onCancel}><X size={18} /></button></header>
      <div className="command-filter"><Search size={18} /><input ref={search} role="combobox" aria-label="Filter commands" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setActiveLabel(null) }} /></div>
      <div id={`${id}-list`} role="listbox" aria-label="Available commands" className="command-results">
        {results.map((action, index) => <div key={action.label} id={`${id}-option-${index}`} role="option" aria-label={action.label} aria-selected={action === active} aria-disabled={action.disabled} onMouseDown={event => event.preventDefault()} onClick={() => execute(action)}><action.icon size={18} /><span>{action.label}</span></div>)}
        {!results.length && <div className="command-empty" role="status">No matching commands</div>}
      </div>
    </section>
  </div>
}