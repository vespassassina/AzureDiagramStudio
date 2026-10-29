import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent } from 'react'
import Editor from './editor/Editor.tsx'
import { createSession } from './app/session.ts'
import { browserDependencies } from './app/browser.ts'
import { publishMcpSession, listenMcpMutations } from './app/mcp.ts'

export default function App() {
  const [session] = useState(() => createSession(browserDependencies))
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const openInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!window.desktopMcp) return
    const stopPublish = publishMcpSession(session, window.desktopMcp)
    const stopMutations = listenMcpMutations(session, window.desktopMcp)
    const stop = () => { stopMutations(); stopPublish() }
    window.addEventListener('pagehide', stop)
    window.addEventListener('error', stop)
    window.addEventListener('unhandledrejection', stop)
    return () => { window.removeEventListener('pagehide', stop); window.removeEventListener('error', stop); window.removeEventListener('unhandledrejection', stop); stop() }
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
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) void session.openFile(file, kind)
  }
  return <>
    <Editor {...snapshot} onCommand={session.command} onUndo={session.undo} onRedo={session.redo}
      onNew={session.newDocument} onChooseStarter={session.openStarter} onOpen={() => choose(openInput.current)} onImport={() => choose(importInput.current)}
      onSaveJson={() => void session.saveJson()} onArrange={(direction, options) => void session.arrange(direction, options)}
      onExport={options => void session.exportImage(options)} onCopyImage={options => void session.copyImage(options)} onPreviewChange={session.preview} onPresentationChange={session.presentation} onStarterOffered={session.starterOffered} onMcpGuard={session.setMcpGuard} />
    <input ref={openInput} type="file" accept=".json,application/json" aria-label="Open document file" hidden onChange={event => selected(event, 'open')} />
    <input ref={importInput} type="file" accept=".json,application/json" aria-label="Import skill file" hidden onChange={event => selected(event, 'import')} />
  </>
}