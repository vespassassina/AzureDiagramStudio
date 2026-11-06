import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

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

const diagramFor = entry => {
  const groups = entry.groups.map(group => ({ ...group, id: `group-${group.id}` }))
  const assignment = boundaryAssignments[entry.id]
  if (!assignment) throw new Error(`${entry.id}: missing reviewed node-to-boundary assignments`)
  const lanes = groups.map(() => [])
  for (const node of entry.nodes) {
    const assigned = assignment[node.id]
    if (assigned === undefined) throw new Error(`${entry.id}: ${node.id} has no reviewed boundary assignment`)
    if (assigned === null) continue
    const lane = entry.groups.findIndex(group => group.id === assigned)
    if (lane < 0) throw new Error(`${entry.id}: ${node.id} names unknown boundary ${assigned}`)
    lanes[lane].push(node)
  }

  const boundaries = groups.map((group, index) => ({
    id: group.id,
    kind: 'boundary',
    label: group.label,
    subtitle: group.boundary,
    parentId: null,
    layer: 'foreground',
    x: index * 352,
    y: 40,
    width: 320,
    height: Math.max(256, 92 + lanes[index].length * 124),
    color: color[index % color.length],
  }))
  const entities = [...boundaries]
  const positions = new Map()
  for (const [lane, nodes] of lanes.entries()) {
    for (const [row, node] of nodes.entries()) {
      const boundary = boundaries[lane]
      const entity = {
        id: node.id,
        kind: 'component',
        label: node.label,
        subtitle: concreteTechnology(node.technology, entry.id),
        parentId: boundary.id,
        layer: 'foreground',
        x: 28,
        y: 66 + row * 124,
        width: 264,
        height: 96,
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
    const entity = {
      id: node.id, kind: 'component', label: node.label, subtitle: concreteTechnology(node.technology, entry.id),
      parentId: null, layer: 'foreground', x: -300, y: 80 + index * 116, width: 264, height: 96,
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
for (const entry of inventory.entries) {
  const target = resolve(examplesPath, `${entry.id}.json`)
  const generated = diagramFor(entry)
  try {
    const previous = await read(target)
    if (previous.id === generated.id) {
      generated.entities = generated.entities.map(entity => {
        const old = previous.entities.find(candidate => candidate.id === entity.id)
        return old && old.kind === entity.kind ? { ...entity, x: old.x, y: old.y, width: old.width, height: old.height } : entity
      })
      generated.connections = generated.connections.map(connection => {
        const old = previous.connections.find(candidate => candidate.id === connection.id)
        return old && old.from === connection.from && old.to === connection.to && old.label === connection.label
          ? { ...connection, points: old.points, labelPosition: old.labelPosition, routeRevision: old.routeRevision }
          : connection
      })
    }
  } catch {}
  await writeFile(target, `${JSON.stringify(generated, null, 2)}\n`)
}
await writeFile(registryPath, toTs(inventory))
console.log(`Generated ${inventory.entries.length} DGM-164 native diagrams in ${relative(root, examplesPath)}`)
