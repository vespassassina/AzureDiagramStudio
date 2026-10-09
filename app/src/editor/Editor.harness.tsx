import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { applyCommand } from '../document/index.ts'
import { createDocument, historyCommit, historyRedo, historyUndo, sampleDiagram } from '../model.ts'
import type { Diagram, History } from '../model.ts'
import type { DocumentCommand, ExportOptions } from '../contracts.ts'
import Editor from './Editor.tsx'

type Evidence = { document: Diagram; commands: DocumentCommand[]; previews: (Diagram | null)[]; exports: ExportOptions[]; actions: string[] }
declare global { interface Window { __editorHarness: Evidence } }

// Test host only. Production persistence, command handling, and async work belong to the root integrator.
function Harness() {
  const params = new URLSearchParams(location.search)
  const readOnly = params.has('readonly')
  const [history, setHistory] = useState<History>(() => ({ past: [], present: params.has('blank') ? createDocument('browser-blank') : sampleDiagram(), future: [] }))
  const current = useRef(history)
  const evidence = useRef<Evidence>({ document: history.present, commands: [], previews: [], exports: [], actions: [] })
  const [message, setMessage] = useState('')
  const [backupDirty, setBackupDirty] = useState(true)
  evidence.current.document = history.present
  window.__editorHarness = evidence.current
  function update(next: History) { current.current = next; setHistory(next) }
  return <Editor document={history.present} canUndo={!!history.past.length} canRedo={!!history.future.length} readOnly={readOnly} saveState={readOnly ? 'read-only' : 'saved'} backupDirty={backupDirty} message={message} isArranging={false} isExporting={false}
    onCommand={command => {
      evidence.current.commands.push(command)
      try { update(historyCommit(current.current, applyCommand(current.current.present, command))); setMessage(''); setBackupDirty(true) }
      catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    }}
    onPreviewChange={preview => { evidence.current.previews.push(preview) }}
    onUndo={() => update(historyUndo(current.current))} onRedo={() => update(historyRedo(current.current))}
    onNew={() => { evidence.current.actions.push('new'); update({ past: [], present: createDocument('browser-new'), future: [] }) }}
    onOpen={() => { evidence.current.actions.push('open') }} onImport={() => { evidence.current.actions.push('import') }}
    onSaveJson={() => { evidence.current.actions.push('save-json'); setBackupDirty(false) }}
    onArrange={direction => { evidence.current.actions.push(`arrange:${direction}`) }} onExport={options => { evidence.current.exports.push(options) }}
  />
}
createRoot(document.getElementById('root')!).render(<Harness />)