import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AppWindow, Building2, Boxes, Brain, ChevronDown, Database, Layers, Network, Plus, Search, Server, Shield, Workflow } from 'lucide-react'
import { GENERIC_ICONS, resolveColor } from '../catalog.ts'
import { isSelectableIcon, legacyItem, menuGroups, searchableLibrary, searchGroups, selectionLibrary } from '../catalog/presentation.ts'
import { visualAssets } from '../assets.ts'
import { DROP_TYPE } from './interactions.ts'
import type { LibraryItem } from './interactions.ts'

const groups = [...menuGroups('azure'), ...menuGroups('software')]
const computeGroup = groups.find(group => group.catalog === 'azure' && group.items.some(item => item.icon === 'azure-app'))
const selectionKeys = new Set(selectionLibrary.map(item => item.icon))
const optionGroups = searchGroups('').map(group => ({ ...group, items: group.items.filter(item => selectionKeys.has(item.icon)) }))
const catalogs = [{ id: 'azure', label: 'Azure / Microsoft', count: searchableLibrary.filter(item => item.catalog !== 'software').length }, { id: 'software', label: 'Software', count: searchableLibrary.filter(item => item.catalog === 'software').length }] as const
const catalogLabels = { azure: 'Azure / Microsoft', software: 'Software' }
const groupIcons = { server: Server, network: Network, database: Database, brain: Brain, workflow: Workflow, shield: Shield, layers: Layers, boxes: Boxes, 'app-window': AppWindow, building: Building2 }

const CurrentCatalogOptions = memo(function CurrentCatalogOptions() {
  return <>{optionGroups.map(group => <optgroup key={group.id} label={`${catalogLabels[group.catalog]}: ${group.label}`}>{group.items.map(item => <option key={item.icon} value={item.icon}>{item.label}</option>)}</optgroup>)}</>
})

export const CatalogOptions = memo(function CatalogOptions({ currentIcon }: { currentIcon?: string } = {}) {
  const legacy = currentIcon && !isSelectableIcon(currentIcon) ? legacyItem(currentIcon) : undefined
  return <><CurrentCatalogOptions />{legacy && <option value={legacy.icon}>{legacy.label} (Saved legacy icon)</option>}</>
})

type CatalogProps = { writable: boolean; selectedIcon: string | null; onChoose(item: LibraryItem): void }

const CatalogRow = memo(function CatalogRow({ item, writable, picked, onChoose }: { item: LibraryItem; writable: boolean; picked: boolean; onChoose(item: LibraryItem): void }) {
  const Glyph = GENERIC_ICONS[item.icon as keyof typeof GENERIC_ICONS]
  const asset = visualAssets.icons?.[item.icon]
  const color = resolveColor(item.color)
  return <button type="button" data-icon={item.icon} className={`library-item ${picked ? 'picked' : ''}`} title={`Insert ${item.label}`} aria-label={`Insert ${item.label}`} disabled={!writable} draggable={writable} onDragStart={event => {
    if (!writable) { event.preventDefault(); return }
    event.dataTransfer.setData(DROP_TYPE, JSON.stringify({ icon: item.icon })); event.dataTransfer.effectAllowed = 'copy'
  }} onClick={() => { if (writable) onChoose(item) }}><span className="library-glyph" style={{ background: color.light, color: color.main }}>{asset ? <img src={asset} alt="" /> : Glyph ? <Glyph size={21} strokeWidth={1.6} /> : null}</span><span className="library-label"><strong>{item.label}</strong>{item.subtitle && <small>{item.subtitle}</small>}</span><Plus size={14} className="insert-symbol" /></button>
})

const CatalogGroupHeader = memo(function CatalogGroupHeader({ group, expanded, searching, rowsId, onToggle }: { group: (typeof groups)[number]; expanded: boolean; searching: boolean; rowsId: string; onToggle(id: string): void }) {
  const GroupIcon = groupIcons[group.icon as keyof typeof groupIcons]
  return <button type="button" className="catalog-group-toggle" aria-label={`${catalogLabels[group.catalog]}: ${group.label} (${group.items.length})`} aria-expanded={expanded} aria-controls={rowsId} aria-disabled={searching || undefined} onClick={() => onToggle(group.id)}><GroupIcon size={16} className="catalog-group-icon" aria-hidden="true" /><ChevronDown size={14} className="catalog-chevron" aria-hidden="true" /><span className="catalog-group-label">{searching && <small>{catalogLabels[group.catalog]}</small>}{group.label}</span><span className="catalog-group-count">{group.items.length}</span></button>
})

export function CatalogAccordion({ onChoose, ...props }: CatalogProps) {
  const latestChoose = useRef(onChoose)
  useLayoutEffect(() => { latestChoose.current = onChoose }, [onChoose])
  const choose = useCallback((item: LibraryItem) => latestChoose.current(item), [])
  return <CatalogContent {...props} onChoose={choose} />
}

const CatalogContent = memo(function CatalogContent({ writable, selectedIcon, onChoose }: CatalogProps) {
  const prefix = useId()
  const [tab, setTab] = useState<'azure' | 'software'>('azure')
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState(() => new Set(groups.filter(group => group.id === computeGroup?.id || (group.catalog === 'software' && group.items.length <= 12)).map(group => group.id)))
  const searching = !!query.trim()
  const visibleGroups = useMemo(() => searching ? searchGroups(query) : groups.filter(group => group.catalog === tab), [searching, query, tab])

  const toggle = useCallback((id: string) => {
    if (searching) return
    setOpenGroups(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [searching])

  return <>
    <div className="library-search"><Search size={15} /><input aria-label="Search components" placeholder="Search components" value={query} onChange={event => setQuery(event.target.value)} /></div>
    <div className="tabs" role="tablist" aria-label="Component catalogs">{catalogs.map((catalog, index) => <button type="button" key={catalog.id} id={`${prefix}-tab-${catalog.id}`} role="tab" aria-selected={tab === catalog.id} aria-controls={`${prefix}-catalog`} tabIndex={tab === catalog.id ? 0 : -1} className={tab === catalog.id ? 'selected' : ''} onClick={() => { setTab(catalog.id); setQuery('') }} onKeyDown={event => {
      const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!offset && event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()
      const next = catalogs[event.key === 'Home' ? 0 : event.key === 'End' ? catalogs.length - 1 : (index + offset + catalogs.length) % catalogs.length]
      setTab(next.id); setQuery(''); document.getElementById(`${prefix}-tab-${next.id}`)?.focus()
    }}>{catalog.label}<span>{catalog.count}</span></button>)}</div>
    <div className="library-list" id={`${prefix}-catalog`} role="tabpanel" aria-label={searching ? 'Search results' : `${catalogLabels[tab]} components`}>{visibleGroups.map(group => {
      const expanded = searching || openGroups.has(group.id)
      const rowsId = `${prefix}-group-${encodeURIComponent(group.id)}`
      return <section key={group.id} className="catalog-group">
        <CatalogGroupHeader group={group} expanded={expanded} searching={searching} rowsId={rowsId} onToggle={toggle} />
        {expanded && <div id={rowsId}>{group.items.map(item => <CatalogRow key={item.icon} item={item} writable={writable} picked={selectedIcon === item.icon} onChoose={onChoose} />)}</div>}
      </section>
    })}{!visibleGroups.length && <div className="no-results">No matching components</div>}</div>
  </>
})