import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, FileText, X } from 'lucide-react'
import type { Diagram } from '../model.ts'
import type { DocumentExportOptions, ExportOptions, ExportSceneOptions } from '../contracts.ts'
import { buildExportScene, pngDimensions, renderSvg } from '../scene.ts'
import { visualAssets } from '../assets.ts'

export type ExportPreset = ExportSceneOptions & { scope?: 'all' | 'selection'; transparent?: boolean }
type Props = {
  document: Diagram; selectedIds: string[]; preset: ExportPreset; busy: boolean
  onPreset(preset: ExportPreset): void; onClose(reason?: 'escape'): void
  onExport(options: ExportOptions): void; onCopyImage?(options: ExportOptions): void
  /** DGM-151C: whole-page/workbook document outputs; absent hides the Document choices. */
  onExportDocument?(options: DocumentExportOptions): void
  /** Present only for a workbook root; enables the Page/Workbook output choice. */
  workbook?: { title: string; pageCount: number }
  /** False in the browser build: PDF requires the desktop print host. */
  pdfAvailable?: boolean
}

type FormatMode = 'images' | 'markdown' | 'document'
const DOCUMENT_LABELS = { json: 'JSON', pdf: 'PDF', vsdx: 'Visio (.vsdx)' } as const

export function ExportDialog(props: Props) {
  const id = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const invoked = useRef(false)
  const [error, setError] = useState('')
  const [formatMode, setFormatMode] = useState<FormatMode>('images')
  // Output scope: the active page (default) or every page of a workbook root.
  const [outputScope, setOutputScope] = useState<'page' | 'workbook'>('page')
  const wholeWorkbook = Boolean(props.workbook) && outputScope === 'workbook'
  const [includeMarkdown, setIncludeMarkdown] = useState(false)
  const { scope, transparent = false, ...settings } = props.preset
  // Workbook scope and document formats always export whole pages: never the old selection.
  const selectionScope = scope === 'selection' && !wholeWorkbook && formatMode !== 'document'
  const options: ExportSceneOptions = { ...settings, ...(selectionScope ? { selectionIds: [...props.selectedIds] } : {}) }
  const selectionKey = props.selectedIds.join('\n')
  const output = useMemo(() => {
    try {
      const scene = buildExportScene(props.document, { ...settings, ...(selectionScope ? { selectionIds: [...props.selectedIds] } : {}) })
      return { scene, svg: renderSvg(scene, visualAssets, transparent), error: '' }
    } catch (failure) { return { scene: null, svg: '', error: failure instanceof Error ? failure.message : 'Export preview unavailable.' } }
  }, [props.document, props.preset, selectionKey, selectionScope])
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
  function invoke(format: 'svg' | 'png' | 'markdown', scale: 1 | 2, copy = false) {
    if (props.busy || invoked.current || !output.scene || (format !== 'svg' && pngError(scale))) return
    invoked.current = true; setError('')
    try {
      const capture = { format, scale, transparent, ...options, ...(!copy && format !== 'markdown' && includeMarkdown ? { includeMarkdown: true } : {}) }
      if (copy) props.onCopyImage?.(capture)
      else props.onExport(capture)
      props.onClose()
    } catch (failure) {
      invoked.current = false
      setError(failure instanceof Error ? failure.message : 'Export request failed.')
    }
  }
  // Pseudocode: refuse duplicate, busy or unavailable invocations, map the dialog
  // settings to the typed whole-page/workbook request, hand it to the session and
  // close. The session snapshots the committed root, so later edits cannot leak in.
  function invokeDocument(format: 'json' | 'zip' | 'pdf' | 'vsdx', imageFormat?: 'svg' | 'png') {
    if (props.busy || invoked.current || !props.onExportDocument) return
    if (format === 'pdf' && !props.pdfAvailable) return
    if (format === 'zip' && !wholeWorkbook) return
    invoked.current = true; setError('')
    const style = { ...(transparent ? { transparent: true } : settings.background ? { background: settings.background } : {}), ...(settings.includeGrid === undefined ? {} : { includeGrid: settings.includeGrid }) }
    try {
      if (wholeWorkbook) props.onExportDocument({ scope: 'workbook', format, ...style, ...(imageFormat ? { imageFormat } : {}) })
      else if (format !== 'zip') props.onExportDocument({ scope: 'page', format, ...style })
      props.onClose()
    } catch (failure) {
      invoked.current = false
      setError(failure instanceof Error ? failure.message : 'Export request failed.')
    }
  }
  const modes: FormatMode[] = wholeWorkbook ? ['images', 'document'] : props.onExportDocument ? ['images', 'markdown', 'document'] : ['images', 'markdown']
  const modeLabel = (value: FormatMode) => value === 'images' ? (wholeWorkbook ? 'Images ZIP (SVG / PNG)' : 'Images (SVG / PNG)') : value === 'markdown' ? 'Markdown with embedded PNG' : 'Document (JSON / PDF / Visio)'
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
      <header className="export-heading"><h2 id={`${id}-title`}>{props.workbook ? 'Export workbook or page' : 'Export diagram'}</h2><button type="button" aria-label="Cancel export" title="Cancel export" onClick={() => props.onClose()}><X size={18} /></button></header>
      <div className="export-preview" role="img" aria-label="Export preview" dangerouslySetInnerHTML={{ __html: output.svg }} />
      {props.workbook && <fieldset className="export-segments"><legend>Output</legend>{(['page', 'workbook'] as const).map(value => <label key={value}><input type="radio" name={`${id}-output`} checked={outputScope === value} disabled={props.busy} onChange={() => { setOutputScope(value); setFormatMode('images'); setIncludeMarkdown(false); setError('') }} />{value === 'page' ? 'Current page' : `Whole workbook (${props.workbook!.pageCount} pages)`}</label>)}</fieldset>}
      <fieldset className="export-segments"><legend>Format</legend>{modes.map(value => <label key={value}><input type="radio" name={`${id}-format`} checked={formatMode === value} disabled={props.busy} onChange={() => { setFormatMode(value); setIncludeMarkdown(false); setError('') }} />{modeLabel(value)}</label>)}</fieldset>
      {!wholeWorkbook && formatMode !== 'document' && <fieldset className="export-segments"><legend>Scope</legend>{(['all', 'selection'] as const).map(value => <label key={value}><input type="radio" name={`${id}-scope`} checked={(scope ?? 'all') === value} disabled={props.busy || (value === 'selection' && !props.selectedIds.length)} onChange={() => update({ scope: value })} />{value === 'all' ? 'All' : 'Selection'}</label>)}</fieldset>}
      <fieldset className="export-segments"><legend>Framing</legend>{(['content', '16:9'] as const).map(value => <label key={value}><input type="radio" name={`${id}-aspect`} checked={(settings.aspect ?? 'content') === value} disabled={props.busy} onChange={() => update({ aspect: value })} />{value === 'content' ? 'Content' : value}</label>)}</fieldset>
      <fieldset className="export-segments"><legend>Background</legend>{(['diagram', 'white', 'transparent'] as const).map(value => <label key={value}><input type="radio" name={`${id}-background`} aria-label={value === 'transparent' ? 'Transparent background' : undefined} checked={background === value} disabled={props.busy} onChange={() => update(value === 'transparent' ? { transparent: true } : { background: value, transparent: false })} />{value.charAt(0).toUpperCase() + value.slice(1)}</label>)}</fieldset>
      <label className="export-grid"><input type="checkbox" checked={settings.includeGrid ?? output.scene?.grid.export ?? false} disabled={props.busy} onChange={event => update({ includeGrid: event.target.checked })} />Include grid</label>
      {formatMode === 'document' ? <p className="export-format-note">{wholeWorkbook ? 'Every page in saved order. JSON is the complete editable workbook; PDF has one titled page per diagram; Visio keeps editable shapes and glued connectors.' : 'The whole current page. JSON is the editable diagram; PDF is one titled page; Visio keeps editable shapes and glued connectors.'}{!props.pdfAvailable && ' PDF export needs the desktop app.'}</p> : wholeWorkbook ? <p className="export-format-note">A ZIP with one whole-page image per page in saved order, page and workbook Markdown, and a manifest.</p> : formatMode === 'images' ? <label className="export-grid"><input type="checkbox" checked={includeMarkdown} disabled={props.busy} onChange={event => setIncludeMarkdown(event.target.checked)} />Include Markdown</label> : <p className="export-format-note">Includes the committed description and an inline PNG. Some Markdown viewers block data images; use an image + Markdown ZIP for portability.</p>}
      {(error || output.error) && <p className="export-error" role="alert">{error || output.error}</p>}
      {(pngError(1) || pngError(2)) && output.scene && <p className="export-error" role="status">{pngError(1) || 'PNG 2x is too large. Use PNG 1x or SVG.'}</p>}
      <div className="export-actions">{formatMode === 'document' ? (['json', 'pdf', 'vsdx'] as const).map(format => <button type="button" key={format} aria-label={`Export ${wholeWorkbook ? 'workbook' : 'page'} ${DOCUMENT_LABELS[format]}`} title={format === 'pdf' && !props.pdfAvailable ? 'PDF export needs the desktop app' : undefined} disabled={props.busy || (format === 'pdf' && !props.pdfAvailable)} onClick={() => invokeDocument(format)}><FileText size={16} />{DOCUMENT_LABELS[format]}</button>) : wholeWorkbook ? (['svg', 'png'] as const).map(format => <button type="button" key={format} aria-label={`Export workbook ${format.toUpperCase()} ZIP`} disabled={props.busy} onClick={() => invokeDocument('zip', format)}><Download size={16} />{format.toUpperCase()} ZIP</button>) : formatMode === 'images' ? <>{([{ format: 'svg', scale: 1 }, { format: 'png', scale: 1 }, { format: 'png', scale: 2 }] as const).map(action => <button type="button" key={`${action.format}-${action.scale}`} aria-label={action.format === 'svg' ? 'Export SVG' : `Export PNG ${action.scale}x`} disabled={props.busy || !output.scene || (action.format === 'png' && !!pngError(action.scale))} onClick={() => invoke(action.format, action.scale)}><Download size={16} />{action.format === 'svg' ? 'SVG' : `PNG ${action.scale}x`}</button>)}<button type="button" aria-label="Copy image" disabled={props.busy || !props.onCopyImage || !output.scene || !!pngError(1)} onClick={() => invoke('png', 1, true)}><Copy size={16} />Copy image</button></> : ([1, 2] as const).map(scale => <button type="button" key={scale} aria-label={`Export Markdown ${scale}x`} disabled={props.busy || !output.scene || !!pngError(scale)} onClick={() => invoke('markdown', scale)}><Download size={16} />Markdown {scale}x</button>)}</div>
    </div>
  </div>
}