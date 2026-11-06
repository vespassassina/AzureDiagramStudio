// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { createDocument } from '../model.ts'
import { ExportDialog } from './ExportDialog.tsx'
import type { ExportPreset } from './ExportDialog.tsx'

afterEach(cleanup)
function setup(busy = false) {
  const onExport = vi.fn(), onClose = vi.fn(), onCopyImage = vi.fn()
  function Host() {
    const [preset, onPreset] = useState<ExportPreset>({})
    return <ExportDialog document={createDocument('export')} selectedIds={[]} preset={preset} onPreset={onPreset} busy={busy} onExport={onExport} onClose={onClose} onCopyImage={onCopyImage} />
  }
  render(<Host />)
  return { onExport, onClose, onCopyImage }
}
describe('export choices DGM136', () => {
  it('should_default_include_markdown_off_and_preserve_plain_export_contract', () => {
    const h = setup()
    expect((screen.getByRole('checkbox', { name: 'Include Markdown' }) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Export SVG' }))
    expect(h.onExport).toHaveBeenCalledExactlyOnceWith({ format: 'svg', scale: 1, transparent: false })
  })
  it.each(['Export SVG', 'Export PNG 1x', 'Export PNG 2x'])('should_forward_enabled_pair_for_%s_without_document_changes', name => {
    const h = setup()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Markdown' }))
    fireEvent.click(screen.getByRole('button', { name }))
    expect(h.onExport).toHaveBeenCalledExactlyOnceWith({ format: name.includes('SVG') ? 'svg' : 'png', scale: name.endsWith('2x') ? 2 : 1, transparent: false, includeMarkdown: true })
  })
  it('should_clear_zip_flag_when_switching_to_embedded_markdown_and_preserve_image_options', () => {
    const h = setup()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Markdown' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Markdown with embedded PNG' }))
    expect(screen.queryByRole('checkbox', { name: 'Include Markdown' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Images (SVG / PNG)' }))
    expect((screen.getByRole('checkbox', { name: 'Include Markdown' }) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByRole('radio', { name: 'Markdown with embedded PNG' }))
    fireEvent.click(screen.getByRole('radio', { name: '16:9' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include grid' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Transparent background' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export Markdown 2x' }))
    expect(h.onExport).toHaveBeenCalledExactlyOnceWith({ format: 'markdown', scale: 2, transparent: true, aspect: '16:9', includeGrid: true })
  })
  it('should_keep_clipboard_plain_when_the_zip_option_is_on', () => {
    const h = setup()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Markdown' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }))
    expect(h.onCopyImage).toHaveBeenCalledExactlyOnceWith({ format: 'png', scale: 1, transparent: false })
    expect(h.onExport).not.toHaveBeenCalled()
  })
  it('should_disable_new_choices_while_busy', () => {
    setup(true)
    for (const name of ['Include Markdown', 'Markdown with embedded PNG']) expect((screen.getByRole(name === 'Include Markdown' ? 'checkbox' : 'radio', { name }) as HTMLInputElement).disabled).toBe(true)
  })
})

describe('workbook output scope DGM151C', () => {
  function workbookSetup(pdfAvailable: boolean) {
    const onExport = vi.fn(), onExportDocument = vi.fn(), onClose = vi.fn()
    function Host() {
      const [preset, onPreset] = useState<ExportPreset>({})
      return <ExportDialog document={createDocument('page-one')} selectedIds={[]} preset={preset} onPreset={onPreset} busy={false} onExport={onExport} onClose={onClose} onExportDocument={onExportDocument} pdfAvailable={pdfAvailable} workbook={{ title: 'Program', pageCount: 3 }} />
    }
    render(<Host />)
    return { onExport, onExportDocument, onClose }
  }
  it('should_offer_page_and_workbook_outputs_and_hide_selection_for_workbook_scope', () => {
    const h = workbookSetup(true)
    expect(screen.getByRole('heading', { name: 'Export workbook or page' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Current page' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('radio', { name: 'Selection' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Whole workbook (3 pages)' }))
    expect(screen.queryByRole('radio', { name: 'Selection' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Markdown with embedded PNG' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Export workbook PNG ZIP' }))
    expect(h.onExportDocument).toHaveBeenCalledExactlyOnceWith({ scope: 'workbook', format: 'zip', imageFormat: 'png' })
    expect(h.onExport).not.toHaveBeenCalled()
    expect(h.onClose).toHaveBeenCalledOnce()
  })
  it.each([['JSON', 'json'], ['PDF', 'pdf'], ['Visio (.vsdx)', 'vsdx']] as const)('should_send_whole_workbook_%s_without_selection', (label, format) => {
    const h = workbookSetup(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Whole workbook (3 pages)' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Document (JSON / PDF / Visio)' }))
    fireEvent.click(screen.getByRole('button', { name: `Export workbook ${label}` }))
    expect(h.onExportDocument).toHaveBeenCalledExactlyOnceWith({ scope: 'workbook', format })
  })
  it('should_export_current_page_document_without_selection_scope', () => {
    const h = workbookSetup(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Document (JSON / PDF / Visio)' }))
    expect(screen.queryByRole('radio', { name: 'Selection' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Export page Visio (.vsdx)' }))
    expect(h.onExportDocument).toHaveBeenCalledExactlyOnceWith({ scope: 'page', format: 'vsdx' })
  })
  it('should_disable_pdf_with_explanation_when_pdf_is_unavailable', () => {
    const h = workbookSetup(false)
    fireEvent.click(screen.getByRole('radio', { name: 'Document (JSON / PDF / Visio)' }))
    const pdf = screen.getByRole('button', { name: 'Export page PDF' }) as HTMLButtonElement
    expect(pdf.disabled).toBe(true)
    expect(pdf.title).toBe('PDF export needs the desktop app')
    expect(screen.getByText(/PDF export needs the desktop app\./)).toBeTruthy()
    fireEvent.click(pdf)
    expect(h.onExportDocument).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Export page JSON' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('should_keep_legacy_dialog_without_output_or_document_choices', () => {
    setup()
    expect(screen.queryByRole('radio', { name: 'Current page' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Document (JSON / PDF / Visio)' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Export diagram' })).toBeTruthy()
  })
})
