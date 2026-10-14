import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { iconFixture } from './custom-icons/test-fixtures.ts'
import { allLibraryItems, isIconKey } from './catalog.ts'
import { visualAssets } from './assets.ts'
import { vendorLibrary } from './vendor-icons/catalog.ts'
import { vendorAssets } from './vendor-icons/assets.ts'
import { microsoftLibrary } from './microsoft-icons/catalog.ts'
import { microsoftAssets } from './microsoft-icons/assets.ts'
import { isSelectableIcon, menuGroups, searchGroups } from './catalog/presentation.ts'
import { entityMarkup, buildScene, renderSvg } from './scene.ts'
import { sampleDiagram } from './model.ts'

describe('feature icon integration', () => {
  const component = sampleDiagram().entities.find(entity => entity.kind === 'component')!
  it('should_embed_valid_custom_png_and_escape_name_when_component_has_override', () => {
    const customIcon = { ...iconFixture(), name: '<unsafe & name>' }
    const markup = entityMarkup({ ...component, customIcon }, visualAssets)
    expect(markup).toContain(`href="${customIcon.dataUrl}"`)
    expect(markup).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(markup).toContain('&lt;unsafe &amp; name&gt;')
    expect(markup).not.toContain('foreignObject')
    const diagram = sampleDiagram()
    diagram.entities = [{ ...component, parentId: null, customIcon }]
    expect(renderSvg(buildScene(diagram), visualAssets)).toContain(customIcon.dataUrl)
  })
  it('should_retain_builtin_artwork_when_custom_data_is_invalid_or_noncomponent', () => {
    const original = entityMarkup(component, visualAssets)
    for (const dataUrl of ['https://example.com/icon.png', 'data:image/svg+xml,<svg/>', 'data:image/png;base64,AAAA']) {
      expect(entityMarkup({ ...component, customIcon: { ...iconFixture(), dataUrl } }, visualAssets)).toBe(original)
    }
    expect(entityMarkup({ ...component, kind: 'rectangle', customIcon: iconFixture() }, visualAssets)).not.toContain('data:image/png')
  })
  it('should_allow_all_new_static_keys_without_removing_legacy_keys_when_registries_join', () => {
    expect(allLibraryItems).toHaveLength(2266)
    for (const item of [...vendorLibrary, ...microsoftLibrary]) {
      expect(isIconKey(item.icon)).toBe(true)
      expect(isSelectableIcon(item.icon)).toBe(true)
      expect(item.source.entry).toMatch(/\.(svg|png)$/)
      const isPng = item.source.entry.endsWith('.png')
      const isVendor = item.icon.startsWith('vendor-')
      const encoding = isPng || !isVendor ? 'base64' : 'charset=utf-8'
      const prefix = `data:image/${isPng ? 'png' : 'svg+xml'};${encoding},`
      const asset = visualAssets.icons![item.icon]
      expect(asset).toBe((isVendor ? vendorAssets : microsoftAssets)[item.icon])
      expect(asset.startsWith(prefix)).toBe(true)
      const payload = asset.slice(prefix.length)
      const bytes = encoding === 'base64' ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8')
      expect(bytes.length).toBeGreaterThan(0)
      if (encoding === 'base64') expect(bytes.toString('base64')).toBe(payload)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(item.source.sha256)
      if (isPng) expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
      else expect(bytes.toString('utf8')).toMatch(/<svg\b/)
      expect(entityMarkup({ ...component, icon: item.icon }, visualAssets)).toContain(`href="${asset}"`)
      expect(searchGroups(item.label).flatMap(group => group.items).some(candidate => candidate.icon === item.icon)).toBe(true)
    }
    expect(isIconKey('azure-app')).toBe(true)
    expect(isIconKey('__proto__')).toBe(false)
  })
  it('should_show_compact_editorial_menus_when_new_families_are_integrated', () => {
    expect(menuGroups('azure')).toHaveLength(8)
    expect(menuGroups('software')).toHaveLength(2)
    const vendors = menuGroups('software').find(group => group.id === 'software-vendors')!
    expect(vendors.items.slice(0, 4).map(item => item.icon)).toEqual(['vendor-oracle', 'vendor-sap', 'vendor-ibm', 'vendor-aws'])
    expect(vendors.items.length).toBeLessThanOrEqual(12)
    expect(menuGroups('azure').find(group => group.id === 'azure-microsoft-apps')?.items.length).toBe(12)
    expect(searchGroups('Hewlett Packard Enterprise').flatMap(group => group.items).some(item => item.icon === 'vendor-hpe')).toBe(true)
    expect(searchGroups('Microsoft Apps').flatMap(group => group.items).filter(item => item.icon.startsWith('microsoft-'))).toHaveLength(14)
  })
})