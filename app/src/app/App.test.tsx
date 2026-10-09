// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorProps } from '../contracts.ts'
import { createDocument } from '../model.ts'
import App from '../App.tsx'

const host = vi.hoisted(() => ({ props: undefined as EditorProps | undefined, leases: [] as ((owns: boolean) => void)[], release: vi.fn(), close: vi.fn(), save: vi.fn(async () => {}), load: vi.fn(async () => null), download: vi.fn(), confirmReplace: vi.fn(() => true) }))
vi.mock('../editor/Editor.tsx', () => ({ default: (props: EditorProps) => { host.props = props; return <div>{props.document?.title}</div> } }))
vi.mock('./browser.ts', () => ({ browserDependencies: {
  createStorage: () => ({ load: host.load, save: host.save, close: host.close }),
  watchLock: (callback: (owns: boolean) => void) => { host.leases.push(callback); callback(false); return host.release },
  download: host.download, confirmReplace: host.confirmReplace, newId: () => 'new-document',
} }))
afterEach(() => { cleanup(); vi.clearAllMocks(); host.leases.length = 0 })

describe('DGM-040 root integration', () => {
  it('should_render_controlled_editor_and_wait_for_lock_under_strictmode', async () => {
    render(<StrictMode><App /></StrictMode>)
    await waitFor(() => expect(host.leases).toHaveLength(2))
    expect(host.props?.document.title).toBe('Commerce platform')
    expect(host.props?.readOnly).toBe(true)
    await act(async () => { host.leases[1](true) })
    expect(host.props?.readOnly).toBe(false)
    expect(host.release).toHaveBeenCalledOnce()
    expect(host.close).toHaveBeenCalledOnce()
    act(() => host.props?.onCommand({ type: 'metadata', patch: { title: 'Integrated' } }))
    expect(host.props?.document.title).toBe('Integrated')
    expect(host.props?.canUndo).toBe(true)
    act(() => host.props?.onUndo())
    expect(host.props?.document.title).toBe('Commerce platform')
  })
  it('should_open_file_picker_without_dropping_current_work_or_prompting_prematurely', async () => {
    const view = render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    act(() => host.props?.onCommand({ type: 'metadata', patch: { title: 'Keep this' } }))
    act(() => host.props?.onOpen())
    expect(host.props?.document.title).toBe('Keep this')
    expect(host.confirmReplace).not.toHaveBeenCalled()
    const input = view.getByLabelText('Open document file') as HTMLInputElement
    expect(input.accept).toBe('.json,application/json')
    await act(async () => { input.dispatchEvent(new Event('cancel', { bubbles: true })) })
    expect(host.props?.document.title).toBe('Keep this')
    const file = new File(['valid'], 'roundtrip.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(createDocument('portable', 'Opened')) })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(host.props?.document.title).toBe('Opened')
    expect(host.props?.backupDirty).toBe(false)
    expect(host.confirmReplace).toHaveBeenCalledOnce()
  })
  it('should_surface_async_lock_failure_and_disable_all_mutation_callbacks', async () => {
    render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    const error = Object.assign(new Error('Ownership rejected'), { name: 'PersistenceError', operation: 'Web Locks ownership' })
    act(() => window.dispatchEvent(new ErrorEvent('error', { error, message: error.message, cancelable: true })))
    expect(host.props?.readOnly).toBe(true)
    expect(host.props?.message).toContain('lock failed')
    act(() => host.props?.onNew())
    expect(host.props?.document.title).toBe('Commerce platform')
    expect(host.confirmReplace).not.toHaveBeenCalled()
  })
})