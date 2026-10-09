// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { test } from 'vitest'
import { microsoftLibrary } from './catalog.ts'
import { microsoftAssets } from './assets.ts'

test('should_place_each_trusted_asset_in_a_35px_svg_component_without_mutating_its_bytes', () => {
  for (const item of microsoftLibrary) {
    const source = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={35} height={35} viewBox="0 0 35 35"><image href={microsoftAssets[item.icon]} width={35} height={35} preserveAspectRatio="xMidYMid meet" /></svg>)
    const document = new DOMParser().parseFromString(source, 'image/svg+xml')
    assert.equal(document.querySelector('parsererror'), null)
    const image = document.querySelector('image')!
    assert.equal(image.getAttribute('href'), microsoftAssets[item.icon])
    assert.equal(image.getAttribute('width'), '35')
    assert.equal(image.getAttribute('height'), '35')
    assert.equal(image.getAttribute('preserveAspectRatio'), 'xMidYMid meet')
    assert.doesNotMatch(source, /<script|https:\/\/download|blob:|file:/i)
  }
})

test('should_render_a_self_contained_svg_export_with_all_microsoft_components', () => {
  const source = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={700} height={200} viewBox="0 0 700 200">{microsoftLibrary.map((item, index) => <g key={item.icon} transform={`translate(${index * 45}, 10)`}><image href={microsoftAssets[item.icon]} width={35} height={35} preserveAspectRatio="xMidYMid meet" /><title>{`${item.label}: ${item.subtitle}`}</title></g>)}</svg>)
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  assert.equal(document.querySelectorAll('image').length, microsoftLibrary.length)
  for (const image of document.querySelectorAll('image')) assert.match(image.getAttribute('href') ?? '', /^data:image\/svg\+xml;base64,/)
  assert.equal(document.querySelector('parsererror'), null)
})