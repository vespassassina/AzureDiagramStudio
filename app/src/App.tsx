import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent } from 'react'
import Editor from './editor/Editor.tsx'
import { createSession } from './app/session.ts'
import { browserDependencies } from './app/browser.ts'
import { publishMcpSession, listenMcpMutations } from './app/mcp.ts'

type RecentBridge = {
  list(): Promise<{ id: string; path: string; name: string; savedAt: number }[]>
  choose(): Promise<{ canceled: true } | { canceled: false; id: string }>
  read(id: string): Promise<{ id: string; name: string; source: string }>
  promote(id: string): Promise<unknown>
  readChosen(id: string): Promise<{ id: string; name: string; source: string }>
  acceptChosen(id: string): Promise<unknown>
}
declare global { interface Window { desktopRecent?: RecentBridge } }

export default function App() {
  const [session] = useState(() => createSession(browserDependencies))
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const openInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  // A native Recent read happens before it reaches session.openFile. Keep a
  // renderer-side epoch so a newer Load selection cannot be replaced by its
  // delayed original-file read.
  const recentRequest = useRef(0)
  useEffect(() => {
    if (!window.desktopMcp) return
    const stopPublish = publishMcpSession(session, window.desktopMcp)
    const stopMutations = listenMcpMutations(session, window.desktopMcp)
    let stopped = false
    const stop = () => {
      if (stopped) return
      stopped = true
      stopMutations()
      stopPublish()
    }
    const onError = (event: ErrorEvent) => {
      if (event.error == null && event.message === 'ResizeObserver loop completed with undelivered notifications.') return
      stop()
    }
    window.addEventListener('pagehide', stop)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', stop)
    return () => { window.removeEventListener('pagehide', stop); window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', stop); stop() }
  }, [session])
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const error = event.error as { name?: string; operation?: string } | undefined
      if (error?.name === 'PersistenceError' && error.operation === 'Web Locks ownership') {
        event.preventDefault(); session.lockError(event.error)
      }
    }
    window.addEventListener('error', onError)
    session.start()
    return () => {
      window.removeEventListener('error', onError)
      void session.stop().catch(error => console.error('Workspace cleanup failed', error))
    }
  }, [session])
  function choose(input: HTMLInputElement | null) {
    if (!session.canMutate() || !input) return
    input.value = ''; input.click()
  }
  function selected(event: ChangeEvent<HTMLInputElement>, kind: 'open' | 'import') {
    if (kind === 'open') recentRequest.current++
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) void session.openFile(file, kind)
  }
  async function openRecent(id?: string) {
    const bridge = window.desktopRecent
    if (!bridge || !session.canMutate()) return
    const token = ++recentRequest.current
    // DGM-149/151: capture the accepted-work generation before the async read.
    // New, Starter, Open or any command accepted meanwhile makes this read stale;
    // only an accepted reopen promotes the entry (no extra race framework).
    const generation = session.generation()
    try {
      if (id) {
        const file = await bridge.read(id)
        if (token !== recentRequest.current || !session.canMutate()) return
        const accepted = await session.openFile({
          name: file.name, size: new TextEncoder().encode(file.source).byteLength,
          text: async () => file.source,
        }, 'open', generation)
        if (accepted) await bridge.promote(id)
        return
      }
      const selected = id ? await bridge.read(id) : await bridge.choose()
      if ('canceled' in selected && selected.canceled) return
      const file = 'source' in selected ? selected : await bridge.readChosen(selected.id)
      if (token !== recentRequest.current || !session.canMutate()) return
      const accepted = await session.openFile({ name: file.name, size: new TextEncoder().encode(file.source).byteLength, text: async () => file.source }, 'open', generation)
      if (accepted) await bridge.acceptChosen(file.id)
    } catch (error) {
      // Session status is the established user-facing reporting surface.
      session.reportError(error, 'Recent diagrams failed: ')
    }
  }
  return <>
    <Editor {...snapshot} onCommand={session.command} onBoundaryOperation={session.boundaryOperation} onUndo={session.undo} onRedo={session.redo}
      onNew={session.newDocument} onChooseStarter={session.openStarter} onOpen={() => choose(openInput.current)} onSaveAs={() => void session.saveJson(true)} onRecent={id => void openRecent(id)} onImport={() => choose(importInput.current)}
      onSaveJson={() => void session.saveJson()} onArrange={(direction, options) => void session.arrange(direction, options)}
      onExport={options => void session.exportImage(options)} onExportDocument={options => void session.exportDocument(options)} pdfAvailable={!!window.desktopPdf} onCopyImage={options => void session.copyImage(options)} onPreviewChange={session.preview} onPresentationChange={session.presentation} onStarterOffered={session.starterOffered} onMcpGuard={session.setMcpGuard}
      onSelectPage={session.selectPage} onWorkbookCommand={session.workbookCommand} />
    <input ref={openInput} type="file" accept=".json,application/json" aria-label="Open document file" hidden onChange={event => selected(event, 'open')} />
    <input ref={importInput} type="file" accept=".json,application/json" aria-label="Import skill file" hidden onChange={event => selected(event, 'import')} />
  </>
}