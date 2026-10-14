import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent } from 'react'
import { AppWindow, Building2, Boxes, Brain, ChevronDown, Clock, Database, Layers, Network, Plus, Search, Server, Shield, Star, Workflow, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GENERIC_ICONS, resolveColor } from '../catalog.ts'
import { isSelectableIcon, legacyItem, menuGroups, rankedSearch, searchableLibrary, searchGroups, selectionLibrary } from '../catalog/presentation.ts'
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

export type CatalogProps = { writable: boolean; selectedIcon: string | null; recentIcons?: readonly string[]; onClearRecents?(): void; favoriteIcons?: readonly string[]; onToggleFavorite?(icon: string): void; onClearFavorites?(): void; onChoose(item: LibraryItem): void }
const emptyIcons: readonly string[] = []
const itemByIcon = new Map(selectionLibrary.map(item => [item.icon as string, item]))

function CatalogAction({ icon: Icon, label, pressed, disabled, onClick }: { icon: LucideIcon; label: string; pressed?: boolean; disabled?: boolean; onClick(): void }) {
  const tooltipId = useId()
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)
  const hovered = useRef(false)
  const focused = useRef(false)
  function show(button: HTMLButtonElement) {
    const bounds = button.getBoundingClientRect()
    setAnchor({ left: Math.max(112, Math.min(window.innerWidth - 112, bounds.left + bounds.width / 2)), top: bounds.bottom + 8 })
  }
  return <><button type="button" className="icon-button catalog-action-button" title={label} aria-label={label} aria-pressed={pressed} aria-describedby={anchor ? tooltipId : undefined} disabled={disabled} onClick={() => onClick()}
    onMouseEnter={event => { hovered.current = true; show(event.currentTarget) }} onMouseLeave={() => { hovered.current = false; if (!focused.current) setAnchor(null) }}
    onFocus={event => { focused.current = true; show(event.currentTarget) }} onBlur={() => { focused.current = false; if (!hovered.current) setAnchor(null) }}><Icon size={16} aria-hidden="true" fill={pressed ? 'currentColor' : 'none'} /></button>{anchor && createPortal(<span id={tooltipId} role="tooltip" className="action-tooltip" style={anchor}>{label}</span>, document.body)}</>
}

const CatalogRow = memo(function CatalogRow({ item, writable, picked, onChoose, favorite = false, favoriteDisabled = false, onToggleFavorite }: { item: LibraryItem; writable: boolean; picked: boolean; onChoose(item: LibraryItem): void; favorite?: boolean; favoriteDisabled?: boolean; onToggleFavorite?(icon: string): void }) {
  const Glyph = GENERIC_ICONS[item.icon as keyof typeof GENERIC_ICONS]
  const asset = visualAssets.icons?.[item.icon]
  const color = resolveColor(item.color)
  return <div className="catalog-row"><button type="button" data-icon={item.icon} className={`library-item ${picked ? 'picked' : ''}`} title={`Insert ${item.label}`} aria-label={`Insert ${item.label}`} disabled={!writable} draggable={writable} onDragStart={event => {
    if (!writable) { event.preventDefault(); return }
    event.dataTransfer.setData(DROP_TYPE, JSON.stringify({ icon: item.icon })); event.dataTransfer.effectAllowed = 'copy'
  }} onClick={() => { if (writable) onChoose(item) }}><span className="library-glyph" style={{ background: color.light, color: color.main }}>{asset ? <img src={asset} alt="" /> : Glyph ? <Glyph size={21} strokeWidth={1.6} /> : null}</span><span className="library-label"><strong>{item.label}</strong>{item.subtitle && <small>{item.subtitle}</small>}</span><Plus size={14} className="insert-symbol" /></button>{onToggleFavorite && <CatalogAction icon={Star} label={favorite ? `Remove ${item.label} from favorites` : `Add ${item.label} to favorites`} pressed={favorite} disabled={!favorite && favoriteDisabled} onClick={() => onToggleFavorite(item.icon)} />}</div>
})

function navigateResults(event: KeyboardEvent, results: HTMLElement | null, input: HTMLInputElement | null, writable: boolean, onEscape: () => void) {
  if (event.nativeEvent.isComposing) return
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onEscape(); input?.focus(); return }
  if (event.target !== input && !(event.target as HTMLElement).classList?.contains('library-item')) return
  const buttons = Array.from(results?.querySelectorAll<HTMLButtonElement>('.library-item') ?? [])
  const index = buttons.indexOf(event.target as HTMLButtonElement)
  if (!writable || !buttons.length) return
  if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); buttons[Math.max(0, index)].click(); return }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault(); event.stopPropagation()
  const next = index < 0 ? event.key === 'ArrowDown' ? 0 : buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next].focus(); buttons[next].scrollIntoView?.({ block: 'nearest' })
}

export type ComponentPickerProps = { writable?: boolean; title?: string; onChoose(item: LibraryItem): void; onCancel(): void }

export function ComponentPicker({ writable = true, title = 'Choose component', onChoose, onCancel }: ComponentPickerProps) {
  const headingId = useId()
  const searchInput = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const items = useMemo(() => rankedSearch(query), [query])
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    searchInput.current?.focus()
    return () => { if (opener?.isConnected) opener.focus() }
  }, [])
  const searchKey = (event: KeyboardEvent) => navigateResults(event, results.current, searchInput.current, writable, onCancel)
  return <div className="component-picker-backdrop"><section className="component-picker" role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={event => {
    event.stopPropagation()
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); return }
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}><div className="component-picker-heading"><h2 id={headingId}>{title}</h2><CatalogAction icon={X} label="Cancel component picker" onClick={onCancel} /></div>
    <div className="library-search"><Search size={15} aria-hidden="true" /><input ref={searchInput} aria-label="Search components" placeholder="Search components" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={searchKey} /></div>
    <div ref={results} className="library-list component-picker-results" aria-label="Component choices" onKeyDown={searchKey}>{items.map(item => <CatalogRow key={item.icon} item={item} writable={writable} picked={false} onChoose={onChoose} />)}{!items.length && <div className="no-results">No matching components</div>}</div>
  </section></div>
}

const CatalogGroupHeader = memo(function CatalogGroupHeader({ group, expanded, searching, rowsId, onToggle }: { group: (typeof groups)[number]; expanded: boolean; searching: boolean; rowsId: string; onToggle(id: string): void }) {
  const GroupIcon = groupIcons[group.icon as keyof typeof groupIcons]
  return <button type="button" className="catalog-group-toggle" aria-label={`${catalogLabels[group.catalog]}: ${group.label} (${group.items.length})`} aria-expanded={expanded} aria-controls={rowsId} aria-disabled={searching || undefined} onClick={() => onToggle(group.id)}><GroupIcon size={16} className="catalog-group-icon" aria-hidden="true" /><ChevronDown size={14} className="catalog-chevron" aria-hidden="true" /><span className="catalog-group-label">{searching && <small>{catalogLabels[group.catalog]}</small>}{group.label}</span><span className="catalog-group-count">{group.items.length}</span></button>
})

export function CatalogAccordion({ onChoose, favoriteIcons, onToggleFavorite, onClearFavorites, ...props }: CatalogProps) {
  const [sessionFavorites, setSessionFavorites] = useState<string[]>([])
  const latestChoose = useRef(onChoose)
  const latestToggle = useRef(onToggleFavorite)
  const latestClear = useRef(onClearFavorites)
  useLayoutEffect(() => { latestChoose.current = onChoose; latestToggle.current = onToggleFavorite; latestClear.current = onClearFavorites }, [onChoose, onToggleFavorite, onClearFavorites])
  const choose = useCallback((item: LibraryItem) => latestChoose.current(item), [])
  const toggleFavorite = useCallback((icon: string) => {
    if (latestToggle.current) latestToggle.current(icon)
    else setSessionFavorites(current => current.includes(icon) ? current.filter(key => key !== icon) : current.length < 12 ? [...current, icon] : current)
  }, [])
  const clearFavorites = useCallback(() => { if (latestClear.current) latestClear.current(); else setSessionFavorites([]) }, [])
  return <CatalogContent {...props} favoriteIcons={favoriteIcons ?? sessionFavorites} onToggleFavorite={toggleFavorite} onClearFavorites={clearFavorites} onChoose={choose} />
}

const CatalogContent = memo(function CatalogContent({ writable, selectedIcon, onChoose, recentIcons = emptyIcons, onClearRecents, favoriteIcons = emptyIcons, onToggleFavorite, onClearFavorites }: CatalogProps) {
  const prefix = useId()
  const searchInput = useRef<HTMLInputElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'azure' | 'software'>('azure')
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState(() => new Set(groups.filter(group => group.id === computeGroup?.id || (group.catalog === 'software' && group.items.length <= 12)).map(group => group.id)))
  const searching = !!query.trim()
  const visibleGroups = useMemo(() => searching ? searchGroups(query) : groups.filter(group => group.catalog === tab), [searching, query, tab])
  const recentItems = useMemo(() => [...new Set(recentIcons)].map(icon => itemByIcon.get(icon)).filter(item => !!item).slice(0, 8), [recentIcons])
  const favoriteItems = useMemo(() => [...new Set(favoriteIcons)].map(icon => itemByIcon.get(icon)).filter(item => !!item).slice(0, 12), [favoriteIcons])
  const favoriteKeys = new Set<string>(favoriteItems.map(item => item.icon))
  const savedKeys = new Set([...favoriteKeys, ...recentItems.map(item => item.icon)])
  const row = (item: LibraryItem) => <CatalogRow key={item.icon} item={item} writable={writable} picked={selectedIcon === item.icon} onChoose={onChoose} favorite={favoriteKeys.has(item.icon)} favoriteDisabled={favoriteItems.length >= 12} onToggleFavorite={onToggleFavorite} />

  function searchKey(event: KeyboardEvent) {
    if (searching) navigateResults(event, results.current, searchInput.current, writable, () => setQuery(''))
  }

  const toggle = useCallback((id: string) => {
    if (searching) return
    setOpenGroups(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [searching])

  return <>
    <div className="library-search"><Search size={15} /><input ref={searchInput} aria-label="Search components" placeholder="Search components" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={searchKey} /></div>
    <div className="tabs" role="tablist" aria-label="Component catalogs">{catalogs.map((catalog, index) => <button type="button" key={catalog.id} id={`${prefix}-tab-${catalog.id}`} role="tab" aria-selected={tab === catalog.id} aria-controls={`${prefix}-catalog`} tabIndex={tab === catalog.id ? 0 : -1} className={tab === catalog.id ? 'selected' : ''} onClick={() => { setTab(catalog.id); setQuery('') }} onKeyDown={event => {
      const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!offset && event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()
      const next = catalogs[event.key === 'Home' ? 0 : event.key === 'End' ? catalogs.length - 1 : (index + offset + catalogs.length) % catalogs.length]
      setTab(next.id); setQuery(''); document.getElementById(`${prefix}-tab-${next.id}`)?.focus()
    }}>{catalog.label}<span>{catalog.count}</span></button>)}</div>
    <div ref={results} className="library-list" id={`${prefix}-catalog`} role="tabpanel" aria-label={searching ? 'Search results' : `${catalogLabels[tab]} components`} onKeyDown={searchKey}>
      {!searching && favoriteItems.length > 0 && <section className="catalog-session" aria-label="Favorite components"><div className="catalog-session-heading"><span title="Favorite components"><Star size={16} aria-hidden="true" /></span><h3>Favorites <small>Session</small></h3>{onClearFavorites && <CatalogAction icon={X} label="Clear favorite components" onClick={onClearFavorites} />}</div>{favoriteItems.map(row)}</section>}
      {!searching && recentItems.length > 0 && <section className="catalog-session" aria-label="Recent components"><div className="catalog-session-heading"><span title="Recent components"><Clock size={16} aria-hidden="true" /></span><h3>Recent <small>Session</small></h3>{onClearRecents && <CatalogAction icon={X} label="Clear recent components" onClick={onClearRecents} />}</div>{recentItems.filter(item => !favoriteKeys.has(item.icon)).map(row)}</section>}
      {visibleGroups.map(group => {
      const expanded = searching || openGroups.has(group.id)
      const rowsId = `${prefix}-group-${encodeURIComponent(group.id)}`
      return <section key={group.id} className="catalog-group">
        <CatalogGroupHeader group={group} expanded={expanded} searching={searching} rowsId={rowsId} onToggle={toggle} />
        {expanded && <div id={rowsId}>{group.items.filter(item => searching || !savedKeys.has(item.icon)).map(row)}</div>}
      </section>
    })}{!visibleGroups.length && <div className="no-results">No matching components</div>}</div>
  </>
})