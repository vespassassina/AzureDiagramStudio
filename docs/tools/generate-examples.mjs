import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const app = path.join(root, 'app')
const require = createRequire(path.join(app, 'package.json'))
const { createServer } = await import(pathToFileURL(require.resolve('vite')))
const { chromium } = require('@playwright/test')
const ELK = require('elkjs/lib/elk.bundled.js')
const engine = new ELK()
const compactEngine = {
  layout(graph) {
    graph.layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = '72'
    for (const boundary of graph.children) {
      if (!boundary.children) continue
      boundary.layoutOptions['elk.direction'] = 'DOWN'
      boundary.layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = '48'
      boundary.layoutOptions['elk.spacing.nodeNode'] = '32'
    }
    return engine.layout(graph)
  },
}
const names = ['azure-web-app', 'fabric-onelake', 'event-driven', 'enterprise-integration']
const checkOnly = process.argv.includes('--check')
const capture = process.argv.includes('--screenshot')
const server = await createServer({ root: app, configFile: false, cacheDir: path.join(root, '.vite/docs'), optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port: 0 }, appType: 'custom' })
let browser

try {
  server.middlewares.use('/__docs_import', (_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html lang="en"><head><title>Documentation image import</title></head><body></body></html>')
  })
  await server.listen()
  const { createDocument, entityTextGeometry } = await server.ssrLoadModule('/src/model.ts')
  const { parseDocument } = await server.ssrLoadModule('/src/document/index.ts')
  const { computeLayout } = await server.ssrLoadModule('/src/layout.ts')
  const { buildScene, renderSvg } = await server.ssrLoadModule('/src/scene.ts')
  const { visualAssets } = await server.ssrLoadModule('/src/assets.ts')
  const { selectionLibrary } = await server.ssrLoadModule('/src/catalog/presentation.ts')
  const { connectionLabelSize, textWidth } = await server.ssrLoadModule('/src/render/text.ts')
  const { validateCustomIcon } = await server.ssrLoadModule('/src/custom-icons/contract.ts')
  const fontData = `data:font/ttf;base64,${(await readFile(path.join(app, 'src/assets/plex-sans.ttf'))).toString('base64')}`
  const images = path.join(root, 'docs/images')
  const examples = path.join(root, 'examples')
  if (!checkOnly) {
    await mkdir(images, { recursive: true })
    await mkdir(examples, { recursive: true })
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(new URL('__docs_import', server.resolvedUrls.local[0]).href)
  const sampleSource = await readFile(path.join(examples, 'simple-badge.svg'), 'utf8')
  const normalized = await page.evaluate(async source => {
    const { importCustomIcon } = await import('/src/custom-icons/import.ts')
    return importCustomIcon(new File([source], 'SimpleBadge.svg', { type: 'image/svg+xml' }))
  }, sampleSource)
  const customIcon = { ...normalized, name: 'SimpleBadge' }
  assert.equal(validateCustomIcon(customIcon).ok, true, 'Sample must pass the native safe PNG contract')
  const samplePng = Buffer.from(customIcon.dataUrl.split(',')[1], 'base64')
  if (checkOnly) assert.deepEqual(await readFile(path.join(examples, 'simple-badge.png')), samplePng)
  else await writeFile(path.join(examples, 'simple-badge.png'), samplePng)
  console.log('PASS SimpleBadge: original SVG accepted by real importer, normalized PNG passes native contract')
  const rendered = []

  function product(labelOrKey) {
    const item = selectionLibrary.find(item => item.icon === labelOrKey || item.label === labelOrKey)
    assert.ok(item, `Current canonical product not found: ${labelOrKey}`)
    return item
  }

  function component(id, label, subtitle, key, parentId, color = 'azure') {
    const item = product(key)
    return { id, kind: 'component', label, subtitle, icon: item.icon, color, status: 'synthetic', parentId, layer: 'foreground', x: 0, y: 0, width: 240, height: 98 }
  }

  function boundary(id, label, subtitle, color) {
    return { id, kind: 'boundary', label, subtitle, color, parentId: null, layer: 'foreground', x: 0, y: 0, width: 320, height: 200 }
  }

  function connection(id, from, to, label, style = 'solid') {
    assert.ok(label.split(/\s+/).length <= 3, `Long flow label: ${label}`)
    return { id, from, to, label, style, arrow: 'forward', sourceSide: 'auto', targetSide: 'auto' }
  }

  function draft(name, title, subtitle, entities, flows) {
    return { ...createDocument(`example-${name}-v1`, title), subtitle, synthetic: true, direction: 'RIGHT', legendVisible: true,
      legend: [{ label: 'Illustrative flow', color: '#6c8587' }, { label: 'Supporting dependency', color: '#6c8587', dashed: true }],
      entities, connections: flows.map((flow, index) => connection(`${name}-flow-${index + 1}`, ...flow)) }
  }

  const drafts = [
    draft(names[0], 'Azure web & API', 'Illustrative request path, application ownership and supporting services. No deployment is implied.', [
      boundary('web-edge', 'Public ingress', 'Internet-facing entry points', 'azure'),
      boundary('web-apps', 'Application team', 'Web, API and asynchronous work', 'teal'),
      boundary('web-data', 'Data boundary', 'Application-owned persistence', 'amber'),
      boundary('web-ops', 'Platform operations', 'Secrets, identity and telemetry', 'gray'),
      component('web-users', 'Customers', 'Web and mobile clients', 'user', null, 'source'),
      component('web-front', 'Front Door', 'HTTPS entry point', 'azure-front-door', 'web-edge'),
      component('web-apim', 'API Management', 'API gateway and policies', 'azure-api', 'web-edge'),
      component('web-site', 'App Service', 'Web application and API', 'azure-app', 'web-apps', 'teal'),
      component('web-bus', 'Service Bus', 'Background work queue', 'azure-service-bus', 'web-apps', 'teal'),
      component('web-functions', 'Functions', 'Queued work handler', 'azure-function', 'web-apps', 'teal'),
      component('web-sql', 'SQL Database', 'Orders and account data', 'azure-sql', 'web-data', 'amber'),
      component('web-storage', 'Storage account', 'Documents and media', 'azure-storage', 'web-data', 'amber'),
      component('web-keyvault', 'Key Vault', 'Application secrets', 'azure-key-vault', 'web-ops', 'gray'),
      component('web-monitor', 'Azure Monitor', 'Application telemetry', 'azure-monitor', 'web-ops', 'gray'),
    ], [
      ['web-users', 'web-front', 'Request'], ['web-front', 'web-apim', 'Route'], ['web-apim', 'web-site', 'Forward'],
      ['web-site', 'web-sql', 'Read / write'], ['web-site', 'web-storage', 'Store media'],
      ['web-site', 'web-bus', 'Queue work'], ['web-bus', 'web-functions', 'Handle work'], ['web-functions', 'web-storage', 'Write result'],
      ['web-site', 'web-keyvault', 'Read secrets', 'dashed'],
      ['web-site', 'web-monitor', 'Emit telemetry', 'dashed'],
    ]),
    draft(names[1], 'Fabric & OneLake analytics', 'Illustrative batch and streaming paths across workspace ownership. No connected data is implied.', [
      boundary('fabric-source', 'Source systems', 'Data owned outside the workspace', 'source'),
      boundary('fabric-engineering', 'Engineering workspace', 'Ingestion and transformation', 'fabric'),
      boundary('fabric-serving', 'Analytics workspace', 'Curated and real-time data', 'azure'),
      boundary('fabric-business', 'Business workspace', 'Governed consumption', 'teal'),
      component('fabric-sql', 'SQL Database', 'Illustrative source tables', 'azure-sql', 'fabric-source', 'source'),
      component('fabric-hubs', 'Event Hubs', 'Illustrative event source', 'azure-event-hubs', 'fabric-source', 'source'),
      component('fabric-pipeline', 'Data pipeline', 'Batch orchestration', 'Data pipeline', 'fabric-engineering', 'fabric'),
      component('fabric-dataflow', 'Dataflow Gen2', 'Low-code preparation', 'Dataflow Gen2', 'fabric-engineering', 'fabric'),
      component('fabric-lakehouse', 'Lakehouse', 'Delta tables and files', 'Lakehouse', 'fabric-engineering', 'fabric'),
      component('fabric-notebook', 'Notebook', 'Spark transformation', 'Notebook', 'fabric-engineering', 'fabric'),
      component('fabric-onelake', 'OneLake', 'Shared logical data lake', 'OneLake', 'fabric-serving'),
      component('fabric-warehouse', 'Warehouse', 'Curated SQL analytics', 'Warehouse', 'fabric-serving'),
      component('fabric-eventstream', 'Eventstream', 'Stream ingestion', 'Eventstream', 'fabric-serving'),
      component('fabric-eventhouse', 'Eventhouse', 'Real-time analytics', 'Eventhouse', 'fabric-serving'),
      component('fabric-model', 'Semantic model', 'Business measures', 'Semantic model', 'fabric-business', 'teal'),
      component('fabric-powerbi', 'Power BI', 'Business reports', 'Power BI', 'fabric-business', 'teal'),
    ], [
      ['fabric-sql', 'fabric-pipeline', 'Extract'], ['fabric-pipeline', 'fabric-dataflow', 'Prepare'],
      ['fabric-dataflow', 'fabric-lakehouse', 'Load'], ['fabric-lakehouse', 'fabric-notebook', 'Transform'],
      ['fabric-notebook', 'fabric-warehouse', 'Publish tables'], ['fabric-lakehouse', 'fabric-onelake', 'Store files', 'dashed'],
      ['fabric-warehouse', 'fabric-onelake', 'Store tables', 'dashed'], ['fabric-hubs', 'fabric-eventstream', 'Stream events'],
      ['fabric-eventstream', 'fabric-eventhouse', 'Ingest'], ['fabric-warehouse', 'fabric-model', 'Model'],
      ['fabric-eventhouse', 'fabric-model', 'Query'], ['fabric-model', 'fabric-powerbi', 'Visualize'],
    ]),
    draft(names[2], 'Event-driven Azure integration', 'Illustrative notification, command and stream processing. No live integration is implied.', [
      boundary('event-producers', 'Producer boundary', 'Application-owned event sources', 'azure'),
      boundary('event-messaging', 'Integration boundary', 'Notifications, commands and streams', 'teal'),
      boundary('event-processing', 'Consumer boundary', 'Independent processing and storage', 'amber'),
      boundary('event-operations', 'Platform operations', 'Secrets and observability', 'gray'),
      component('event-apim', 'API Management', 'Command API gateway', 'azure-api', 'event-producers'),
      component('event-app', 'App Service', 'Producer application', 'azure-app', 'event-producers'),
      component('event-uploads', 'Storage account', 'Incoming documents', 'azure-storage', 'event-producers'),
      component('event-grid', 'Event Grid', 'Document notifications', 'azure-event-grid', 'event-messaging', 'teal'),
      component('event-bus', 'Service Bus', 'Reliable work queue', 'azure-service-bus', 'event-messaging', 'teal'),
      component('event-hubs', 'Event Hubs', 'Telemetry stream', 'azure-event-hubs', 'event-messaging', 'teal'),
      component('event-handler', 'Functions', 'Notification handler', 'azure-function', 'event-processing', 'amber'),
      component('event-worker', 'Functions', 'Queue and stream worker', 'azure-function', 'event-processing', 'amber'),
      component('event-cosmos', 'Cosmos DB', 'NoSQL result documents', 'azure-cosmos', 'event-processing', 'amber'),
      component('event-archive', 'Storage account', 'Processed event archive', 'azure-storage', 'event-processing', 'amber'),
      component('event-vault', 'Key Vault', 'Consumer secrets', 'azure-key-vault', 'event-operations', 'gray'),
      component('event-monitor', 'Azure Monitor', 'Consumer telemetry', 'azure-monitor', 'event-operations', 'gray'),
    ], [
      ['event-apim', 'event-app', 'Accept commands'], ['event-app', 'event-bus', 'Queue work'],
      ['event-app', 'event-hubs', 'Publish telemetry'], ['event-uploads', 'event-grid', 'Notify upload'],
      ['event-grid', 'event-handler', 'Dispatch'], ['event-handler', 'event-cosmos', 'Write metadata'],
      ['event-bus', 'event-worker', 'Handle work'], ['event-hubs', 'event-worker', 'Read stream'],
      ['event-worker', 'event-archive', 'Archive'], ['event-worker', 'event-vault', 'Read secrets', 'dashed'],
      ['event-worker', 'event-monitor', 'Emit telemetry', 'dashed'],
    ]),
    draft(names[3], 'Microsoft & enterprise integration', 'Synthetic illustration. Named badges are not corporate logos; SimpleBadge is original custom artwork.', [
      boundary('web-edge', 'Microsoft workspace', 'Documents and business records', 'azure'),
      boundary('web-apps', 'Integration team', 'Orchestration and custom processing', 'teal'),
      boundary('web-data', 'Enterprise systems', 'Original named integration badges', 'amber'),
      boundary('web-ops', 'Platform operations', 'Secrets and observability', 'gray'),
      component('web-users', 'Business users', 'Illustrative participants', 'user', null, 'source'),
      component('web-front', 'SharePoint', 'Original named badge', 'microsoft-sharepoint', 'web-edge'),
      component('web-apim', 'Dynamics 365', 'Official architecture glyph', 'microsoft-dynamics365', 'web-edge'),
      component('web-site', 'Logic Apps', 'Illustrative workflow', 'azure-logic-apps', 'web-apps', 'teal'),
      component('web-bus', 'Service Bus', 'Background work queue', 'azure-service-bus', 'web-apps', 'teal'),
      { ...component('web-functions', 'SimpleBadge', 'Original custom PNG, not a logo', 'service', 'web-apps', 'teal'), customIcon },
      component('web-sql', 'SAP', 'Named integration badge', 'vendor-sap', 'web-data', 'amber'),
      component('web-storage', 'Oracle', 'Named integration badge', 'vendor-oracle', 'web-data', 'amber'),
      component('web-keyvault', 'Key Vault', 'Workflow secrets', 'azure-key-vault', 'web-ops', 'gray'),
      component('web-monitor', 'Azure Monitor', 'Workflow telemetry', 'azure-monitor', 'web-ops', 'gray'),
    ], [
      ['web-users', 'web-front', 'Submit file'], ['web-front', 'web-apim', 'Lookup record'],
      ['web-apim', 'web-site', 'Send update'], ['web-site', 'web-sql', 'Post order'],
      ['web-site', 'web-storage', 'Query'], ['web-site', 'web-bus', 'Queue task'],
      ['web-bus', 'web-functions', 'Process task'], ['web-functions', 'web-storage', 'Write result'],
      ['web-site', 'web-keyvault', 'Read secrets', 'dashed'],
      ['web-site', 'web-monitor', 'Emit telemetry', 'dashed'],
    ]),
  ]

  const presentations = {
    'azure-web-app': {
      boundaries: { 'web-edge': [0, 100, 288, 430], 'web-apps': [400, 100, 288, 620], 'web-data': [800, 100, 288, 620], 'web-ops': [400, 800, 688, 230] },
      positions: { 'web-users': [-320, 192], 'web-front': [24, 92], 'web-apim': [24, 280], 'web-site': [24, 92], 'web-bus': [24, 280], 'web-functions': [24, 468], 'web-sql': [24, 92], 'web-storage': [24, 468], 'web-keyvault': [24, 92], 'web-monitor': [424, 92] },
      routes: [
        ['right', 'left', [], [-28, 241]],
        ['bottom', 'top', [], [144, 329]],
        ['right', 'left', [[344, 429], [344, 241]], [344, 338]],
        ['right', 'left', [], [744, 241]],
        ['right', 'left', [[714, 241], [714, 592]], [714, 500], 0, -25],
        ['bottom', 'top', [], [544, 329]],
        ['bottom', 'top', [], [544, 517]],
        ['right', 'left', [], [744, 617]],
        ['left', 'left', [[360, 241], [360, 941]], [360, 780]],
        ['right', 'left', [[764, 269], [764, 941]], [764, 780], 28],
      ],
    },
    'fabric-onelake': {
      boundaries: { 'fabric-source': [0, 0, 288, 430], 'fabric-engineering': [400, 0, 650, 430], 'fabric-serving': [400, 600, 650, 430], 'fabric-business': [0, 600, 288, 430] },
      positions: { 'fabric-sql': [24, 92], 'fabric-hubs': [24, 284], 'fabric-pipeline': [24, 92], 'fabric-dataflow': [374, 92], 'fabric-lakehouse': [374, 284], 'fabric-notebook': [24, 284], 'fabric-onelake': [24, 92], 'fabric-warehouse': [24, 284], 'fabric-eventstream': [374, 92], 'fabric-eventhouse': [374, 284], 'fabric-model': [24, 92], 'fabric-powerbi': [24, 284] },
      routes: [
        ['right', 'left', [], [344, 141]],
        ['right', 'left', [], [719, 141]],
        ['bottom', 'top', [], [894, 240]],
        ['left', 'right', [], [719, 333]],
        ['bottom', 'left', [[544, 480], [350, 480], [350, 933]], [350, 770]],
        ['right', 'right', [[1100, 333], [1100, 540], [724, 540], [724, 741]], [910, 540]],
        ['top', 'bottom', [], [544, 838]],
        ['right', 'top', [[320, 333], [320, 570], [894, 570]], [620, 570]],
        ['bottom', 'top', [], [894, 838]],
        ['left', 'right', [[380, 933], [380, 800], [310, 800], [310, 741]], [345, 800]],
        ['left', 'right', [[724, 933], [724, 1070], [350, 1070], [350, 775], [310, 775], [310, 720]], [590, 1070], 0, -21],
        ['bottom', 'top', [], [144, 838]],
      ],
    },
    'event-driven': {
      boundaries: { 'event-producers': [0, 0, 288, 620], 'event-messaging': [400, 0, 288, 620], 'event-processing': [800, 0, 288, 810], 'event-operations': [0, 850, 688, 230] },
      positions: { 'event-apim': [24, 92], 'event-app': [24, 280], 'event-uploads': [24, 468], 'event-grid': [24, 468], 'event-bus': [24, 280], 'event-hubs': [24, 92], 'event-handler': [24, 468], 'event-worker': [24, 280], 'event-cosmos': [24, 656], 'event-archive': [24, 92], 'event-vault': [24, 92], 'event-monitor': [424, 92] },
      routes: [
        ['bottom', 'top', [], [144, 240]],
        ['right', 'left', [], [344, 329]],
        ['right', 'left', [[344, 305], [344, 141]], [344, 205], -24],
        ['right', 'left', [], [344, 517]],
        ['right', 'left', [], [744, 517]],
        ['bottom', 'top', [], [944, 612]],
        ['right', 'left', [], [744, 329]],
        ['right', 'left', [[744, 141], [744, 305]], [744, 205], 0, -24],
        ['top', 'bottom', [], [944, 240]],
        ['left', 'bottom', [[764, 329], [764, 1120], [144, 1120]], [440, 1120]],
        ['right', 'bottom', [[1140, 329], [1140, 1150], [544, 1150]], [860, 1150]],
      ],
    },
  }

  presentations['enterprise-integration'] = presentations['azure-web-app']

  // Run the real shared ELK adapter first, then apply curated page geometry and
  // explicit channels. Keep the same IDs, graph, text, statuses and glyphs.
  function refinePresentation(document, name) {
    const presentation = presentations[name]
    const entities = document.entities.map(entity => {
      if (entity.kind === 'boundary') {
        const [x, y, width, height] = presentation.boundaries[entity.id]
        return { ...entity, x, y, width, height }
      }
      const [x, y] = presentation.positions[entity.id]
      return { ...entity, x, y, width: 240, height: 112 }
    })
    const scene = buildScene({ ...document, entities })
    const byId = new Map(scene.entities.map(entity => [entity.id, entity]))
    function port(entity, side, offset = 0) {
      return { x: entity.absolute.x + (side === 'left' ? 0 : side === 'right' ? entity.width : entity.width / 2) + (side === 'top' || side === 'bottom' ? offset : 0),
        y: entity.absolute.y + (side === 'top' ? 0 : side === 'bottom' ? entity.height : entity.height / 2) + (side === 'left' || side === 'right' ? offset : 0) }
    }
    const connections = document.connections.map((connection, index) => {
      const [sourceSide, targetSide, bends, label, sourceOffset, targetOffset] = presentation.routes[index]
      const start = port(byId.get(connection.from), sourceSide, sourceOffset)
      const end = port(byId.get(connection.to), targetSide, targetOffset)
      const channels = bends.map(([x, y]) => ({ x, y }))
      if (channels.length) {
        if (sourceSide === 'left' || sourceSide === 'right') channels[0].y = start.y
        else channels[0].x = start.x
        if (targetSide === 'left' || targetSide === 'right') channels.at(-1).y = end.y
        else channels.at(-1).x = end.x
      }
      const points = [start, ...channels, end]
      for (let point = 1; point < points.length; point++) {
        const before = points[point - 1], after = points[point]
        if (before.x !== after.x && before.y !== after.y) points.splice(point, 0, { x: after.x, y: before.y })
      }
      return { ...connection, sourceSide, targetSide, routeRevision: document.revision, points, labelPosition: { x: label[0], y: label[1] } }
    })
    return { ...document, entities, connections }
  }

  function checkedDocument(text, name) {
    const result = parseDocument(text)
    assert.equal(result.ok, true, `${name}: ${JSON.stringify(result)}`)
    const document = result.value
    assert.equal(document.schemaVersion, 1)
    assert.equal(document.id, `example-${name}-v1`)
    assert.equal(document.synthetic, true)
    assert.equal(document.legendVisible, true)
    const components = document.entities.filter(entity => entity.kind === 'component')
    assert.ok(components.length >= 10 && components.length <= 14)
    assert.equal(document.entities.filter(entity => entity.kind === 'boundary').length, 4)
    for (const entity of components) {
      assert.equal(entity.status, 'synthetic')
      const item = product(entity.icon)
      if (item.catalog !== 'software') assert.ok(visualAssets.icons[entity.icon]?.startsWith('data:image/svg+xml;'))
      if (entity.icon.startsWith('vendor-')) assert.ok(visualAssets.icons[entity.icon]?.startsWith('data:image/svg+xml;charset=utf-8,'))
      if (entity.customIcon) {
        assert.equal(validateCustomIcon(entity.customIcon).ok, true)
        assert.deepEqual(entity.customIcon, customIcon)
      }
      if (item.catalog === 'fabric') assert.match(item.source.entry, /_(20)_(item|color|filled|regular)\.svg$/)
    }
    assert.equal(components.filter(entity => entity.customIcon).length, name === 'enterprise-integration' ? 1 : 0)
    const scene = buildScene(document)
    assert.equal(scene.connections.length, document.connections.length)
    for (const connection of document.connections) {
      assert.equal(connection.routeRevision, document.revision)
      assert.ok(connection.points?.length >= 2)
      for (let index = 1; index < connection.points.length; index++) {
        const before = connection.points[index - 1], after = connection.points[index]
        assert.ok(Math.abs(before.x - after.x) < 0.01 || Math.abs(before.y - after.y) < 0.01, `Nonorthogonal route: ${connection.id}`)
      }
    }
    const boxes = scene.entities.filter(entity => entity.kind === 'component').map(entity => ({ id: entity.id, x: entity.absolute.x, y: entity.absolute.y, width: entity.width, height: entity.height }))
    for (const [index, box] of boxes.entries()) for (const other of boxes.slice(index + 1)) assert.ok(!overlaps(box, other), `Component overlap: ${box.id}/${other.id}`)
    const labels = scene.connections.filter(connection => connection.label).map(connection => {
      const size = connectionLabelSize(connection.label)
      return { id: connection.id, x: connection.labelPosition.x - size.width / 2, y: connection.labelPosition.y - size.height / 2, ...size }
    })
    for (const label of labels) for (const box of boxes) assert.ok(!overlaps(label, box), `Flow label overlaps component: ${label.id}/${box.id}`)
    for (const [index, label] of labels.entries()) for (const other of labels.slice(index + 1)) assert.ok(!overlaps(label, other), `Flow labels overlap: ${label.id}/${other.id}`)
    const headings = scene.entities.filter(entity => entity.kind === 'boundary').map(entity => {
      const text = entityTextGeometry(entity)
      return { id: entity.id, x: entity.absolute.x + 30, y: entity.absolute.y + 12, width: Math.max(...text.labelLines.map(line => textWidth(line, 13)), ...text.subtitleLines.map(line => textWidth(line, 11))) + 4, height: text.textBottom - 10 }
    })
    for (const label of labels) for (const heading of headings) assert.ok(!overlaps(label, heading), `Flow label overlaps boundary heading: ${label.id}/${heading.id}`)
    for (const connection of scene.connections) for (let index = 1; index < connection.points.length; index++) {
      const before = connection.points[index - 1], after = connection.points[index]
      const segment = { x: Math.min(before.x, after.x), y: Math.min(before.y, after.y), width: Math.abs(after.x - before.x) || 0.2, height: Math.abs(after.y - before.y) || 0.2 }
      for (const box of boxes) assert.ok(!overlaps(segment, { ...box, x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 }), `Route crosses component: ${connection.id}/${box.id}`)
      for (const heading of headings) assert.ok(!overlaps(segment, heading), `Route crosses boundary heading: ${connection.id}/${heading.id}`)
    }
    return { document, scene }
  }

  function overlaps(left, right) {
    return left.x < right.x + right.width - 0.1 && right.x < left.x + left.width - 0.1 && left.y < right.y + right.height - 0.1 && right.y < left.y + left.height - 0.1
  }

  async function inspectSvg(svg, scene, name) {
    await page.setViewportSize({ width: scene.width, height: scene.height })
    await page.setContent(svg)
    await page.evaluate(() => document.fonts.ready)
    const report = await page.evaluate(async () => {
      const svg = document.querySelector('svg')
      const view = svg.viewBox.baseVal
      const bounds = { x: view.x, y: view.y, width: view.width, height: view.height }
      const clipped = [...svg.querySelectorAll('text')].filter(text => {
        const local = text.getBBox(), matrix = text.getCTM()
        const corners = [new DOMPoint(local.x, local.y), new DOMPoint(local.x + local.width, local.y + local.height)].map(point => point.matrixTransform(matrix))
        return corners.some(point => point.x < 12 || point.y < 12 || point.x > view.width - 12 || point.y > view.height - 12)
      }).map(text => text.textContent)
      const glyphs = [...svg.querySelectorAll('image')]
      for (const glyph of glyphs) {
        const image = new Image()
        image.src = glyph.getAttribute('href')
        await image.decode()
      }
      const image = new Image()
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = view.width; canvas.height = view.height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data
      let ink = 0
      for (let offset = 0; offset < bytes.length; offset += 4) if (Math.min(bytes[offset], bytes[offset + 1], bytes[offset + 2]) < 230) ink++
      return { bounds, clipped, glyphs: glyphs.map(glyph => ({ href: glyph.getAttribute('href'), title: glyph.querySelector('title')?.textContent })), texts: svg.querySelectorAll('text').length, ink, png: canvas.toDataURL('image/png').split(',')[1] }
    })
    assert.deepEqual(report.clipped, [], `${name}: cropped SVG text`)
    assert.ok(report.ink > 10000, `${name}: blank output`)
    const expectedArtwork = scene.entities.filter(entity => entity.kind === 'component' && (entity.customIcon || visualAssets.icons[entity.icon]))
    assert.equal(report.glyphs.length, expectedArtwork.length, `${name}: missing bundled/custom artwork`)
    for (const entity of expectedArtwork) {
      const href = entity.customIcon?.dataUrl ?? visualAssets.icons[entity.icon]
      const glyph = report.glyphs.find(glyph => glyph.href === href)
      assert.ok(glyph, `${name}: wrong artwork for ${entity.id}`)
      assert.match(glyph.href, entity.customIcon ? /^data:image\/png;base64,/ : /^data:image\/svg\+xml;(?:base64|charset=utf-8),/)
      if (entity.customIcon) assert.equal(glyph.title, 'SimpleBadge')
    }
    const png = Buffer.from(report.png, 'base64')
    if (!checkOnly) await writeFile(path.join(images, `${name}.png`), png)
    else assert.deepEqual(await readFile(path.join(images, `${name}.png`)), png, `${name}: PNG differs from current SVG rendering`)
    rendered.push({ title: scene.title, dataUrl: `data:image/png;base64,${report.png}` })
    console.log(`PASS ${name}: schema 1, synthetic, ${report.glyphs.length} bundled/custom images, orthogonal routes, no component/label overlap, ${scene.width}x${scene.height}, font and pixel checks`)
  }

  for (const [index, name] of names.entries()) {
    let document
    if (checkOnly) document = checkedDocument(await readFile(path.join(examples, `${name}.json`), 'utf8'), name).document
    else {
      const parsed = parseDocument(JSON.stringify(drafts[index]))
      assert.equal(parsed.ok, true, JSON.stringify(parsed))
      const laidOut = (await computeLayout(parsed.value, 'RIGHT', 1, compactEngine)).diagram
      assert.ok(laidOut.entities.some(entity => entity.x !== 0 || entity.y !== 0), `${name}: ELK did not run`)
      document = refinePresentation(laidOut, name)
    }
    const text = `${JSON.stringify(document, null, 2)}\n`
    const checked = checkedDocument(text, name)
    const svg = checkOnly ? await readFile(path.join(images, `${name}.svg`), 'utf8') : renderSvg(checked.scene, { ...visualAssets, fontData })
    assert.equal(svg, renderSvg(checked.scene, { ...visualAssets, fontData }), `${name}: SVG differs from current shared renderer`)
    assert.ok(svg.includes('data:font/ttf;base64,'), `${name}: font not embedded`)
    assert.ok(!svg.includes('<foreignObject'), `${name}: native text required`)
    if (!checkOnly) {
      await writeFile(path.join(examples, `${name}.json`), text)
      await writeFile(path.join(images, `${name}.svg`), svg)
    }
    await inspectSvg(svg, checked.scene, name)
  }

  const sheet = await page.evaluate(async items => {
    const canvas = document.createElement('canvas')
    canvas.width = 1440; canvas.height = 1480
    const context = canvas.getContext('2d')
    context.fillStyle = '#edf2f2'; context.fillRect(0, 0, canvas.width, canvas.height)
    for (const [index, item] of items.entries()) {
      const image = new Image()
      image.src = item.dataUrl
      await image.decode()
      const left = 20 + (index % 2) * 710, top = 20 + Math.floor(index / 2) * 730
      context.fillStyle = '#fff'; context.fillRect(left, top, 690, 710)
      const scale = Math.min(670 / image.width, 690 / image.height)
      context.drawImage(image, left + (690 - image.width * scale) / 2, top + 10 + (690 - image.height * scale) / 2, image.width * scale, image.height * scale)
    }
    return canvas.toDataURL('image/png').split(',')[1]
  }, rendered)
  const sheetBytes = Buffer.from(sheet, 'base64')
  if (checkOnly) assert.deepEqual(await readFile(path.join(images, 'examples-contact-sheet.png')), sheetBytes)
  else await writeFile(path.join(images, 'examples-contact-sheet.png'), sheetBytes)
  console.log('PASS contact sheet: four current native example renders')

  if (capture) {
    await access(path.join(app, 'public/branding/logo.svg'))
    const screenshotContext = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'light' })
    const studio = await screenshotContext.newPage()
    const errors = []
    studio.on('pageerror', error => { if (!error.message.startsWith('ResizeObserver loop')) errors.push(error.message) })
    studio.on('dialog', dialog => dialog.accept())
    await studio.goto(process.env.DGM_DOCS_URL ?? 'http://127.0.0.1:5174/')
    await studio.waitForFunction(() => !document.querySelector('button[aria-label="New diagram"]')?.disabled)
    assert.equal(await studio.title(), 'Azure Diagram Studio')
    assert.ok(await studio.getByText('Azure Diagram Studio', { exact: true }).count())
    assert.equal(await studio.locator('html').getAttribute('data-theme'), 'light')
    await studio.getByRole('button', { name: 'Import custom icon', exact: true }).waitFor()
    assert.equal(await studio.locator('.brand-icon').evaluate(image => image.complete && image.naturalWidth > 0), true)
    const favicon = await studio.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href')
    assert.equal((await screenshotContext.request.get(new URL(favicon, studio.url()).href)).ok(), true)
    for (const name of names) {
      const expected = JSON.parse(await readFile(path.join(examples, `${name}.json`), 'utf8'))
      await studio.getByLabel('Open document file', { exact: true }).setInputFiles(path.join(examples, `${name}.json`))
      await studio.waitForFunction(({ title, count }) => document.querySelector('input[aria-label="Document title"]')?.value === title && document.querySelectorAll('.react-flow__node').length === count, { title: expected.title, count: expected.entities.length })
      await studio.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved')
      const pending = studio.waitForEvent('download')
      await studio.getByRole('button', { name: 'Save JSON', exact: true }).click()
      const download = await pending
      const chunks = []
      for await (const chunk of await download.createReadStream()) chunks.push(chunk)
      assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString('utf8')), expected, `${name}: UI open/save changed native metadata or routes`)
      console.log(`PASS ${name}: native UI Open JSON / Save JSON exact round trip`)
      if (name === names[0]) {
        await studio.getByRole('button', { name: 'Fit diagram', exact: true }).click()
        await studio.evaluate(() => document.fonts.ready)
        await studio.waitForFunction(() => {
          const canvas = document.querySelector('.canvas-surface').getBoundingClientRect()
          return [...document.querySelectorAll('.react-flow__node')].every(node => {
            const box = node.getBoundingClientRect()
            return box.left >= canvas.left + 20 && box.right <= canvas.right - 20 && box.top >= canvas.top + 130 && box.bottom <= canvas.bottom - 110
          })
        })
        await studio.evaluate(() => new Promise(resolve => {
          let previous = '', stable = 0
          const frame = () => {
            const current = document.querySelector('.react-flow__viewport').style.transform
            stable = current === previous ? stable + 1 : 0
            previous = current
            if (stable >= 4) resolve()
            else requestAnimationFrame(frame)
          }
          requestAnimationFrame(frame)
        }))
        await studio.screenshot({ path: path.join(images, 'studio-screenshot.png') })
        const lightControlColor = await studio.locator('.theme-toggle').evaluate(button => getComputedStyle(button).color)
        await studio.getByRole('button', { name: 'Switch to dark theme', exact: true }).click()
        await studio.getByRole('button', { name: 'Switch to light theme', exact: true }).waitFor()
        assert.equal(await studio.locator('html').getAttribute('data-theme'), 'dark')
        assert.notEqual(await studio.locator('.theme-toggle').evaluate(button => getComputedStyle(button).color), lightControlColor)
        await studio.screenshot({ path: path.join(images, 'studio-dark.png') })
        await studio.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
        const themeDownloadPending = studio.waitForEvent('download')
        await studio.getByRole('button', { name: 'Save JSON', exact: true }).click()
        const themeDownload = await themeDownloadPending
        const themeChunks = []
        for await (const chunk of await themeDownload.createReadStream()) themeChunks.push(chunk)
        assert.deepEqual(JSON.parse(Buffer.concat(themeChunks).toString('utf8')), expected, 'Theme change must not modify native document')
      }
    }
    assert.deepEqual(errors, [])
    await screenshotContext.close()
    console.log('PASS studio screenshots: original brand/favicon, themed buttons, both themes, fresh context, theme-independent native JSON')
  }
  if (checkOnly) {
    for (const relative of ['README.md', 'docs/manual.md']) {
      const text = await readFile(path.join(root, relative), 'utf8')
      const references = [...text.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1])
      references.push(...[...text.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]))
      for (const reference of references) {
        if (/^https?:/.test(reference)) continue
        const [file] = reference.split('#')
        await access(file ? path.resolve(path.dirname(path.join(root, relative)), decodeURIComponent(file)) : path.join(root, relative))
      }
      if (/release verification pending/i.test(text)) assert.ok(!/releases\/download\//.test(text), `${relative}: unverified release download link`)
      assert.ok(!/project is private|repository access is required/i.test(text), `${relative}: obsolete private-repository instructions`)
      assert.ok(!/C:\\Users\\|C:\\Projects\\|workspaceStorage|debug-logs/i.test(text), `${relative}: private machine path`)
      assert.ok(!/disable (?:antivirus|SmartScreen)/i.test(text.replace(/do not disable[^.]+\./gi, '')), `${relative}: unsafe launch instructions`)
    }
    const ignore = await readFile(path.join(root, '.gitignore'), 'utf8')
    for (const required of ['/.tools/', '/memories/', '/.memories/', '/spike/', '**/node_modules/', '**/dist/', '**/release/', '**/.desktop-stage/', '**/.vite/', '**/test-results/', '/app/src/editor/evidence/']) assert.ok(ignore.includes(required), `Missing ignore: ${required}`)
    assert.ok(!/^[*]+\.(?:json|svg|png)$/m.test(ignore), 'Examples and branding must not be globally ignored')
    console.log('PASS publication docs: relative links, screenshot, original logo, notices, no unpublished download links/private paths, scoped ignore rules')
  }
} catch (error) {
  console.log(`FAIL documentation generation: ${error.stack}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  await server.close()
  console.log(`Documentation process result: ${process.exitCode ?? 0}`)
}