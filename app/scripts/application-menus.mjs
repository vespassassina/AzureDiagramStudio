// Current source uses menus; historical release runners may still target direct
// buttons. Both paths use actual visible controls and trusted pointer activation.
export async function applicationCommand(page, label) {
  const bar = page.getByRole('menubar', { name: 'Application menus', exact: true })
  if (!await bar.count()) return page.getByRole('button', { name: label, exact: true })
  const menu = ['New diagram', 'Open JSON', 'Import skill JSON', 'Save JSON'].includes(label) ? 'File'
    : label.startsWith('Switch to ') ? 'View' : 'Settings'
  const trigger = bar.getByRole('menuitem', { name: `${menu} menu`, exact: true })
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
  return page.getByRole('menu', { name: menu, exact: true }).getByRole(label.startsWith('Switch to ') ? 'menuitemcheckbox' : 'menuitem', { name: label, exact: true })
}

export async function clickApplicationCommand(page, label) {
  await (await applicationCommand(page, label)).click()
}
