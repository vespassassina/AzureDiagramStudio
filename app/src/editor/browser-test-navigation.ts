import { expect } from 'vitest'
import type { Page } from '@playwright/test'

export async function fileCommand(page: Page, label: string) {
  const trigger = page.getByRole('menubar', { name: 'Application menus', exact: true })
    .getByRole('menuitem', { name: 'File menu', exact: true })
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
  return page.getByRole('menu', { name: 'File', exact: true }).getByRole('menuitem', { name: label, exact: true })
}

export async function editableApp(page: Page, fresh = false) {
  if (fresh) await page.getByRole('dialog', { name: 'New diagram', exact: true }).getByRole('button', { name: 'Blank', exact: true }).click()
  const newDiagram = await fileCommand(page, 'New diagram')
  await expect.poll(() => newDiagram.isEnabled()).toBe(true)
  await newDiagram.press('Escape')
}

export async function openDocumentProperties(page: Page) {
  await page.getByRole('button', { name: 'Commands', exact: true }).click()
  await page.getByRole('dialog', { name: 'Commands', exact: true })
    .getByRole('option', { name: 'Document properties', exact: true }).click()
}
