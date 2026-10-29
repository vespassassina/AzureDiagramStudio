// ResizeObserver delivers during layout. Defer geometry-dependent React writes
// to one next-frame measurement so they cannot resize the observed tree during
// that delivery; always read the latest bounds, not a stale queued entry.
export function frameResizeObserver(measure: () => void) {
  let active = true, frame: number | null = null
  const schedule = () => {
    if (!active || frame !== null) return
    frame = requestAnimationFrame(() => { frame = null; if (active) measure() })
  }
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
  return {
    observe: (element: Element) => observer?.observe(element),
    schedule,
    disconnect: () => {
      active = false
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      observer?.disconnect()
    },
  }
}
