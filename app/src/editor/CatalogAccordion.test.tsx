// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const renderCounts = vi.hoisted(() => ({ row: vi.fn(), header: vi.fn(), asset: vi.fn() }))
vi.mock('lucide-react', async importOriginal => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  const { createElement } = await import('react')
  const tracked = (name: 'Plus' | 'Server' | 'Network' | 'Database' | 'Brain' | 'Workflow' | 'Shield' | 'Layers' | 'Boxes') => (props: import('lucide-react').LucideProps) => {
    (name === 'Plus' ? renderCounts.row : renderCounts.header)()
    return createElement(actual[name], props)
  }
  return { ...actual, Plus: tracked('Plus'), Server: tracked('Server'), Network: tracked('Network'), Database: tracked('Database'), Brain: tracked('Brain'), Workflow: tracked('Workflow'), Shield: tracked('Shield'), Layers: tracked('Layers'), Boxes: tracked('Boxes') }
})
const officialGlyph = vi.hoisted(() => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#0078d4" d="M0 0h16v16H0z"/></svg>'))
vi.mock('../assets.ts', () => ({ visualAssets: { icons: { get 'azure-app'() { renderCounts.asset(); return officialGlyph } } } }))
const policy = vi.hoisted(() => {
  const item = (icon: string, label: string, catalog: 'azure' | 'fabric' | 'software' = 'azure') => ({ icon, label, subtitle: '', color: 'azure', category: catalog, catalog, source: 'official' })
  const compute = [item('azure-app', 'App Service'), item('azure-function', 'Functions'), item('azure-vm', 'Virtual Machines'), item('azure-aks', 'AKS'), ...['Batch', 'Cloud Services', 'Container Apps', 'Container Instances', 'Service Fabric', 'Static Web Apps'].map(label => item(`test-${label}`, label))]
  const groups = [
    { id: 'compute', label: 'Compute & Apps', icon: 'server', items: compute, catalog: 'azure' as const },
    { id: 'network', label: 'Networking', icon: 'network', items: [item('azure-network', 'Virtual Network')], catalog: 'azure' as const },
    { id: 'storage', label: 'Storage & Databases', icon: 'database', items: [item('azure-sql', 'SQL Database')], catalog: 'azure' as const },
    { id: 'ai', label: 'AI & Analytics', icon: 'brain', items: [item('azure-ai', 'AI Search')], catalog: 'azure' as const },
    { id: 'integration', label: 'Integration', icon: 'workflow', items: [item('azure-api', 'API Management')], catalog: 'azure' as const },
    { id: 'security', label: 'Security & Management', icon: 'shield', items: [item('azure-entra', 'Entra ID')], catalog: 'azure' as const },
    { id: 'fabric', label: 'Microsoft Fabric', icon: 'layers', items: [item('fabric-onelake', 'OneLake', 'fabric'), item('fabric-lakehouse', 'Lakehouse', 'fabric'), item('fabric-warehouse', 'Warehouse', 'fabric'), item('fabric-pipeline', 'Data pipeline', 'fabric')], catalog: 'azure' as const },
    { id: 'software', label: 'Software', icon: 'layers', items: [item('service', 'Service', 'software')], catalog: 'software' as const },
  ]
  const longtail = [item('azure-test', 'Azure Test Control plane'), item('fabric-kql', 'KQL Database', 'fabric')]
  const selectionLibrary = [...groups.flatMap(group => group.items), ...longtail]
  const archived = [item('retired-bonsai', 'Bonsai'), item('fabric-onelake-old', 'OneLake variant', 'fabric')]
  const searchGroups = vi.fn((query: string) => query === 'ranked' ? [{ ...groups[0], items: [compute[0], longtail[0]] }, groups[5]] : groups.map(group => ({ ...group, items: [...group.items, ...(group.id === 'compute' ? [longtail[0]] : group.id === 'fabric' ? [longtail[1]] : [])].filter(entry => `${entry.label} ${group.label}`.toLowerCase().includes(query.trim().toLowerCase())).sort((before, after) => before.label.localeCompare(after.label)) })).filter(group => group.items.length))
  const rankedSearch = vi.fn((query: string) => query === 'ranked' ? [compute[0], groups[5].items[0], longtail[0]] : selectionLibrary.filter(entry => entry.label.toLowerCase().includes(query.trim().toLowerCase())).sort((before, after) => before.label.localeCompare(after.label)))
  return { groups, selectionLibrary, archived, searchGroups, rankedSearch, menuGroups: vi.fn((catalog: string) => groups.filter(group => group.catalog === catalog)), searchableLibrary: selectionLibrary, isSelectableIcon: (key: string) => selectionLibrary.some(entry => entry.icon === key), legacyItem: (key: string) => archived.find(entry => entry.icon === key) }
})
vi.mock('../catalog/presentation.ts', () => policy)
import { CatalogAccordion, CatalogOptions, ComponentPicker } from './CatalogAccordion.tsx'
import { DROP_TYPE, libraryItems, makeEntity, readDrop } from './interactions.ts'
const { selectionLibrary, searchGroups } = policy

afterEach(() => { cleanup(); vi.clearAllMocks() })
function setup(writable = true) {
  const onChoose = vi.fn()
  const view = render(<CatalogAccordion writable={writable} selectedIcon={null} onChoose={onChoose} />)
  return { ...view, onChoose }
}
function search(query: string) { fireEvent.change(screen.getByLabelText('Search components'), { target: { value: query } }) }

it('should_choose_the_keyboard_search_result_when_arrow_and_enter_are_pressed', () => {
  const { onChoose } = setup()
  search('App Service')
  const input = screen.getByLabelText('Search components')
  input.focus()
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
  expect(onChoose).toHaveBeenCalledExactlyOnceWith(policy.groups[0].items[0])
})

it('should_follow_displayed_group_order_wrap_both_arrows_and_restore_search_focus_on_escape', () => {
  const { onChoose } = setup()
  search('ranked')
  const input = screen.getByLabelText('Search components')
  const rows = screen.getAllByRole('button', { name: /^Insert / })
  expect(rows.map(row => row.getAttribute('data-icon'))).toEqual(['azure-app', 'azure-test', 'azure-entra'])
  input.focus()
  fireEvent.keyDown(input, { key: 'ArrowUp' })
  expect(document.activeElement).toBe(rows[2])
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(rows[0])
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(rows[1])
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(document.activeElement).toBe(input)
  expect((input as HTMLInputElement).value).toBe('')
  expect(onChoose).not.toHaveBeenCalled()
})

it('should_allow_session_favorites_in_readonly_without_nested_or_duplicate_insert_buttons', () => {
  const { onChoose, rerender } = setup(false)
  const favorite = screen.getByRole('button', { name: 'Add App Service to favorites' })
  expect(favorite.querySelector('.lucide-star')).toBeTruthy()
  expect(favorite.closest('.library-item')).toBeNull()
  fireEvent.mouseEnter(favorite)
  expect(screen.getByRole('tooltip').textContent).toBe('Add App Service to favorites')
  fireEvent.mouseLeave(favorite)
  fireEvent.click(favorite)
  expect(screen.getByRole('region', { name: 'Favorite components' })).toBeTruthy()
  expect(screen.getAllByRole('button', { name: 'Insert App Service' })).toHaveLength(1)
  expect(document.querySelector('button button')).toBeNull()
  expect(screen.getByRole('button', { name: 'Remove App Service from favorites' }).getAttribute('aria-pressed')).toBe('true')
  rerender(<CatalogAccordion writable={false} selectedIcon={null} onChoose={onChoose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Insert App Service' }))
  expect(onChoose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Clear favorite components' }))
  expect(screen.queryByRole('region', { name: 'Favorite components' })).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Insert App Service' })).toHaveLength(1)
})

it('should_limit_favorites_to_twelve_without_losing_choices_and_allow_removal_at_capacity', () => {
  const { onChoose } = setup()
  const chosen = selectionLibrary.slice(0, 13)
  for (const item of chosen.slice(0, 12)) {
    search(item.label)
    fireEvent.click(screen.getByRole('button', { name: `Add ${item.label} to favorites` }))
  }
  search(chosen[12].label)
  expect((screen.getByRole('button', { name: `Add ${chosen[12].label} to favorites` }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByRole('button', { name: `Insert ${chosen[12].label}` })).toBeTruthy()
  search('')
  expect(within(screen.getByRole('region', { name: 'Favorite components' })).getAllByRole('button', { name: /^Insert / })).toHaveLength(12)
  fireEvent.click(screen.getByRole('button', { name: `Remove ${chosen[0].label} from favorites` }))
  search(chosen[12].label)
  expect((screen.getByRole('button', { name: `Add ${chosen[12].label} to favorites` }) as HTMLButtonElement).disabled).toBe(false)
  expect(onChoose).not.toHaveBeenCalled()
})

it('should_bound_deduplicate_and_clear_recent_rows_without_copying_them_into_search', () => {
  const icons = selectionLibrary.slice(0, 11).map(item => item.icon)
  const clear = vi.fn()
  render(<CatalogAccordion writable selectedIcon={null} recentIcons={[icons[0], icons[0], 'retired-bonsai', ...icons.slice(1)]} onClearRecents={clear} onChoose={vi.fn()} />)
  const recent = screen.getByRole('region', { name: 'Recent components' })
  expect(recent.querySelector('.lucide-clock')).toBeTruthy()
  expect(recent.querySelector('.lucide-clock')?.parentElement?.getAttribute('title')).toBe('Recent components')
  expect(within(recent).getAllByRole('button', { name: /^Insert / }).map(row => row.getAttribute('data-icon'))).toEqual(icons.slice(0, 8))
  expect(screen.getAllByRole('button', { name: 'Insert App Service' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Add App Service to favorites' }))
  expect(within(screen.getByRole('region', { name: 'Recent components' })).queryByRole('button', { name: 'Insert App Service' })).toBeNull()
  search('App Service')
  expect(screen.queryByRole('region', { name: 'Recent components' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Favorite components' })).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Insert App Service' })).toHaveLength(1)
  search('')
  fireEvent.click(screen.getByRole('button', { name: 'Clear recent components' }))
  expect(clear).toHaveBeenCalledExactlyOnceWith()
})

it('should_keep_caller_owned_favorites_controlled_and_forward_only_to_latest_callbacks', () => {
  const original = vi.fn(), latest = vi.fn(), clear = vi.fn()
  const view = render(<CatalogAccordion writable selectedIcon={null} favoriteIcons={['azure-app']} onToggleFavorite={original} onClearFavorites={clear} onChoose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remove App Service from favorites' }))
  expect(original).toHaveBeenCalledExactlyOnceWith('azure-app')
  expect(screen.getByRole('region', { name: 'Favorite components' })).toBeTruthy()
  view.rerender(<CatalogAccordion writable selectedIcon={null} favoriteIcons={['azure-app']} onToggleFavorite={latest} onClearFavorites={clear} onChoose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remove App Service from favorites' }))
  expect(latest).toHaveBeenCalledExactlyOnceWith('azure-app')
  fireEvent.click(screen.getByRole('button', { name: 'Clear favorite components' }))
  expect(clear).toHaveBeenCalledExactlyOnceWith()
  view.rerender(<CatalogAccordion writable selectedIcon={null} favoriteIcons={[]} onToggleFavorite={latest} onClearFavorites={clear} onChoose={vi.fn()} />)
  expect(screen.queryByRole('region', { name: 'Favorite components' })).toBeNull()
  expect(screen.getAllByRole('button', { name: 'Insert App Service' })).toHaveLength(1)
})

it('should_keep_favorite_rows_draggable_and_never_treat_the_star_enter_as_a_choice', () => {
  const { onChoose } = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Add App Service to favorites' }))
  const row = within(screen.getByRole('region', { name: 'Favorite components' })).getByRole('button', { name: 'Insert App Service' })
  const transfer = { setData: vi.fn(), effectAllowed: '' }
  fireEvent.dragStart(row, { dataTransfer: transfer })
  expect(transfer.setData).toHaveBeenCalledExactlyOnceWith(DROP_TYPE, JSON.stringify({ icon: 'azure-app' }))
  expect(transfer.effectAllowed).toBe('copy')
  search('App Service')
  fireEvent.keyDown(screen.getByRole('button', { name: 'Remove App Service from favorites' }), { key: 'Enter' })
  expect(onChoose).not.toHaveBeenCalled()
})

it('should_export_a_flat_ranked_picker_with_all_matching_choices_and_keyboard_selection', () => {
  const onChoose = vi.fn(), onCancel = vi.fn()
  render(<ComponentPicker onChoose={onChoose} onCancel={onCancel} />)
  const dialog = screen.getByRole('dialog', { name: 'Choose component' })
  const input = within(dialog).getByLabelText('Search components')
  expect(document.activeElement).toBe(input)
  expect(within(dialog).getAllByRole('button', { name: /^Insert / })).toHaveLength(selectionLibrary.length)
  fireEvent.change(input, { target: { value: 'ranked' } })
  expect(within(dialog).getAllByRole('button', { name: /^Insert / }).map(row => row.getAttribute('data-icon'))).toEqual(['azure-app', 'azure-entra', 'azure-test'])
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
  expect(onChoose).toHaveBeenCalledExactlyOnceWith(policy.groups[5].items[0])
  expect(onCancel).not.toHaveBeenCalled()
})

it.each(['Escape', 'button'])('should_cancel_picker_and_restore_opener_focus_when_using_%s', method => {
  const opener = document.createElement('button')
  document.body.append(opener); opener.focus()
  const onChoose = vi.fn(), onCancel = vi.fn()
  const view = render(<ComponentPicker onChoose={onChoose} onCancel={onCancel} />)
  if (method === 'Escape') fireEvent.keyDown(screen.getByLabelText('Search components'), { key: 'Escape' })
  else fireEvent.click(screen.getByRole('button', { name: 'Cancel component picker' }))
  expect(onCancel).toHaveBeenCalledExactlyOnceWith()
  expect(onChoose).not.toHaveBeenCalled()
  view.unmount()
  expect(document.activeElement).toBe(opener)
  opener.remove()
})

it('should_trap_picker_focus_and_ignore_composing_enter_and_readonly_selection', () => {
  const onChoose = vi.fn()
  const view = render(<ComponentPicker onChoose={onChoose} onCancel={vi.fn()} />)
  const input = screen.getByLabelText('Search components')
  const cancel = screen.getByRole('button', { name: 'Cancel component picker' })
  cancel.focus()
  fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(screen.getAllByRole('button', { name: /^Insert / }).at(-1))
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel component picker' }))
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  expect(onChoose).not.toHaveBeenCalled()
  view.rerender(<ComponentPicker writable={false} onChoose={onChoose} onCancel={vi.fn()} />)
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChoose).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: 'Insert App Service' }) as HTMLButtonElement).disabled).toBe(true)
})

it('should_mount_only_compute_with_policy_pins_and_alphabetical_tail_when_first_opened', () => {
  setup()
  expect(screen.getByRole('button', { name: 'Insert App Service' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Insert Azure Test' })).toBeNull()
  expect(screen.getAllByRole('tab')).toHaveLength(2)
  expect(screen.queryByRole('tab', { name: /^Fabric/ })).toBeNull()
  expect(document.querySelectorAll('.catalog-group-toggle')).toHaveLength(7)
  for (const button of document.querySelectorAll('.catalog-group-toggle')) expect(button.querySelectorAll('svg')).toHaveLength(2)
  expect(screen.getAllByRole('button', { name: /^Insert / }).map(button => button.getAttribute('data-icon'))).toEqual(policy.groups[0].items.map(item => item.icon))
  const header = screen.getByRole('button', { name: 'Azure / Microsoft: Compute & Apps (10)' })
  expect(header.getAttribute('aria-expanded')).toBe('true')
  expect(document.getElementById(header.getAttribute('aria-controls')!)?.querySelectorAll('.library-item')).toHaveLength(10)
  fireEvent.click(header)
  expect(header.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByRole('button', { name: 'Insert App Service' })).toBeNull()
  expect(document.getElementById(header.getAttribute('aria-controls')!)).toBeNull()
})
it('should_allow_multiple_groups_and_keep_them_open_when_parent_rerenders', () => {
  const { rerender, onChoose } = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Azure / Microsoft: Networking (1)' }))
  rerender(<CatalogAccordion writable selectedIcon="azure-network" onChoose={onChoose} />)
  expect(screen.getAllByRole('button', { name: /^Insert / })).toHaveLength(11)
  expect(onChoose).not.toHaveBeenCalled()
})
it('should_skip_row_and_header_rendering_when_only_document_and_latest_handler_change', () => {
  const chosen = vi.fn()
  function Parent({ document }: { document: { revision: number; label: string } }) {
    return <CatalogAccordion writable selectedIcon={null} onChoose={item => chosen(document, item)} />
  }
  const view = render(<Parent document={{ revision: 0, label: 'OriginalDoc' }} />)
  expect(renderCounts.row).toHaveBeenCalledTimes(10)
  expect(renderCounts.header).toHaveBeenCalledTimes(7)
  const assetReads = renderCounts.asset.mock.calls.length
  const markup = view.container.innerHTML
  const latest = { revision: 20, label: 'LatestOriginalDoc' }
  for (let revision = 1; revision <= 20; revision++) view.rerender(<Parent document={revision === 20 ? latest : { revision, label: 'NudgedDoc' }} />)
  expect(view.container.innerHTML).toBe(markup)
  fireEvent.click(screen.getByRole('button', { name: 'Insert App Service' }))
  expect(chosen).toHaveBeenCalledExactlyOnceWith(latest, policy.groups[0].items[0])
  expect.soft(renderCounts.row).toHaveBeenCalledTimes(10)
  expect.soft(renderCounts.header).toHaveBeenCalledTimes(7)
  expect.soft(renderCounts.asset).toHaveBeenCalledTimes(assetReads)
})
it('should_refresh_picked_and_disabled_rows_without_repainting_static_headers', () => {
  const original = vi.fn(), latest = vi.fn()
  const view = render(<CatalogAccordion writable selectedIcon="azure-app" onChoose={original} />)
  const app = screen.getByRole('button', { name: 'Insert App Service' }) as HTMLButtonElement
  const functions = screen.getByRole('button', { name: 'Insert Functions' }) as HTMLButtonElement
  expect(app.classList.contains('picked')).toBe(true)
  expect(app.querySelector('img')?.getAttribute('src')).toBe(officialGlyph)
  expect((app.querySelector('.library-glyph') as HTMLElement).style.background).toBe('rgb(239, 247, 255)')
  view.rerender(<CatalogAccordion writable selectedIcon="azure-function" onChoose={latest} />)
  expect(app.classList.contains('picked')).toBe(false)
  expect(functions.classList.contains('picked')).toBe(true)
  expect(renderCounts.row).toHaveBeenCalledTimes(12)
  expect(renderCounts.header).toHaveBeenCalledTimes(7)
  fireEvent.click(app)
  expect(latest).toHaveBeenCalledExactlyOnceWith(policy.groups[0].items[0])
  expect(original).not.toHaveBeenCalled()
  view.rerender(<CatalogAccordion writable={false} selectedIcon="azure-function" onChoose={original} />)
  expect(app.disabled).toBe(true)
  expect(app.draggable).toBe(false)
  fireEvent.click(app)
  expect(original).not.toHaveBeenCalled()
  view.rerender(<CatalogAccordion writable selectedIcon="azure-app" onChoose={latest} />)
  expect(app.disabled).toBe(false)
  expect(app.draggable).toBe(true)
  expect(app.classList.contains('picked')).toBe(true)
  expect(app.querySelector('img')?.getAttribute('src')).toBe(officialGlyph)
  expect(renderCounts.header).toHaveBeenCalledTimes(7)
  fireEvent.click(screen.getByRole('button', { name: 'Azure / Microsoft: Networking (1)' }))
  expect(screen.getByRole('button', { name: 'Insert Virtual Network' })).toBeTruthy()
  search('OneLake')
  expect(screen.getByRole('button', { name: 'Insert OneLake' })).toBeTruthy()
})
it('should_expand_fabric_inside_azure_without_a_third_tab', () => {
  setup()
  const header = screen.getByRole('button', { name: 'Azure / Microsoft: Microsoft Fabric (4)' })
  expect(header.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(header)
  expect(screen.getByRole('button', { name: 'Insert OneLake' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Insert App Service' })).toBeTruthy()
})
it.each(['OneLake', 'Lakehouse', 'KQL', 'pipeline', 'Control plane'])('should_autoexpand_unique_global_rows_when_searching_%s_from_software', query => {
  setup()
  fireEvent.click(screen.getByRole('tab', { name: /^Software/ }))
  search(query)
  const expected = searchGroups(query).flatMap(group => group.items)
  expect(screen.getAllByRole('button', { name: /^Insert / }).map(button => button.getAttribute('aria-label'))).toEqual(expected.map(item => `Insert ${item.label}`))
  for (const header of document.querySelectorAll('.catalog-group-toggle')) expect(header.getAttribute('aria-expanded')).toBe('true')
  expect(new Set(screen.getAllByRole('button', { name: /^Insert / }).map(button => button.getAttribute('data-icon'))).size).toBe(expected.length)
})
it('should_restore_prior_tab_and_expansion_state_when_global_search_is_cleared', () => {
  setup()
  fireEvent.click(screen.getByRole('button', { name: 'Azure / Microsoft: Compute & Apps (10)' }))
  fireEvent.click(screen.getByRole('button', { name: 'Azure / Microsoft: Networking (1)' }))
  search('OneLake')
  expect(screen.getByRole('button', { name: 'Insert OneLake' })).toBeTruthy()
  search('')
  expect(screen.getByRole('tab', { name: /^Azure/ }).getAttribute('aria-selected')).toBe('true')
  expect(screen.queryByRole('button', { name: 'Insert App Service' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Insert Virtual Network' })).toBeTruthy()
})
it('should_allow_readonly_search_and_expansion_but_disable_click_and_drag', () => {
  const { onChoose } = setup(false)
  search('OneLake')
  const row = screen.getByRole('button', { name: 'Insert OneLake' }) as HTMLButtonElement
  expect(row.disabled).toBe(true)
  expect(row.draggable).toBe(false)
  fireEvent.click(row)
  expect(onChoose).not.toHaveBeenCalled()
  search('')
  fireEvent.click(screen.getByRole('button', { name: 'Azure / Microsoft: Compute & Apps (10)' }))
  expect(screen.queryByRole('button', { name: 'Insert App Service' })).toBeNull()
})
it('should_show_an_explicit_empty_state_when_search_has_no_matches', () => {
  setup()
  search('Bonsai')
  expect(screen.getByText('No matching components')).toBeTruthy()
  expect(screen.queryAllByRole('button', { name: /^Insert / })).toHaveLength(0)
})
it('should_reuse_current_canonical_options_including_search_only_when_selection_changes', () => {
  const view = render(<select aria-label="Types"><CatalogOptions /></select>)
  const select = screen.getByLabelText('Types')
  expect(within(select).getAllByRole('option').map(option => (option as HTMLOptionElement).value).sort()).toEqual(selectionLibrary.map(item => item.icon).sort())
  vi.mocked(searchGroups).mockClear()
  const options = Array.from(select.querySelectorAll('option'))
  view.rerender(<select aria-label="Types" value="fabric-onelake" onChange={() => {}}><CatalogOptions /></select>)
  expect(Array.from(select.querySelectorAll('option'))).toEqual(options)
  expect(searchGroups).not.toHaveBeenCalled()
})
it.each(['retired-bonsai', 'fabric-onelake-old'])('should_preserve_the_exact_saved_legacy_option_when_selected_%s', key => {
  render(<select aria-label="Types" value={key} onChange={() => {}}><CatalogOptions currentIcon={key} /></select>)
  const select = screen.getByLabelText('Types') as HTMLSelectElement
  expect(select.value).toBe(key)
  expect(select.selectedOptions[0].textContent).toContain('(Saved legacy icon)')
  expect(within(select).getAllByRole('option')).toHaveLength(selectionLibrary.length + 1)
})
it('should_refresh_saved_legacy_options_when_current_icon_changes', () => {
  const view = render(<select aria-label="Types" value="retired-bonsai" onChange={() => {}}><CatalogOptions currentIcon="retired-bonsai" /></select>)
  const select = screen.getByLabelText('Types') as HTMLSelectElement
  const currentOptions = Array.from(select.querySelectorAll('option')).filter(option => option.value !== 'retired-bonsai')
  view.rerender(<select aria-label="Types" value="fabric-onelake-old" onChange={() => {}}><CatalogOptions currentIcon="fabric-onelake-old" /></select>)
  expect(select.value).toBe('fabric-onelake-old')
  expect(select.selectedOptions[0].textContent).toBe('OneLake variant (Saved legacy icon)')
  expect(select.querySelector('option[value="retired-bonsai"]')).toBeNull()
  view.rerender(<select aria-label="Types" value="azure-app" onChange={() => {}}><CatalogOptions currentIcon="azure-app" /></select>)
  expect(Array.from(select.querySelectorAll('option'))).toEqual(currentOptions)
  expect(select.querySelector('option[value="fabric-onelake-old"]')).toBeNull()
})
it('should_recognize_only_selection_policy_keys_when_drag_payloads_are_read', () => {
  expect(libraryItems).toEqual(selectionLibrary)
  for (const item of selectionLibrary) {
    expect(readDrop(JSON.stringify({ icon: item.icon, label: 'Untrusted label' }))).toEqual(item)
    expect(makeEntity('component', { x: 83, y: 99 }, 'inserted', item)).toMatchObject({ icon: item.icon, label: item.label, subtitle: item.subtitle, color: item.color, x: 80, y: 96, parentId: null })
  }
  for (const icon of ['retired-bonsai', 'fabric-onelake-old', '__proto__', 'constructor', 'toString', '../../evil.svg']) expect(readDrop(JSON.stringify({ icon }))).toBeNull()
})
it('should_move_keyboard_focus_between_only_azure_and_software_tabs', () => {
  setup()
  fireEvent.keyDown(screen.getByRole('tab', { name: /^Azure/ }), { key: 'ArrowRight' })
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: /^Software/ }))
  fireEvent.keyDown(document.activeElement!, { key: 'Home' })
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: /^Azure/ }))
})