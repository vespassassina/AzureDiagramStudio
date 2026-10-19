// @vitest-environment jsdom
import { createRef } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpGuide } from './HelpGuide.tsx'

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.innerWidth = 1024; window.innerHeight = 768 })

function box(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return {} } }
}

describe('DGM117 guide geometry', () => {
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
    render(<><div ref={root}><button aria-label="New diagram">New</button></div><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
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
    for (let step = 1; step <= 10; step++) {
      expect(guide.querySelector('[aria-live="polite"]')!.textContent).toContain(`${step}/10`)
      fireEvent.click(within(guide).getByRole('button', { name: step === 10 ? 'Finish' : 'Next' }))
    }
    expect(onReveal).toHaveBeenCalledWith('library')
    expect(onReveal).toHaveBeenCalledWith('inspector')
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('should_describe_current_starters_markdown_ink_and_About_location_in_ten_ordered_steps_DGM126', () => {
    const root = createRef<HTMLDivElement>()
    render(<><div ref={root} /><HelpGuide root={root} onReveal={vi.fn()} onClose={vi.fn()} /></>)
    const guide = screen.getByRole('dialog', { name: 'UI guide' })
    const titles = ['Start a diagram', 'Name your diagram', 'Add components', 'Navigate the canvas', 'Connect and annotate', 'Edit properties', 'Arrange your diagram', 'Save editable work', 'Export artwork', 'Present and hand off']
    const texts: string[] = []
    for (const [index, title] of titles.entries()) {
      expect(within(guide).getByRole('heading', { name: title })).toBeTruthy()
      texts.push(guide.querySelector('.help-guide-content p')!.textContent!)
      if (index < 9) fireEvent.click(within(guide).getByRole('button', { name: 'Next' }))
    }
    expect(texts[0]).toMatch(/eleven/i)
    expect(texts[0]).not.toMatch(/Web\/API, Event-driven, Fabric or Enterprise\./)
    expect(texts[5]).toMatch(/Markdown.*Edit.*Preview/s)
    expect(texts[5]).toMatch(/right/i)
    expect(texts[9]).toMatch(/temporary/i)
    expect(texts[9]).toMatch(/ink|pen|marker/i)
    expect(texts.join(' ')).toMatch(/About.*(beside|next to) Help/s)
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
    const view = render(<div ref={root}><div data-testid="chrome"><button aria-label="New diagram">New</button></div></div>)
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