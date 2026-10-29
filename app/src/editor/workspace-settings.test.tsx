// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog.tsx'

afterEach(() => { cleanup(); delete window.desktopWorkspace })
it('should_explain_browser_limitation_without_exposing_desktop_controls', () => {
  render(<SettingsDialog onClose={() => {}} />)
  expect(screen.getByText(/workspace root configuration.*desktop/i)).toBeTruthy()
})
it('should_display_saved_root_cancel_failure_and_reset_truthfully', async () => {
  window.desktopWorkspace = {
    read: vi.fn(async () => ({ root: 'C:\\owned\\Documents\\AzureDiagramStudio', isDefault: true })),
    choose: vi.fn(async () => ({ canceled: true as const })),
    reset: vi.fn(async () => ({ root: 'C:\\owned\\Documents\\AzureDiagramStudio', isDefault: true })),
    save: vi.fn(),
  }
  render(<SettingsDialog onClose={() => {}} />)
  await screen.findByText('C:\\owned\\Documents\\AzureDiagramStudio')
  fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }))
  await screen.findByText(/folder selection canceled/i)
  vi.mocked(window.desktopWorkspace.choose).mockRejectedValueOnce(new Error('disk denied'))
  fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }))
  await screen.findByText(/disk denied/i)
  fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }))
  await screen.findByText(/workspace root saved/i)
})
