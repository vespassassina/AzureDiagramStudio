import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, X } from 'lucide-react'
import type { Diagram } from '../model.ts'
import type { ExportOptions, ExportSceneOptions } from '../contracts.ts'
import { buildExportScene, pngDimensions, renderSvg } from '../scene.ts'
import { visualAssets } from '../assets.ts'

export type ExportPreset = ExportSceneOptions & { scope?: 'all' | 'selection'; transparent?: boolean }
type Props = {
  document: Diagram; selectedIds: string[]; preset: ExportPreset; busy: boolean
  onPreset(preset: ExportPreset): void; onClose(reason?: 'escape'): void
  onExport(options: ExportOptions): void; onCopyImage?(options: ExportOptions): void
}

export function ExportDialog(props: Props) {
  const id = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const invoked = useRef(false)
  const [error, setError] = useState('')
  const { scope, transparent = false, ...settings } = props.preset
  const options: ExportSceneOptions = { ...settings, ...(scope === 'selection' ? { selectionIds: [...props.selectedIds] } : {}) }
  const selectionKey = props.selectedIds.join('\n')
  const output = useMemo(() => {
    try {
      const scene = buildExportScene(props.document, { ...settings, ...(scope === 'selection' ? { selectionIds: [...props.selectedIds] } : {}) })
      return { scene, svg: renderSvg(scene, visualAssets, transparent), error: '' }
    } catch (failure) { return { scene: null, svg: '', error: failure instanceof Error ? failure.message : 'Export preview unavailable.' } }
  }, [props.document, props.preset, selectionKey])
  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  function update(patch: Partial<ExportPreset>) { setError(''); props.onPreset({ ...props.preset, ...patch }) }
  function pngError(scale: 1 | 2) {
    if (!output.scene) return output.error
    try { pngDimensions(output.scene, scale); return '' }
    catch (failure) { return failure instanceof Error ? failure.message : 'PNG size limit exceeded.' }
  }
  function invoke(format: 'svg' | 'png', scale: 1 | 2, copy = false) {
    if (props.busy || invoked.current || !output.scene || (format === 'png' && pngError(scale))) return
    invoked.current = true; setError('')
    try {
      const capture = { format, scale, transparent, ...options }
      if (copy) props.onCopyImage?.(capture)
      else props.onExport(capture)
      props.onClose()
    } catch (failure) {
      invoked.current = false
      setError(failure instanceof Error ? failure.message : 'Export request failed.')
    }
  }
  const background = transparent ? 'transparent' : settings.background ?? 'diagram'
  return <div className="export-overlay" onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); props.onClose('escape') }
    if (event.key !== 'Tab') return
    const targets = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? [])
    const first = targets[0], last = targets.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <button type="button" className="export-backdrop" aria-label="Close export menu" tabIndex={-1} onClick={() => props.onClose()} />
    <div ref={dialog} className="export-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-busy={props.busy}>
      <header className="export-heading"><h2 id={`${id}-title`}>Export diagram</h2><button type="button" aria-label="Cancel export" title="Cancel export" onClick={() => props.onClose()}><X size={18} /></button></header>
      <div className="export-preview" role="img" aria-label="Export preview" dangerouslySetInnerHTML={{ __html: output.svg }} />
      <fieldset className="export-segments"><legend>Scope</legend>{(['all', 'selection'] as const).map(value => <label key={value}><input type="radio" name={`${id}-scope`} checked={(scope ?? 'all') === value} disabled={props.busy || (value === 'selection' && !props.selectedIds.length)} onChange={() => update({ scope: value })} />{value === 'all' ? 'All' : 'Selection'}</label>)}</fieldset>
      <fieldset className="export-segments"><legend>Framing</legend>{(['content', '16:9'] as const).map(value => <label key={value}><input type="radio" name={`${id}-aspect`} checked={(settings.aspect ?? 'content') === value} disabled={props.busy} onChange={() => update({ aspect: value })} />{value === 'content' ? 'Content' : value}</label>)}</fieldset>
      <fieldset className="export-segments"><legend>Background</legend>{(['diagram', 'white', 'transparent'] as const).map(value => <label key={value}><input type="radio" name={`${id}-background`} aria-label={value === 'transparent' ? 'Transparent background' : undefined} checked={background === value} disabled={props.busy} onChange={() => update(value === 'transparent' ? { transparent: true } : { background: value, transparent: false })} />{value.charAt(0).toUpperCase() + value.slice(1)}</label>)}</fieldset>
      <label className="export-grid"><input type="checkbox" checked={settings.includeGrid ?? output.scene?.grid.export ?? false} disabled={props.busy} onChange={event => update({ includeGrid: event.target.checked })} />Include grid</label>
      {(error || output.error) && <p className="export-error" role="alert">{error || output.error}</p>}
      {(pngError(1) || pngError(2)) && output.scene && <p className="export-error" role="status">{pngError(1) || 'PNG 2x is too large. Use PNG 1x or SVG.'}</p>}
      <div className="export-actions">{([{ format: 'svg', scale: 1 }, { format: 'png', scale: 1 }, { format: 'png', scale: 2 }] as const).map(action => <button type="button" key={`${action.format}-${action.scale}`} aria-label={action.format === 'svg' ? 'Export SVG' : `Export PNG ${action.scale}x`} disabled={props.busy || !output.scene || (action.format === 'png' && !!pngError(action.scale))} onClick={() => invoke(action.format, action.scale)}><Download size={16} />{action.format === 'svg' ? 'SVG' : `PNG ${action.scale}x`}</button>)}<button type="button" aria-label="Copy image" disabled={props.busy || !props.onCopyImage || !output.scene || !!pngError(1)} onClick={() => invoke('png', 1, true)}><Copy size={16} />Copy image</button></div>
    </div>
  </div>
}