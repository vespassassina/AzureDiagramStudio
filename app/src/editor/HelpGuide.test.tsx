// @vitest-environment jsdom
import { createRef } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpGuide } from './HelpGuide.tsx'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.innerWidth = 1024; window.innerHeight = 768 })

function box(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return {} } }
}

describe('DGM117 guide geometry', () => {
  it('should_start_each_step_at_its_heading_after_reading_scrolled_short_content_DGM140', () => {
    const root = createRef<HTMLDivElement>()
    render(<><div ref={root} /><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
    const content = screen.getByRole('region', { name: 'Guide step' })
    content.scrollTop = 120
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(content.scrollTop).toBe(0)
    content.scrollTop = 80
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(content.scrollTop).toBe(0)
  })
  it('should_measure_intrinsic_content_not_oscillate_when_a_short_callout_is_constrained_DGM140', async () => {
    window.innerWidth = 720; window.innerHeight = 450
    const root = createRef<HTMLDivElement>()
    let measure: () => void = () => {}
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { measure = callback } observe() {} disconnect() {} })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('help-guide') ? box(0, 0, 352, 150) : box(24, 180, 640, 44)
    })
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('help-guide-content')) return 250
      if (this.tagName === 'HEADER' || this.tagName === 'FOOTER') return 50
      return this.classList.contains('help-guide') ? 150 : 0
    })
    render(<><div ref={root}><button aria-label="File menu">File</button></div><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
    const dialog = screen.getByRole('dialog')
    const first = dialog.style.cssText
    await act(async () => { measure(); await new Promise(resolve => requestAnimationFrame(resolve)) })
    expect(dialog.style.cssText).toBe(first)
    expect(parseFloat(dialog.style.maxHeight)).toBeLessThan(426)
    vi.unstubAllGlobals()
  })
  it('should_describe_final_menus_favorites_root_and_MCP_using_visible_menu_anchors_DGM140', () => {
    const root = createRef<HTMLDivElement>()
    render(<><div ref={root} /><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
    const guide = screen.getByRole('dialog', { name: 'UI guide' })
    const texts: string[] = []
    while (true) {
      texts.push(guide.querySelector('.help-guide-content p')!.textContent!)
      if (screen.queryByRole('button', { name: 'Finish' })) break
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    }
    expect(texts.join(' ')).toMatch(/File menu/)
    expect(texts.join(' ')).toMatch(/View menu/)
    expect(texts.join(' ')).toMatch(/Settings menu/)
    expect(texts.join(' ')).toMatch(/Favorites category/)
    expect(texts.join(' ')).toMatch(/bottom status bar/)
    expect(texts.join(' ')).toMatch(/workspace root/i)
    expect(texts.join(' ')).toMatch(/MCP.*snapshot.*export/i)
  })
  it('should_include_scrollable_step_content_in_the_keyboard_trap', () => {
    const root = createRef<HTMLDivElement>()
    render(<><div ref={root} /><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
    const guide = screen.getByRole('dialog', { name: 'UI guide' })
    const content = within(guide).getByRole('region', { name: 'Guide step' })
    const close = within(guide).getByRole('button', { name: 'Close guide' })
    const next = within(guide).getByRole('button', { name: 'Next' })
    expect(content.tabIndex).toBe(0)
    fireEvent.keyDown(close, { key: 'Tab' }); expect(document.activeElement).toBe(content)
    fireEvent.keyDown(content, { key: 'Tab' }); expect(document.activeElement).toBe(next)
    fireEvent.keyDown(next, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(content)
    fireEvent.keyDown(content, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(close)
  })
  it.each([[1440, 900], [390, 844], [720, 450]])('should_anchor_inside_%sx%s_and_remeasure_on_resize_and_scroll', (width, height) => {
    window.innerWidth = width; window.innerHeight = height
    let target = box(24, 24, 44, 44)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) { return this.classList.contains('help-guide') ? box(0, 0, Math.min(352, window.innerWidth - 24), 268) : target })
    const root = createRef<HTMLDivElement>()
    render(<><div ref={root}><button aria-label="File menu">File</button></div><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
    const guide = screen.getByRole('dialog', { name: 'UI guide' })
    const spotlight = () => document.querySelector<HTMLElement>('.help-guide-spotlight')!
    function check() {
      expect(spotlight().style.left).toBe(`${target.left}px`)
      expect(spotlight().style.top).toBe(`${target.top}px`)
      const left = parseFloat(guide.style.left), top = parseFloat(guide.style.top)
      const cardWidth = Math.min(352, window.innerWidth - 24)
      expect(left).toBeGreaterThanOrEqual(12)
      expect(top).toBeGreaterThanOrEqual(12)
      expect(left + cardWidth).toBeLessThanOrEqual(window.innerWidth - 12)
      expect(top + 268).toBeLessThanOrEqual(window.innerHeight - 12)
      expect(left >= target.right || left + cardWidth <= target.left || top >= target.bottom || top + 268 <= target.top).toBe(true)
    }
    check()
    target = box(width - 72, height - 72, 44, 44)
    fireEvent.scroll(window); check()
    act(() => { window.innerWidth = 390; window.innerHeight = 844; target = box(24, 24, 44, 44); fireEvent.resize(window) })
    check()
  })
  it('should_continue_when_target_is_missing_and_announce_each_step', () => {
    const root = createRef<HTMLDivElement>(), onClose = vi.fn(), onReveal = vi.fn()
    render(<><div ref={root} /><HelpGuide root={root} onReveal={onReveal} onClose={onClose} /></>)
    const guide = screen.getByRole('dialog', { name: 'UI guide' })
    expect(within(guide).getByText(/not visible/)).toBeTruthy()
    expect(document.querySelector('.help-guide-spotlight')).toBeNull()
    for (let step = 1; step <= 11; step++) {
      expect(guide.querySelector('[aria-live="polite"]')!.textContent).toContain(`${step}/11`)
      fireEvent.click(within(guide).getByRole('button', { name: step === 11 ? 'Finish' : 'Next' }))
    }
    expect(onReveal).toHaveBeenCalledWith('library')
    expect(onReveal).toHaveBeenCalledWith('inspector')
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('should_describe_current_starters_markdown_ink_and_About_location_in_ten_ordered_steps_DGM126', () => {
    const root = createRef<HTMLDivElement>()
    render(<><div ref={root} /><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
    const guide = screen.getByRole('dialog', { name: 'UI guide' })
    const titles = ['Start a diagram', 'Name your diagram', 'Add components', 'Navigate the canvas', 'Connect and annotate', 'Edit properties', 'Arrange your diagram', 'Save editable work', 'Export artwork', 'Present and hand off', 'Settings and integration']
    const texts: string[] = []
    for (const [index, title] of titles.entries()) {
      expect(within(guide).getByRole('heading', { name: title })).toBeTruthy()
      texts.push(guide.querySelector('.help-guide-content p')!.textContent!)
      if (index < 10) fireEvent.click(within(guide).getByRole('button', { name: 'Next' }))
    }
    expect(texts[0]).toMatch(/eleven/i)
    expect(texts[0]).not.toMatch(/Web\/API, Event-driven, Fabric or Enterprise\./)
    expect(texts[5]).toMatch(/Markdown.*Edit.*Preview/s)
    expect(texts[5]).toMatch(/right/i)
    expect(texts[9]).toMatch(/temporary/i)
    expect(texts[9]).toMatch(/ink|pen|marker/i)
    expect(texts.join(' ')).toMatch(/Settings menu opens Settings, Help and About/s)
  })
  it('should_describe_empty_default_fresh_picker_explicit_templates_and_saved_recovery_DGM127', () => {
    const root = createRef<HTMLDivElement>()
    render(<><div ref={root} /><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
    const guide = screen.getByRole('dialog', { name: 'UI guide' })
    expect(within(guide).getByRole('heading', { name: 'Start a diagram' })).toBeTruthy()
    const text = guide.querySelector('.help-guide-content p')!.textContent!
    expect(text).toMatch(/empty canvas/i)
    expect(text).toMatch(/Blank is the default/i)
    expect(text).toMatch(/fresh workspace/i)
    expect(text).toMatch(/saved (work|diagram)s? (reopens|reopen|recover)/i)
    expect(text).toMatch(/eleven/i)
    expect(text).not.toMatch(/sample/i)
  })
  it('should_state_that_Escape_cancels_active_ink_or_resize_before_exiting_Present_DGM126', () => {
    const root = createRef<HTMLDivElement>()
    render(<><div ref={root} /><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
    const guide = screen.getByRole('dialog', { name: 'UI guide' })
    for (let index = 0; index < 9; index++) fireEvent.click(within(guide).getByRole('button', { name: 'Next' }))
    expect(within(guide).getByRole('heading', { name: 'Present and hand off' })).toBeTruthy()
    const text = guide.querySelector('.help-guide-content p')!.textContent!
    expect(text).toMatch(/Escape cancels an active ink stroke or sidebar resize; otherwise it returns to editing\./)
    expect(text).not.toMatch(/(^|\. )Escape returns to editing\./)
  })
  it('should_restore_chrome_scroll_and_keep_navigation_reachable_in_a_short_viewport', () => {
    window.innerWidth = 720; window.innerHeight = 450
    const root = createRef<HTMLDivElement>()
    const view = render(<div ref={root}><div data-testid="chrome"><button aria-label="File menu">File</button></div></div>)
    const chrome = screen.getByTestId('chrome')
    Object.defineProperties(chrome, { scrollHeight: { value: 1000 }, clientHeight: { value: 100 } })
    chrome.scrollTop = 32
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn(() => { chrome.scrollTop = 200 }) })
    const guide = render(<HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} />)
    expect(chrome.scrollTop).toBe(200)
    expect(screen.getByRole('dialog').style.maxHeight).toBe('426px')
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false)
    guide.unmount()
    expect(chrome.scrollTop).toBe(32)
    view.unmount()
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })
})