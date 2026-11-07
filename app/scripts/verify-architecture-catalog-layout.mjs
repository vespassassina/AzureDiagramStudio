import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '..')
const catalogPath = resolve(root, 'examples', 'architecture-catalog')
const outputPath = process.env.DGM_LAYOUT_REPORT

const server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true } })
try {
  const [{ fixedNodes, obstacles, segmentHits }, { ancestors }, { absolutePosition, measureEntity }, { buildScene }] = await Promise.all([
    server.ssrLoadModule('/src/routing-geometry.ts'),
    server.ssrLoadModule('/src/routing-geometry.ts'),
    server.ssrLoadModule('/src/model.ts'),
    server.ssrLoadModule('/src/scene.ts'),
  ])
  const reports = []
  for (const name of (await readdir(catalogPath)).filter(name => name.endsWith('.json')).sort()) {
    const diagram = JSON.parse(await readFile(resolve(catalogPath, name), 'utf8'))
    const nodes = fixedNodes(diagram)
    let segments = 0
    for (const edge of diagram.connections) {
      if (edge.routeRevision !== diagram.revision || !edge.points || edge.points.length < 2) throw new Error(`${name}:${edge.id}: missing canonical route`)
      const source = nodes.get(edge.from), target = nodes.get(edge.to)
      if (!source || !target) throw new Error(`${name}:${edge.id}: missing endpoint`)
      const first = edge.points[0], last = edge.points.at(-1)
      const onBox = (point, box) => point.x === box.left || point.x === box.right || point.y === box.top || point.y === box.bottom
      if (!onBox(first, source.box) || !onBox(last, target.box)) throw new Error(`${name}:${edge.id}: route does not terminate at endpoint boundary`)
      const related = new Set([...ancestors(edge.from, nodes), ...ancestors(edge.to, nodes)])
      for (let index = 1; index < edge.points.length; index++) {
        const a = edge.points[index - 1], b = edge.points[index]
        if ((a.x !== b.x && a.y !== b.y) || (a.x === b.x && a.y === b.y)) throw new Error(`${name}:${edge.id}: non-orthogonal route segment`)
        for (const obstacle of obstacles(edge, nodes)) {
          if (obstacle.id === edge.from || obstacle.id === edge.to) continue
          const box = obstacle.component || !related.has(obstacle.id) ? obstacle.box : nodes.get(obstacle.id).header
          if (segmentHits(a, b, box)) throw new Error(`${name}:${edge.id}: segment intersects ${obstacle.component ? 'component' : 'boundary header'} ${obstacle.id}`)
        }
        segments++
      }
    }
    for (const entity of diagram.entities.filter(entity => entity.kind === 'component')) {
      if (entity.width < 220) throw new Error(`${name}:${entity.id}: catalog tile is narrower than the canonical 220px component geometry`)
      if (measureEntity(entity).height > entity.height) throw new Error(`${name}:${entity.id}: tile height clips measured text`)
      if (entity.parentId) {
        const parent = nodes.get(entity.parentId)
        const point = absolutePosition(diagram, entity.id)
        if (parent && point.y < parent.header.bottom + 12) throw new Error(`${name}:${entity.id}: tile overlaps boundary header`)
      }
    }
    const scene = buildScene(diagram)
    reports.push({
      name, nodes: diagram.entities.length, edges: diagram.connections.length, segments,
      contentWidth: scene.contentBounds.width, contentHeight: scene.contentBounds.height,
      contentAspectRatio: Number((scene.contentBounds.width / scene.contentBounds.height).toFixed(2)),
    })
  }
  const result = { diagrams: reports, diagramsChecked: reports.length, routesChecked: reports.reduce((sum, report) => sum + report.edges, 0), segmentsChecked: reports.reduce((sum, report) => sum + report.segments, 0) }
  if (result.diagramsChecked !== 24 || result.routesChecked !== 202) throw new Error(`Expected 24 diagrams and 202 routes, received ${result.diagramsChecked} diagrams and ${result.routesChecked} routes`)
  if (reports.some(report => report.contentAspectRatio > 1.8)) throw new Error('A catalog diagram exceeds the compact 1.8:1 aspect-ratio limit')
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`)
  console.log(`Validated ${result.diagramsChecked} diagrams, ${result.routesChecked} routes, and ${result.segmentsChecked} orthogonal segments.`)
} finally {
  await server.close()
}
