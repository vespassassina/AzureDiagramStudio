import { StrictMode, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import type { EditorProps } from '../contracts.ts'
import Editor from '../editor/Editor.tsx'
import { sampleDiagram } from '../model.ts'
import { exportPng, exportSvg } from '../export.ts'
import { ThemeToggle, useTheme } from './index.ts'

function Harness() {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const { theme, preferenceError } = useTheme()
  const diagram = useRef(sampleDiagram())
  const evidence = useRef({ commands: [] as unknown[], previews: [] as unknown[], actions: [] as string[], exports: [] as unknown[] })
  const readOnly = new URLSearchParams(location.search).has('readonly')
  useLayoutEffect(() => {
    const rail = document.querySelector('.tool-rail')
    if (!rail || rail.querySelector('.theme-toggle')) return
    const target = document.createElement('span')
    target.className = 'theme-harness-slot'
    rail.appendChild(target)
    setSlot(target)
    return () => target.remove()
  }, [])
  const props: EditorProps = {
    document: diagram.current, canUndo: false, canRedo: false, readOnly, saveState: readOnly ? 'read-only' : 'saved', backupDirty: true, message: '', isArranging: false, isExporting: false,
    onCommand: command => { evidence.current.commands.push(command) }, onPreviewChange: preview => { evidence.current.previews.push(preview) },
    onUndo: () => { evidence.current.actions.push('undo') }, onRedo: () => { evidence.current.actions.push('redo') },
    onNew: () => { evidence.current.actions.push('new') }, onOpen: () => { evidence.current.actions.push('open') }, onImport: () => { evidence.current.actions.push('import') },
    onSaveJson: () => { evidence.current.actions.push('save-json') }, onArrange: () => { evidence.current.actions.push('arrange') }, onExport: options => { evidence.current.exports.push(options) },
  }
  Object.assign(window, { __themeHarness: {
    theme, preferenceError, document: diagram.current, evidence: evidence.current,
    svg: (transparent = false) => exportSvg(diagram.current, transparent),
    png: async (transparent = false) => Array.from(new Uint8Array(await (await exportPng(diagram.current, 1, transparent)).arrayBuffer())),
  } })
  return <><Editor {...props} />{slot && createPortal(<ThemeToggle />, slot)}</>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>)