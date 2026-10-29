import { useId, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
// Single source of truth for the displayed version; the named import lets the
// bundler keep only this field instead of embedding the whole manifest.
import { version } from '../../package.json'

export const PRODUCT_NAME = 'Azure Diagram Studio'
export const APP_VERSION: string = version

// Informational modal. References are plain text (not links), so opening About
// never navigates or makes a network request. The keyboard trap mirrors
// HelpGuide: capture-phase listeners keep keys away from editor shortcuts.
export function AboutDialog({ onClose }: { onClose(): void }) {
  const titleId = useId(), descriptionId = useId()
  const dialog = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const currentClose = useRef(onClose)
  currentClose.current = onClose
  useLayoutEffect(() => trapKeyboard(dialog, close, () => currentClose.current()), [])
  return createPortal(<AboutContent dialog={dialog} close={close} titleId={titleId} descriptionId={descriptionId} onClose={onClose} />, document.body)
}

// Pseudocode: focus Close; on every key, stop propagation; ignore IME keys;
// Escape closes; Tab cycles among dialog controls; modifier/edit keys are
// swallowed; focus escaping the dialog is pulled back to Close.
export function trapKeyboard(dialog: RefObject<HTMLElement | null>, close: RefObject<HTMLButtonElement | null>, onClose: () => void) {
  close.current?.focus({ preventScroll: true })
  const keydown = (event: globalThis.KeyboardEvent) => {
    event.stopImmediatePropagation()
    if (event.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab') {
      if (event.ctrlKey || event.metaKey || event.altKey || ['Delete', 'Backspace', 'F2'].includes(event.key)) event.preventDefault()
      return
    }
    event.preventDefault()
    const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])]
    const index = controls.indexOf(document.activeElement as HTMLElement)
    controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus()
  }
  const focusin = (event: FocusEvent) => { if (!dialog.current?.contains(event.target as Node)) close.current?.focus({ preventScroll: true }) }
  window.addEventListener('keydown', keydown, true)
  document.addEventListener('focusin', focusin, true)
  return () => { window.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin, true) }
}

type ContentProps = {
  dialog: RefObject<HTMLElement | null>
  close: RefObject<HTMLButtonElement | null>
  titleId: string
  descriptionId: string
  onClose(): void
}

function AboutContent({ dialog, close, titleId, descriptionId, onClose }: ContentProps) {
  return <div className="about-overlay">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={descriptionId} className="about-dialog">
      <header>
        <span id={titleId}>About {PRODUCT_NAME}</span>
        <button ref={close} type="button" title="Close About" aria-label="Close About" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="about-content" role="region" aria-label="About details" tabIndex={0}>
        <div className="about-identity">
          <img src="./branding/logo.svg" alt="" width={56} height={56} />
          <div><h2>{PRODUCT_NAME}</h2><p className="about-version">Version {APP_VERSION}</p></div>
        </div>
        <p id={descriptionId}>
          A local-first architecture diagram editor. You draw, save and export
          diagrams on this device without a cloud account.
        </p>
        <AboutSections />
      </div>
      <footer><button type="button" onClick={onClose}>Done</button></footer>
    </section>
  </div>
}

// Rights wording is deliberately qualified: the renderer cannot establish
// signing, platform certification or artwork licensing, so none is claimed.
function AboutSections() {
  return <>
    <h3>Project and documentation</h3>
    <dl>
      <dt>Source repository</dt>
      <dd><code>github.com/vespassassina/AzureDiagramStudio</code></dd>
      <dt>Manual</dt>
      <dd><code>docs/manual.md</code> in the repository. Settings menu → Help opens the in-app guide; Settings and About share that menu.</dd>
    </dl>
    <h3>Identity and rights</h3>
    <p>
      {PRODUCT_NAME} is an independent project. It is not a Microsoft product and is
      not affiliated with or endorsed by Microsoft. Product names and artwork belong
      to their respective owners.
    </p>
    <p>
      This application does not grant a blanket license to bundled artwork or
      third-party marks. Check the repository notices and each asset's terms before reuse.
    </p>
    <h3>Keep a backup</h3>
    <p>
      Saved on this device in the bottom status bar means local storage, not a portable backup. Use File → Save JSON
      to keep an editable copy you can reopen later.
    </p>
  </>
}
