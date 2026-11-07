import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '..')
const inventoryPath = resolve(import.meta.dirname, 'architecture-catalog-source.json')
const examplesPath = resolve(root, 'examples', 'architecture-catalog')
const registryPath = resolve(root, 'src', 'app', 'architecture-catalog.generated.ts')
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const assignments = groups => Object.fromEntries(groups.flatMap(([group, ids]) => ids.map(id => [id, group])))

// Each placement is reviewed against the source inventory's boundary meaning.
// `null` deliberately leaves an external actor outside a claimed Azure, OT,
// regional, or environment boundary; it is never a fallback assignment.
const boundaryAssignments = {
  'ms-rag-grounded-knowledge-assistant': assignments([['external', ['source', 'user', 'response']], ['azure-data', ['ingest', 'embed', 'index']], ['azure-app', ['app', 'orchestrator', 'model']]]),
  'ms-industrial-opcua-telemetry': assignments([['plant', ['plc', 'operator']], ['edge-zone', ['edge', 'ops', 'flow']], ['azure-cloud', ['ingest', 'store', 'dash']]]),
  'ms-ml-private-inference-promotion': { ...assignments([['dev-sub', ['data', 'dev', 'pipeline']], ['shared-sub', ['registry']], ['stage-prod', ['stage', 'prod', 'gateway', 'monitor']]]), client: null },
  'ms-appservice-multiregion-recovery': { ...assignments([['edge', ['frontdoor', 'health']], ['region-a', ['app1']], ['region-b', ['app2']], ['control', ['pipeline', 'monitor']]]), users: null, state: null },
  'ms-azure-local-hyperconverged-platform': assignments([['datacenter', ['machines', 'tor', 'cluster', 'vm', 'k8s', 'firewall']], ['azure', ['arc', 'azureops']]]),
  'ms-mainframe-change-data-capture': assignments([['legacy-zone', ['legacy']], ['connector-zone', ['capture', 'transport']], ['azure-zone', ['ingress', 'transform', 'sql', 'lake', 'analytics']]]),
  'ms-digital-twin-operations-graph': assignments([['physical', ['devices', 'business']], ['twin', ['hub', 'compute', 'twins', 'query', 'routes']], ['consumers', ['history', 'scene']]]),
  'ms-fabric-cross-cloud-analytics': assignments([['sources', ['sources']], ['fabric', ['ingest', 'events', 'lake', 'warehouse', 'eventhouse', 'process', 'govern']], ['users', ['bi']]]),
  'aws-mobile-graphql-backend': assignments([['client', ['mobile']], ['azure-api', ['identity', 'api', 'resolver', 'telemetry']], ['data', ['db']]]),
  'aws-private-file-access': assignments([['corp', ['user', 'dns']], ['azure-ingress', ['gateway', 'api', 'identity', 'audit']], ['storage', ['private', 'blob']]]),
  'aws-dynamodb-change-stream-to-lake': assignments([['source', ['app', 'db', 'cdc']], ['streaming', ['stream', 'transform']], ['analytics', ['lake', 'consumer']]]),
  'aws-lambda-telemetry-analytics': assignments([['workload', ['functions', 'instrument']], ['monitoring', ['monitor', 'workspace', 'dash', 'operator']]]),
  'aws-cell-router-tenant-placement': { ...assignments([['control', ['identity', 'router', 'orchestrator', 'mapping', 'queue', 'telemetry']], ['cells', ['cell-a', 'cell-b']]]), client: null },
  'aws-iiot-edge-data-backbone': assignments([['site', ['equipment', 'site-ingest', 'buffer']], ['network', ['connect']], ['cloud', ['stream', 'lake', 'analytics', 'users']]]),
  'aws-multiregion-read-local-write-global': { ...assignments([['region-a', ['app1', 'primary']], ['region-b', ['app2', 'replica']], ['global', ['route', 'reconcile', 'monitor']]]), users: null },
  'aws-modern-governed-data-platform': assignments([['sources', ['producers']], ['platform', ['batch', 'events', 'lake', 'catalog', 'process', 'serve']], ['consumer', ['consumers']]]),
  'gcp-global-multiregion-relational-app': { ...assignments([['edge', ['edge']], ['region-a', ['web-a', 'app-a']], ['region-b', ['web-b', 'app-b']], ['data-boundary', ['internal-route', 'data-primary', 'data-secondary', 'ops']]]), users: null },
  'gcp-hybrid-dr-recovery-site': { ...assignments([['dc', ['onprem-app', 'onprem-data', 'backup']], ['network', ['link']], ['azure', ['recovery-data', 'recovery-app']]]), users: null, operator: null },
  'gcp-rag-app-alloydb-origin': assignments([['source', ['upload', 'user']], ['ingest', ['trigger', 'pipeline', 'embedding', 'index']], ['serve', ['app', 'model']], ['eval', ['eval']]]),
  'gcp-secure-event-driven-functions': assignments([['producer', ['source']], ['function-zone', ['event', 'function', 'identity', 'secret', 'ops']], ['private-data', ['private', 'service']]]),
  'gcp-mlops-training-promotion': assignments([['data', ['data']], ['pipeline', ['trigger', 'validate', 'transform', 'train', 'evaluate']], ['release', ['registry', 'serve', 'monitor']]]),
  'gcp-image-vision-analytics': assignments([['upload', ['client', 'storage']], ['process', ['event', 'queue', 'worker', 'vision']], ['analytics', ['results', 'analyst']]]),
  'gcp-multitenant-developer-platform': assignments([['dev', ['dev']], ['test', ['nonprod', 'pipeline', 'registry']], ['prod', ['prod-a', 'prod-b', 'edge', 'identity', 'tenant']]]),
  'gcp-log-export-replay-pipeline': assignments([['azure-logs', ['workloads', 'monitor']], ['export', ['stream', 'primary', 'deadletter', 'secret', 'ops']], ['external', ['external']]]),
}

const color = ['azure', 'teal', 'amber', 'rose', 'gray', 'purview']
const iconFor = value => {
  const text = value.toLowerCase()
  if (/(user|client|operator|team|consumer|analyst|customer)/.test(text)) return 'user'
  if (/(sql|database|data explorer|eventhouse|warehouse|cosmos|registry|directory)/.test(text)) return 'database'
  if (/(lake|onelake|storage|blob|file|document)/.test(text)) return 'storage'
  if (/(event|queue|bus|stream|telemetry|notification)/.test(text)) return 'queue'
  if (/(model|embedding|vision|machine learning|inference|twin)/.test(text)) return 'model'
  if (/(identity|vault|policy|private|security|firewall|gateway)/.test(text)) return 'shield'
  if (/(function|pipeline|process|transform|worker|capture|handler|orchestrator)/.test(text)) return 'function'
  if (/(network|routing|front door|connectivity)/.test(text)) return 'api'
  if (/(cluster|kubernetes|server|machine|edge|app service)/.test(text)) return 'server'
  return 'service'
}

// Keep an explicitly selected Azure service in the visible subtitle. The source
// inventory records alternatives for research traceability, but catalog tiles
// should be an editable starting point rather than an ambiguous menu of products.
const concreteTechnology = (technology, id) => {
  if (id === 'gcp-global-multiregion-relational-app') {
    if (technology.includes('Azure SQL')) return 'Azure SQL Database: regional writer + async secondary'
    if (technology.includes('App Service or AKS')) return 'Azure App Service'
  }
  return technology
    .replace(/\s+\(candidate\)/gi, '')
    .replace(/\s+\(where supported\)/gi, '')
    .replace(/\s+\(design-dependent\)/gi, '')
    .replace(/\s+\(choice-dependent\)/gi, '')
    .replace(/\s+or\s+[^,;]+/i, '')
}

const descriptionFor = entry => {
  const supporting = entry.supporting_sources?.length
    ? `\n\n## Supplementary context\n\n${entry.supporting_sources.map(source => `- [${source.title}](${source.url}) — Reviewed: ${source.reviewed_on}; ${source.relevance ?? 'Supplementary provider context; not a copied diagram or implementation.'}`).join('\n')}`
    : ''
  return `${entry.explanation_md.trim()}\n\n## Source provenance\n\n- Origin provider: ${entry.origin_provider}\n- Target: ${entry.target} conceptual adaptation\n- Primary source: [${entry.reference.title}](${entry.reference.url})\n- Reviewed: ${entry.reference.reviewed_on}${supporting}\n\n## Catalog status\n\nThis is an original, editable Azure conceptual adaptation. It is synthetic reference material, not a deployed system, certified vendor architecture, or automatic deployment plan.\n\n## Mapping caveats\n\n${entry.caveats.map(caveat => `- ${caveat}`).join('\n')}`
}

const diagramFor = (entry, measureEntity) => {
  const groups = entry.groups.map(group => ({ ...group, id: `group-${group.id}` }))
  const assignment = boundaryAssignments[entry.id]
  if (!assignment) throw new Error(`${entry.id}: missing reviewed node-to-boundary assignments`)
  const componentHeights = new Map(entry.nodes.map(node => {
    const component = {
      id: node.id, kind: 'component', label: node.label, subtitle: concreteTechnology(node.technology, entry.id),
      parentId: null, x: 0, y: 0, width: 220, height: 88, color: 'gray',
    }
    return [node.id, measureEntity(component).height]
  }))
  const lanes = groups.map(() => [])
  for (const node of entry.nodes) {
    const assigned = assignment[node.id]
    if (assigned === undefined) throw new Error(`${entry.id}: ${node.id} has no reviewed boundary assignment`)
    if (assigned === null) continue
    const lane = entry.groups.findIndex(group => group.id === assigned)
    if (lane < 0) throw new Error(`${entry.id}: ${node.id} names unknown boundary ${assigned}`)
    lanes[lane].push(node)
  }

  // Keep the native diagrams compact by placing semantic ownership groups in a
  // small two-dimensional grid. Nodes remain in their reviewed boundary; this
  // is deliberately not a fake parallel execution model for sequential flows.
  const columns = groups.length >= 5 ? 3 : groups.length >= 3 ? 2 : 1
  const groupDimensions = lanes.map((nodes, lane) => {
    const ids = new Set(nodes.map(node => node.id))
    const depth = new Map(nodes.map(node => [node.id, 0]))
    // Keep causal local paths in distinct columns where topology permits. The
    // cap preserves a compact native scene while avoiding fake straight routes.
    for (let pass = 0; pass < nodes.length; pass++) for (const edge of entry.edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) continue
      const next = Math.min(3, (depth.get(edge.from) ?? 0) + 1)
      if (next > (depth.get(edge.to) ?? 0)) depth.set(edge.to, next)
    }
    const columns = Math.max(...depth.values()) + 1
    const rows = Array.from({ length: columns }, () => 0)
    const position = new Map()
    for (const node of nodes) {
      const column = depth.get(node.id) ?? 0
      position.set(node.id, { column, row: rows[column]++ })
    }
    return { width: columns * 260 + 4, height: Math.max(640, 140 + Math.max(...rows, 1) * 168), position }
  })
  const rowHeights = Array.from({ length: Math.ceil(groups.length / columns) }, (_, row) => Math.max(...groupDimensions.slice(row * columns, row * columns + columns).map(size => size.height)))
  const rowOffsets = rowHeights.reduce((offsets, _height) => [...offsets, (offsets.at(-1) ?? 24) + (offsets.length ? rowHeights[offsets.length - 1] + 42 : 0)], [])
  const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(...groupDimensions.filter((_, index) => index % columns === column).map(size => size.width)))
  const columnOffsets = columnWidths.reduce((offsets, _width) => [...offsets, (offsets.at(-1) ?? 0) + (offsets.length ? columnWidths[offsets.length - 1] + 42 : 0)], [])
  const boundaries = groups.map((group, index) => {
    const dimension = groupDimensions[index]
    return {
      id: group.id,
      kind: 'boundary',
      label: group.label,
      subtitle: group.boundary,
      parentId: null,
      layer: 'foreground',
      x: columnOffsets[index % columns],
      y: rowOffsets[Math.floor(index / columns)],
      width: dimension.width,
      height: dimension.height,
      color: color[index % color.length],
    }
  })
  const entities = [...boundaries]
  const positions = new Map()
  for (const [lane, nodes] of lanes.entries()) {
    for (const [row, node] of nodes.entries()) {
      const boundary = boundaries[lane]
      const placement = groupDimensions[lane].position.get(node.id) ?? { column: 0, row }
      const entity = {
        id: node.id,
        kind: 'component',
        label: node.label,
        subtitle: concreteTechnology(node.technology, entry.id),
        parentId: boundary.id,
        layer: 'foreground',
        x: 22 + placement.column * 260,
        // Boundary labels/subtitles consume variable header height; leave a
        // measured-safe lane before the first tile rather than routing through it.
        y: 160 + placement.row * 168,
        width: 220,
        height: componentHeights.get(node.id),
        color: color[lane % color.length],
        icon: iconFor(`${node.label} ${node.technology}`),
        status: 'synthetic',
      }
      entities.push(entity)
      positions.set(entity.id, { x: boundary.x + entity.x + entity.width / 2, y: boundary.y + entity.y + entity.height / 2 })
    }
  }
  for (const node of entry.nodes) {
    if (assignment[node.id] !== null) continue
    const index = [...positions].length
    const incoming = entry.edges.some(edge => edge.to === node.id)
    const outgoing = entry.edges.some(edge => edge.from === node.id)
    const peerId = entry.edges.find(edge => edge.from === node.id)?.to ?? entry.edges.find(edge => edge.to === node.id)?.from
    const peerBoundary = peerId && assignment[peerId] !== null ? boundaries.find(boundary => boundary.id === assignment[peerId]) : undefined
    const rightEdge = peerBoundary ? peerBoundary.x + peerBoundary.width : Math.max(...boundaries.map(boundary => boundary.x + boundary.width))
    const externalY = (peerBoundary?.y ?? 24) + 160 + (index % 2) * 112
    const entity = {
      id: node.id, kind: 'component', label: node.label, subtitle: concreteTechnology(node.technology, entry.id),
      // External consumers/sinks sit beyond the right edge; actors that initiate
      // the flow remain to the left. This keeps the canonical router's outward
      // ports clear without inventing a boundary membership.
      parentId: null, layer: 'foreground', x: incoming && !outgoing ? rightEdge + 120 + (index % 2) * 90 : (peerBoundary?.x ?? 0) - 320 + (index % 2) * 90, y: externalY, width: 220, height: componentHeights.get(node.id),
      color: 'source', icon: iconFor(`${node.label} ${node.technology}`), status: 'synthetic',
    }
    entities.push(entity)
    positions.set(entity.id, { x: entity.x + entity.width / 2, y: entity.y + entity.height / 2 })
  }
  const connections = entry.edges.map((edge, index) => {
    if (!positions.has(edge.from) || !positions.has(edge.to)) throw new Error(`${entry.id}: unresolved diagram endpoint ${edge.from} -> ${edge.to}`)
    return {
      id: `${entry.id}-flow-${index + 1}`,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      style: 'solid',
      arrow: 'forward',
      sourceSide: 'auto',
      targetSide: 'auto',
    }
  })
  return {
    schemaVersion: 1,
    id: `${entry.id}-v1`,
    title: entry.title,
    subtitle: `${entry.summary} Synthetic Azure reference; no deployment is implied.`.slice(0, 200),
    description: descriptionFor(entry),
    synthetic: true,
    legendVisible: true,
    legend: [
      { label: 'Illustrative Azure flow', color: '#0078d4', meaning: 'Original conceptual flow, not verified deployment connectivity.' },
      { label: 'Synthetic reference', color: '#62696c', dashed: true, meaning: 'Editable starting point requiring workload-specific design.' },
    ],
    revision: 1,
    direction: 'RIGHT',
    entities,
    connections,
  }
}

const toTs = ({ entries }) => {
  const imports = entries.map(entry => `import ${entry.id.replaceAll('-', '_')} from '../../examples/architecture-catalog/${entry.id}.json?raw'`).join('\n')
  const rows = entries.map(entry => {
    const key = entry.id.replaceAll('-', '_')
    return `  { key: '${entry.id}', label: ${JSON.stringify(entry.title)}, source: ${key}, sourceCue: 'Architecture catalog', origin: ${JSON.stringify(entry.origin_provider)}, categoryPath: ${JSON.stringify(entry.category_path)}, summary: ${JSON.stringify(entry.summary)}, reference: ${JSON.stringify(entry.reference.url)}, reviewedOn: ${JSON.stringify(entry.reference.reviewed_on)}, caveats: ${JSON.stringify(entry.caveats)} },`
  }).join('\n')
  return `// Generated from the retained DGM-164 research inventory. Do not edit by hand.\nimport type { ArchitectureCatalogChoice } from './architecture-catalog.ts'\n${imports}\n\nexport const researchedArchitectureCatalog: readonly ArchitectureCatalogChoice[] = [\n${rows}\n]\n`
}

const inventory = await read(inventoryPath)
if (inventory.entries.length !== 24) throw new Error(`Expected 24 researched entries, received ${inventory.entries.length}`)
await mkdir(examplesPath, { recursive: true })
const routerServer = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } })
try {
  const [{ routeFixedGeometry }, { measureEntity }] = await Promise.all([
    routerServer.ssrLoadModule('/src/routing.ts'),
    routerServer.ssrLoadModule('/src/model.ts'),
  ])
  for (const entry of inventory.entries) {
    const target = resolve(examplesPath, `${entry.id}.json`)
    const generated = routeFixedGeometry(diagramFor(entry, measureEntity)).diagram
    await writeFile(target, `${JSON.stringify(generated, null, 2)}\n`)
  }
} finally {
  await routerServer.close()
}
await writeFile(registryPath, toTs(inventory))
console.log(`Generated ${inventory.entries.length} DGM-164 native diagrams in ${relative(root, examplesPath)}`)
