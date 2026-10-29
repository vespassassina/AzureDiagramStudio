import { useId, useLayoutEffect, useRef, useState } from 'react'

export type TopMenuItem = { label: string; disabled?: boolean; checked?: boolean; description?: string; run(origin: HTMLButtonElement): void }
export type TopMenu = { label: string; items: TopMenuItem[] }

export function TopMenus({ menus, open, onOpen, disabled }: {
  menus: TopMenu[]; open: string | null; onOpen(label: string | null): void; disabled: boolean
}) {
  const id = useId()
  const bar = useRef<HTMLElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const initialLast = useRef(false)
  const [position, setPosition] = useState({ left: 12, top: 12, maxHeight: 300 })
  const currentClose = useRef(onOpen)
  currentClose.current = onOpen
  const active = menus.find(menu => menu.label === open)
  const trigger = (label = open) => bar.current?.querySelector<HTMLButtonElement>(`[aria-label="${label} menu"]`)
  function close() { trigger()?.focus({ preventScroll: true }); onOpen(null) }
  function show(label: string, last = false) {
    if (disabled) return
    initialLast.current = last
    onOpen(label)
  }
  function adjacent(label: string, delta: number) {
    return menus[(menus.findIndex(menu => menu.label === label) + delta + menus.length) % menus.length].label
  }
  // Measure the real menu, clamp it to the viewport, and track scrolling chrome.
  // Focus stays inside the single open menu; closing restores its durable trigger.
  useLayoutEffect(() => {
    if (!active || disabled) return
    const place = () => {
      const anchor = trigger()?.getBoundingClientRect(), bounds = popup.current?.getBoundingClientRect()
      if (!anchor || !bounds) return
      const top = Math.min(anchor.bottom + 4, window.innerHeight - 100)
      setPosition({ left: Math.max(12, Math.min(anchor.left, window.innerWidth - bounds.width - 12)), top, maxHeight: window.innerHeight - top - 12 })
    }
    place()
    const items = popup.current?.querySelectorAll<HTMLButtonElement>('button')
    items?.[initialLast.current ? items.length - 1 : 0]?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !bar.current?.contains(event.target)) {
        trigger()?.focus({ preventScroll: true })
        currentClose.current(null)
      }
    }
    const focusout = (event: FocusEvent) => { if (event.target instanceof Node && !bar.current?.contains(event.target)) currentClose.current(null) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', focusout)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', focusout); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, disabled])
  return <nav ref={bar} className="application-menubar" role="menubar" aria-label="Application menus" onKeyDown={event => {
    event.stopPropagation()
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape' && open) { event.preventDefault(); close() }
  }}>
    {menus.map((menu, index) => <button key={menu.label} type="button" role="menuitem" aria-label={`${menu.label} menu`}
      tabIndex={open === menu.label || (!open && index === 0) ? 0 : -1}
      aria-haspopup="menu" aria-expanded={open === menu.label} aria-controls={open === menu.label ? id : undefined}
      disabled={disabled} onMouseDown={event => event.preventDefault()}
      onClick={() => open === menu.label ? close() : show(menu.label)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); show(menu.label, event.key === 'ArrowUp') }
        const label = event.key === 'Home' ? menus[0].label : event.key === 'End' ? menus.at(-1)!.label
          : event.key === 'ArrowRight' ? adjacent(menu.label, 1) : event.key === 'ArrowLeft' ? adjacent(menu.label, -1) : null
        if (label) { event.preventDefault(); trigger(label)?.focus(); if (open) show(label) }
      }}>{menu.label}</button>)}
    {active && !disabled && <div ref={popup} id={id} role="menu" aria-label={active.label} className="application-menu" style={position}
      onMouseDown={event => event.preventDefault()} onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'Tab') { close(); return }
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); show(adjacent(active.label, event.key === 'ArrowRight' ? 1 : -1)); return }
        const items = [...popup.current!.querySelectorAll<HTMLButtonElement>('button')]
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index + items.length - 1) % items.length : -1
        if (next >= 0) { event.preventDefault(); items[next].focus() }
      }}>
      {active.items.map(item => <button key={item.label} type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
        aria-checked={item.checked} aria-disabled={item.disabled || undefined} aria-description={item.description} tabIndex={-1}
        onClick={() => {
          if (item.disabled) return
          const origin = trigger()
          close()
          // Run synchronously inside the trusted activation: file pickers must
          // not be deferred to a timer or an effect.
          if (origin) item.run(origin)
        }}><span aria-hidden="true" className="menu-check">{item.checked ? '✓' : ''}</span>{item.label}</button>)}
    </div>}
  </nav>
}
