import type { Entity } from './model.ts'

export const CONNECTION_ORDER = 2

export function effectiveOrder(entity: Entity): number {
  return entity.order ?? (entity.layer === 'background' ? -1 : entity.kind === 'boundary' ? 0 : 4)
}

export function stackingBand(entity: Entity): -1 | 0 | 4 {
  return entity.layer === 'background' ? -1 : entity.kind === 'boundary' ? 0 : 4
}

export function siblingScopes<T extends Entity>(entities: T[]): Map<string | null, T[]> {
  const scopes = new Map<string | null, T[]>()
  for (const entity of entities) {
    const parent = entity.parentId ?? null
    const siblings = scopes.get(parent) ?? []
    siblings.push(entity)
    scopes.set(parent, siblings)
  }
  for (const siblings of scopes.values()) siblings.sort((left, right) => stackingBand(left) - stackingBand(right) || effectiveOrder(left) - effectiveOrder(right))
  return scopes
}

/**
 * Visit ordered sibling subtrees parent-first, distributing entries into semantic bands.
 * Root backgrounds precede containers; contained backgrounds follow their own container.
 * Reserve one canvas rank between all containers and all foreground tiles for connections.
 */
export function painterOrder<T extends Entity>(entities: T[]) {
  const scopes = siblingScopes(entities)
  const background: T[] = [], boundaries: T[] = [], foreground: T[] = []
  const visit = (entity: T) => {
    const band = stackingBand(entity)
    const target = band === -1 && !entity.parentId ? background : entity.kind === 'boundary' || band === -1 ? boundaries : foreground
    target.push(entity)
    for (const child of scopes.get(entity.id) ?? []) visit(child)
  }
  for (const root of scopes.get(null) ?? []) visit(root)
  const ordered = [...background, ...boundaries, ...foreground]
  const connectionZIndex = background.length + boundaries.length
  const nodeZIndices = new Map(ordered.map((entity, index) => [entity.id, index < connectionZIndex ? index : index + 1]))
  return { entities: ordered, background, boundaries, foreground, connectionZIndex, nodeZIndices }
}