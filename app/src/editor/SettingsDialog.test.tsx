// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog.tsx'
import type { DesktopMcp } from '../app/mcp.ts'

afterEach(() => { cleanup(); delete window.desktopMcp })
it('should_report_desktop_only_in_browser_and_contain_focus_and_escape_DGM131', () => {
  const close = vi.fn()
  render(<SettingsDialog onClose={close} />)
  const dialog = screen.getByRole('dialog', { name: 'Settings' })
  expect(dialog.textContent).toMatch(/desktop.*required/i)
  expect(within(dialog).getByRole('button', { name: 'Copy MCP address' }).hasAttribute('disabled')).toBe(true)
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close Settings' }))
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Done' }))
  fireEvent.keyDown(window, { key: 'Escape', isComposing: true })
  expect(close).not.toHaveBeenCalled()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(close).toHaveBeenCalledOnce()
})
it('should_show_actual_address_scope_and_copy_feedback_without_displaying_token_DGM131', async () => {
  const bridge: DesktopMcp = {
    status: vi.fn(async () => ({ state: 'running' as const, address: 'http://127.0.0.1:49123/mcp', snapshotAvailable: true })),
    copyAddress: vi.fn(async () => ({ ok: true as const })), copyToken: vi.fn(async () => ({ ok: false as const, message: 'Clipboard copy failed.' })),
    publishSnapshot: vi.fn(),
  }
  window.desktopMcp = bridge
  render(<SettingsDialog onClose={() => {}} />)
  await screen.findByText('http://127.0.0.1:49123/mcp')
  expect(screen.getByRole('dialog').textContent).toMatch(/read and write/i)
  expect(screen.getByRole('dialog').textContent).toMatch(/restart/i)
  fireEvent.click(screen.getByRole('button', { name: 'Copy MCP address' }))
  await screen.findByText('MCP address copied.')
  fireEvent.click(screen.getByRole('button', { name: 'Copy access token' }))
  await screen.findByText('Clipboard copy failed.')
  expect(bridge.copyToken).toHaveBeenCalledOnce()
  vi.mocked(bridge.copyToken).mockResolvedValueOnce({ ok: true })
  fireEvent.click(screen.getByRole('button', { name: 'Copy access token' }))
  await screen.findByText('Access token copied.')
})
it('should_report_bridge_failure_and_unavailable_snapshot_honestly_DGM131', async () => {
  window.desktopMcp = { status: vi.fn(async () => { throw new Error('bridge gone') }), copyAddress: vi.fn(), copyToken: vi.fn(), publishSnapshot: vi.fn() }
  render(<SettingsDialog onClose={() => {}} />)
  await waitFor(() => expect(screen.getByRole('dialog').textContent).toMatch(/bridge unavailable/i))
  expect(screen.getByRole('button', { name: 'Copy access token' }).hasAttribute('disabled')).toBe(true)
})
