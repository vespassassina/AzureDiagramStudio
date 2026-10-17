// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownDescription, MarkdownPreview } from './MarkdownDescription.tsx'
import DOMPurify from 'dompurify'
import { starterCatalog } from '../app/starters.ts'
import { starterDocument } from '../app/session.ts'

afterEach(cleanup)

describe('Markdown preview DGM124', () => {
  it('should_control_mode_and_preserve_the_single_source_DGM124', () => {
    const callbacks = { onModeChange: vi.fn(), onDraft: vi.fn(), onFinish: vi.fn(), onCancel: vi.fn(), deferFinish: () => false }
    const { rerender } = render(<MarkdownDescription value="# Pending" mode="edit" writable {...callbacks} />)
    const field = screen.getByRole('textbox', { name: 'Architecture description (Markdown)' }) as HTMLTextAreaElement
    expect(field.maxLength).toBe(20000)
    fireEvent.blur(field, { relatedTarget: screen.getByRole('button', { name: 'Preview Markdown' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Preview Markdown' }))
    expect(callbacks.onModeChange).toHaveBeenCalledExactlyOnceWith('preview')
    expect(callbacks.onFinish).not.toHaveBeenCalled()
    rerender(<MarkdownDescription value="# Pending" mode="preview" writable {...callbacks} />)
    expect(screen.getByRole('heading', { name: 'Pending' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(callbacks.onDraft).not.toHaveBeenCalled()
    rerender(<MarkdownDescription value="# Pending" mode="edit" writable {...callbacks} />)
    expect(screen.getByRole('textbox')).toHaveProperty('value', '# Pending')
  })
  it('should_allow_readonly_source_selection_but_not_mutation_DGM124', () => {
    const onDraft = vi.fn(), onFinish = vi.fn()
    render(<MarkdownDescription value="Stored" mode="edit" writable={false} onModeChange={vi.fn()} onDraft={onDraft} onFinish={onFinish} onCancel={vi.fn()} deferFinish={() => false} />)
    const field = screen.getByRole('textbox')
    expect(field).toHaveProperty('readOnly', true)
    expect(field).toHaveProperty('disabled', false)
    fireEvent.change(field, { target: { value: 'Rejected' } }); fireEvent.blur(field)
    expect(onDraft).not.toHaveBeenCalled(); expect(onFinish).not.toHaveBeenCalled()
  })
  it('should_offer_only_preview_when_presenting_DGM124', () => {
    render(<MarkdownDescription value="# Read" mode="edit" presenting writable={false} onModeChange={vi.fn()} onDraft={vi.fn()} onFinish={vi.fn()} onCancel={vi.fn()} deferFinish={() => false} />)
    expect(screen.getByRole('heading', { name: 'Read' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit Markdown' })).toBeNull()
  })
  it('should_render_semantic_GFM_without_changing_source_DGM124', () => {
    const source = '# Architecture\n\nA **strong** *emphasis* ~~old~~ `code`.\n\n- One\n- Two\n\n> Quote\n\n```js\n<img src="remote">\n```\n\n| Name | State |\n| --- | --- |\n| API | Live |\n\n[Reference](https://learn.microsoft.com/azure/)'
    const { container } = render(<MarkdownPreview source={source} />)
    expect(screen.getByRole('heading', { name: 'Architecture' })).toBeTruthy()
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('strong')?.textContent).toBe('strong')
    expect(container.querySelector('em')?.textContent).toBe('emphasis')
    expect(container.querySelector('del')?.textContent).toBe('old')
    expect(container.querySelector('blockquote')?.textContent).toContain('Quote')
    expect(container.querySelector('pre code')?.textContent).toBe('<img src="remote">\n')
    expect(container.querySelector('table')).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Reference' })
    expect(link.getAttribute('href')).toBe('https://learn.microsoft.com/azure/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(source).toContain('**strong**')
  })

  it.each([
    '<script>alert(1)</script><img src="https://invalid.example/raw" onerror="alert(1)">',
    '<svg onload="alert(1)"><a href="javascript:alert(1)">raw</a></svg><math><mi>x</mi></math>',
    '<iframe srcdoc="<img src=x>"></iframe><form><input autofocus><button>submit</button></form>',
    '<style>@import "https://invalid.example/style";</style><video autoplay src="https://invalid.example/media"></video>',
    '<a href="https://invalid.example" style="background:url(https://invalid.example/bg)">raw anchor</a>',
    '![remote](https://invalid.example/image) ![data](data:image/svg+xml;base64,PHN2Zz4=)',
    '[unsafe](javascript:alert%281%29) [entity](javascript&#58;alert%281%29) [encoded](&#106;avascript:alert%281%29)',
    '[credentials](https://user:secret@invalid.example/) [relative](/local) [data](data:text/html,hello) [protocol](//invalid.example/)',
    '[control](https://invalid.example/\u0001bad) [tab](java&#9;script:alert%281%29)',
  ])('should_block_active_content_and_automatic_resources_DGM124: %s', source => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    try {
      const { container } = render(<MarkdownPreview source={source} />)
      expect(container.querySelectorAll('script,img,svg,math,iframe,frame,embed,object,form,button,input,style,video,audio,source,link')).toHaveLength(0)
      expect(container.querySelectorAll('a')).toHaveLength(0)
      for (const element of container.querySelectorAll('*')) for (const attribute of element.attributes) {
        expect(attribute.name).not.toMatch(/^on|^(style|src|srcdoc|id)$/i)
      }
      expect(fetch).not.toHaveBeenCalled()
    } finally { fetch.mockRestore() }
  })

  it('should_handle_long_malformed_unicode_source_without_crashing_DGM124', () => {
    const source = ('[**` \u6f22\u5b57\n'.repeat(3000)).slice(0, 20000)
    const { container } = render(<MarkdownPreview source={source} />)
    expect(screen.getByRole('region', { name: 'Markdown preview' })).toBeTruthy()
    expect(container.textContent).toContain('\u6f22\u5b57')
    expect(container.querySelectorAll('img,script')).toHaveLength(0)
  })
  it('should_fall_back_to_inert_source_when_rendering_fails_DGM124', () => {
    const sanitize = vi.spyOn(DOMPurify, 'sanitize').mockImplementationOnce(() => { throw new Error('Renderer unavailable') })
    try {
      const { container } = render(<MarkdownPreview source={'<img src="https://invalid.example/fallback" onerror="alert(1)">'} />)
      expect(screen.getByRole('alert').textContent).toBe('Markdown preview unavailable.')
      expect(container.querySelector('pre')?.textContent).toContain('<img')
      expect(container.querySelectorAll('img,script')).toHaveLength(0)
    } finally { sanitize.mockRestore() }
  })
  it.each(starterCatalog)('should_render_existing_guide_without_images_or_network_DGM124: $key', choice => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const source = starterDocument(choice.key).description!
    try {
      const { container } = render(<MarkdownPreview source={source} />)
      expect(container.querySelector('h1,h2')).toBeTruthy()
      expect(container.querySelectorAll('img,script,iframe,style')).toHaveLength(0)
      const headings = [...source.matchAll(/^#{1,6} (.+)$/gm)]
      for (const heading of headings) expect(screen.getByRole('heading', { name: heading[1] })).toBeTruthy()
      if (/https?:\/\//.test(source)) expect(container.querySelectorAll('a').length).toBeGreaterThan(0)
      else expect(container.querySelectorAll('a')).toHaveLength(0)
      expect(starterDocument(choice.key).description).toBe(source)
      expect(fetch).not.toHaveBeenCalled()
    } finally { fetch.mockRestore() }
  })
})