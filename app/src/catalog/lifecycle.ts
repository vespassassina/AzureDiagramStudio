import type { CatalogItem } from '../catalog.ts'
import policy from './lifecycle.json'

export type LifecycleRule = {
  id: string
  reason: 'retired' | 'po-exclusion' | 'deprecated-glyph'
  checkedDate: string
  effectiveDate?: string
  verifiedRetiredAsOf?: string
  filenames: string[]
  sources: string[]
  note?: string
}

export const checkedDate = policy.checkedDate
export const lifecycleRules: LifecycleRule[] = policy.rules.map(rule => ({ ...rule, reason: rule.reason as LifecycleRule['reason'], checkedDate }))
for (const rule of lifecycleRules) {
  Object.freeze(rule.filenames)
  Object.freeze(rule.sources)
  Object.freeze(rule)
}
Object.freeze(lifecycleRules)
const rulesByFilename = new Map(lifecycleRules.flatMap(rule => rule.filenames.map(filename => [filename, rule] as const)))

export function lifecycleDecision(item: CatalogItem, asOf = checkedDate): { excluded: boolean; rule?: LifecycleRule } {
  if (item.catalog !== 'azure') return { excluded: false }
  const rule = rulesByFilename.get(item.source.entry.split('/').at(-1) ?? '')
  if (!rule) return { excluded: false }
  const appliesFrom = rule.effectiveDate ?? rule.verifiedRetiredAsOf ?? rule.checkedDate
  return { excluded: asOf >= appliesFrom, rule }
}