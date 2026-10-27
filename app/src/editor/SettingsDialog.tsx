import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { trapKeyboard } from './AboutDialog.tsx'
import type { McpStatus } from '../app/mcp.ts'

export function SettingsDialog({ onClose }: { onClose(): void }) {
  const id = useId()
  const dialog = useRef<HTMLElement>(null), close = useRef<HTMLButtonElement>(null)
  const currentClose = useRef(onClose)
  currentClose.current = onClose
  const bridge = window.desktopMcp
  const [status, setStatus] = useState<McpStatus>({ state: 'unavailable', snapshotAvailable: false })
  const [feedback, setFeedback] = useState('')
  const [copying, setCopying] = useState(false)
  useLayoutEffect(() => trapKeyboard(dialog, close, () => currentClose.current()), [])
  useEffect(() => {
    if (!bridge) return
    let active = true
    async function refresh() {
      try { const next = await bridge!.status(); if (active) setStatus(next) }
      catch { if (active) setStatus({ state: 'error', snapshotAvailable: false, message: 'Desktop MCP bridge unavailable. Restart the app to retry.' }) }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2000)
    return () => { active = false; window.clearInterval(timer) }
  }, [bridge])
  async function copy(kind: 'address' | 'token') {
    if (!bridge || copying || status.state !== 'running') return
    setCopying(true); setFeedback('')
    try {
      const result = await (kind === 'address' ? bridge.copyAddress() : bridge.copyToken())
      setFeedback(result.ok ? kind === 'address' ? 'MCP address copied.' : 'Access token copied.' : result.message)
    } catch { setFeedback('Clipboard copy failed. Try again.') }
    finally { setCopying(false) }
  }
  return createPortal(<div className="about-overlay">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="about-dialog settings-dialog">
      <header><span id={`${id}-title`}>Settings</span><button ref={close} type="button" aria-label="Close Settings" title="Close Settings" onClick={onClose}><X size={18} /></button></header>
      <div className="about-content" role="region" aria-label="Local MCP settings" tabIndex={0}>
        <h2>Local MCP server</h2>
        <p id={`${id}-description`}>Read and edit the committed diagram, browse the component catalog and starting templates, create diagrams, Auto-arrange and Undo/Redo. Unfinished title, inline and Markdown drafts are not shared or overwritten.</p>
        {!bridge ? <p>Desktop app required. The browser build does not run an MCP server.</p> : <>
          <p role="status">{status.state === 'running' ? 'Running on this device.' : status.message ?? 'Local MCP server unavailable.'}</p>
          {status.state === 'running' && <><p><code>{status.address}</code></p><p>{status.snapshotAvailable ? 'Current workspace available.' : 'Current workspace unavailable while loading or after an error.'}</p></>}
        </>}
        <div className="mcp-copy-actions">
          <button type="button" disabled={!bridge || status.state !== 'running' || copying} onClick={() => void copy('address')}>Copy MCP address</button>
          <button type="button" disabled={!bridge || status.state !== 'running' || copying} onClick={() => void copy('token')}>Copy access token</button>
        </div>
        <p role="status" aria-live="polite">{feedback}</p>
        <h3>Connect a local MCP client</h3>
        <p>Use Streamable HTTP with this address and an <code>Authorization: Bearer &lt;access token&gt;</code> header. Copy the token only when configuring a trusted client; it grants read and write access to your diagram.</p>
        <p>The server starts automatically, accepts same-machine clients only, and runs only while this desktop app is open. Restarting the app rotates the access token; copy the new token and actual address after restart.</p>
        <p>Edits use normal validation, Undo and autosave. Clients must read the latest state token before changing a diagram. Writes are refused while you have unfinished edits, an open dialog, or other conflicting work. New diagram uses the normal unsaved-work confirmation.</p>
        <p>No client settings are changed automatically. The server cannot execute shell commands or read arbitrary files.</p>
      </div>
      <footer><button type="button" onClick={onClose}>Done</button></footer>
    </section>
  </div>, document.body)
}
