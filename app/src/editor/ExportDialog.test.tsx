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
