import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { EditorAction } from './CommandMenu.tsx'
import type { Point } from '../model.ts'

export function ContextMenu({ point, origin, actions, onClose }: { point: Point; origin: HTMLElement | null; actions: EditorAction[]; onClose(): void }) {
  const menu = useRef<HTMLDivElement>(null)
  const invoked = useRef(false)
  const close = useRef(onClose)
  close.current = onClose
  const [position, setPosition] = useState(point)
  useLayoutEffect(() => {
    const element = menu.current!
    const bounds = element.getBoundingClientRect()
    setPosition({ x: Math.max(8, Math.min(point.x, window.innerWidth - bounds.width - 8)), y: Math.max(8, Math.min(point.y, window.innerHeight - bounds.height - 8)) })
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    return () => {
      if (element.contains(document.activeElement) || document.activeElement === document.body) {
        if (origin?.isConnected && !origin.closest('[inert]') && !origin.matches(':disabled')) origin.focus({ preventScroll: true })
      }
    }
  }, [point, origin])
  useEffect(() => {
    const outside = (event: Event) => { if (!menu.current?.contains(event.target as Node)) close.current() }
    const dismiss = () => close.current()
    document.addEventListener('pointerdown', outside, true)
    window.addEventListener('resize', dismiss); window.addEventListener('blur', dismiss)
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', dismiss); window.removeEventListener('blur', dismiss) }
  }, [])
  function execute(action: EditorAction) {
    if (invoked.current || action.disabled) return
    invoked.current = true; action.run(); onClose()
  }
  return <div ref={menu} role="menu" aria-label="Canvas actions" className="editor-context-menu nodrag nopan nowheel" style={{ left: position.x, top: position.y }} onContextMenu={event => event.preventDefault()} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onKeyDown={event => {
    event.stopPropagation()
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); onClose(); return }
    const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (direction || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + direction + items.length) % items.length]
      next?.focus({ preventScroll: true }); next?.scrollIntoView?.({ block: 'nearest' }); return
    }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); items[index]?.click() }
  }}>{actions.map(action => <button key={action.label} type="button" role="menuitem" disabled={action.disabled} aria-disabled={action.disabled} tabIndex={-1} onClick={() => execute(action)}><action.icon size={17} aria-hidden="true" /><span>{action.label}</span></button>)}</div>
}