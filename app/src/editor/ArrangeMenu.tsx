import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, LayoutGrid, LoaderCircle } from 'lucide-react'
import type { Direction } from '../model.ts'
import type { LayoutOptions } from '../layout.ts'

const choices = [
  { label: 'Horizontal', direction: 'RIGHT', arrangement: 'standard' },
  { label: 'Vertical', direction: 'DOWN', arrangement: 'standard' },
  { label: 'Horizontal groups stacked vertically', direction: 'RIGHT', arrangement: 'stacked' },
  { label: 'Vertical groups side by side', direction: 'DOWN', arrangement: 'stacked' },
] as const

export function ArrangeMenu({ open, onOpen, disabled, busy, onArrange }: {
  open: boolean; onOpen(open: boolean): void; disabled: boolean; busy: boolean
  onArrange(direction: Direction, options: LayoutOptions): void
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 240 })
  const changeOpen = useRef(onOpen)
  changeOpen.current = onOpen
  const close = () => { onOpen(false); trigger.current?.focus({ preventScroll: true }) }
  useLayoutEffect(() => {
    if (!open) return
    // Keep the popup outside clipped canvas chrome. Place above the trigger in
    // short windows and recompute when the scrollable responsive dock moves.
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect()
      const popup = menu.current?.getBoundingClientRect()
      if (!anchor || !popup) return
      const maxHeight = Math.min(240, window.innerHeight - 24)
      const height = Math.min(popup.height, maxHeight)
      const below = anchor.bottom + 6
      const top = below + height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - height - 6)
      setPosition({ left: Math.max(12, Math.min(window.innerWidth - popup.width - 12, anchor.right - popup.width)), top, maxHeight })
    }
    place()
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) changeOpen.current(false)
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  return <div className="arrange-menu">
    <button ref={trigger} type="button" className="arrange-button" title="Auto-arrange" aria-label="Auto-arrange"
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled}
      onMouseDown={event => event.preventDefault()}
      onClick={() => onOpen(!open)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); onOpen(true) }
      }}>
      {busy ? <LoaderCircle size={15} className="spin" /> : <LayoutGrid size={15} />}<span>Auto-arrange</span><ChevronDown size={14} />
    </button>
    {open && !disabled && createPortal(<div ref={menu} id={id} role="menu" aria-label="Auto-arrange layouts" className="arrange-choices" style={position} onKeyDown={event => {
      event.stopPropagation()
      if (event.nativeEvent.isComposing) return
      if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); close(); return }
      const buttons = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('button'))
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index + buttons.length - 1) % buttons.length : -1
      if (next >= 0) { event.preventDefault(); buttons[next].focus() }
    }}>
      {choices.map(choice => <button key={choice.label} type="button" role="menuitem" onClick={() => {
        close(); if (!disabled) onArrange(choice.direction, { arrangement: choice.arrangement })
      }}>{choice.label}</button>)}
    </div>, document.body)}
  </div>
}
