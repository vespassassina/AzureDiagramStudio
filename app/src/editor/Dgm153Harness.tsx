import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { applyCommand } from '../document/index.ts'
import { createDocument, historyCommit, historyRedo, historyUndo } from '../model.ts'
import type { Diagram, History } from '../model.ts'
import type { DocumentCommand, ExportOptions } from '../contracts.ts'
import Editor from './Editor.tsx'

type Evidence = { document: Diagram; commands: (DocumentCommand | { type: 'boundary-operation' })[]; previews: (Diagram | null)[]; exports: ExportOptions[]; errors: string[] }
declare global { interface Window { __dgm153: Evidence } }

const initial = (): Diagram => ({
  ...createDocument('dgm153-browser'),
  grid: { visible: true, style: 'dots', spacing: 16, snap: false, present: false, export: false },
  entities: [
    { id: 'outer', kind: 'boundary', label: 'Outer', color: 'teal', parentId: null, x: 80, y: 80, width: 780, height: 620 },
    { id: 'inner', kind: 'boundary', label: 'Inner', color: 'teal', parentId: 'outer', x: 25, y: 65, width: 500, height: 400 },
    { id: 'child', kind: 'component', label: 'Child', icon: 'service', color: 'teal', parentId: 'inner', x: 36, y: 96, width: 220, height: 88 },
    { id: 'peer', kind: 'component', label: 'Peer', icon: 'service', color: 'teal', parentId: null, x: 1050, y: 220, width: 220, height: 88 },
  ],
})

function Harness() {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: initial(), future: [] }))
  const current = useRef(history)
  const evidence = useRef<Evidence>({ document: history.present, commands: [], previews: [], exports: [], errors: [] })
  evidence.current.document = history.present
  window.__dgm153 = evidence.current
  const update = (next: History) => { current.current = next; setHistory(next) }
  const commit = (operation: (document: Diagram) => Diagram) => {
    try {
      const next = operation(current.current.present)
      if (next !== current.current.present) update(historyCommit(current.current, next))
    } catch (error) { evidence.current.errors.push(error instanceof Error ? error.message : String(error)) }
  }
  return <Editor document={history.present} canUndo={!!history.past.length} canRedo={!!history.future.length} readOnly={false} saveState="saved" backupDirty={false} message={evidence.current.errors.at(-1) ?? ''} isArranging={false} isExporting={false}
    onCommand={command => { evidence.current.commands.push(command); commit(document => applyCommand(document, command)) }}
    onBoundaryOperation={operation => { evidence.current.commands.push({ type: 'boundary-operation' }); commit(operation) }}
    onPreviewChange={preview => { evidence.current.previews.push(preview) }}
    onUndo={() => update(historyUndo(current.current))} onRedo={() => update(historyRedo(current.current))}
    onNew={() => {}} onChooseStarter={() => false} onOpen={() => {}} onImport={() => {}} onSaveJson={() => {}}
    onArrange={() => {}} onExport={options => { evidence.current.exports.push(options) }}
  />
}

createRoot(document.getElementById('root')!).render(<Harness />)
