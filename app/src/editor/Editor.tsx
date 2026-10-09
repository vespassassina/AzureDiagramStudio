import { ReactFlowProvider } from '@xyflow/react'
import type { EditorProps } from '../contracts.ts'
import EditorSurface from './EditorSurface.tsx'
import '@xyflow/react/dist/style.css'
import './editor.css'

export default function Editor(props: EditorProps) { return <ReactFlowProvider><EditorSurface {...props} /></ReactFlowProvider> }
