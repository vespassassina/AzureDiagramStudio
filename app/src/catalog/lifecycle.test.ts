import assert from 'node:assert/strict'
import { test } from 'vitest'
import { allLibraryItems } from '../catalog.ts'
import { checkedDate, lifecycleDecision, lifecycleRules } from './lifecycle.ts'

test('should_record_source_dated_exact_filename_rules_without_inventing_bonsai_dates', () => {
  assert.equal(checkedDate, '2026-10-09')
  for (const rule of lifecycleRules) {
    assert.ok(rule.filenames.length)
    assert.equal(rule.checkedDate, checkedDate)
    if (rule.reason === 'retired') {
      assert.match((rule.effectiveDate ?? rule.verifiedRetiredAsOf)!, /^\d{4}-\d{2}-\d{2}$/)
      assert.ok(rule.sources.some(source => /^https:\/\/(learn\.microsoft\.com|azure\.microsoft\.com|www\.microsoft\.com|raw\.githubusercontent\.com\/Azure-Samples)\//.test(source)))
    }
  }
  const bonsai = lifecycleRules.find(rule => rule.id === 'bonsai')!
  assert.equal(bonsai.reason, 'po-exclusion')
  assert.equal(bonsai.effectiveDate, undefined)
})

test('should_apply_retirement_only_on_or_after_its_effective_date', () => {
  for (const rule of lifecycleRules.filter(rule => rule.reason === 'retired')) {
    const item = allLibraryItems.find(candidate => rule.filenames.includes(candidate.source.entry.split('/').at(-1)!))!
    assert.ok(item, rule.id)
    assert.equal(lifecycleDecision(item, '2000-01-01').excluded, false, rule.id)
    assert.equal(lifecycleDecision(item, rule.effectiveDate ?? rule.verifiedRetiredAsOf).excluded, true, rule.id)
  }
})

test('should_keep_future_announced_services_and_managed_redis_current_as_of_check_date', () => {
  for (const query of [/Spring/, /IoT-Central/, /Azure-Managed-Redis/, /Cache-Redis/, /Content-Moderators/]) {
    const items = allLibraryItems.filter(item => query.test(item.source.entry))
    assert.ok(items.length, query.source)
    for (const item of items) assert.equal(lifecycleDecision(item).excluded, false, item.label)
  }
})

test('should_not_hide_active_services_by_generic_label_substring', () => {
  const raw = allLibraryItems.find(item => item.icon === 'azure-redis')!
  assert.equal(lifecycleDecision({ ...raw, label: 'Bing Cache Scheduler Blockchain' }).excluded, false)
  assert.equal(lifecycleDecision({ ...raw, source: { ...raw.source, entry: 'custom/Not-Azure-Blockchain-Service.svg' } }).excluded, false)
})

test('should_hide_only_the_historical_hpc_cache_glyph_without_hiding_current_cache_or_compute', () => {
  const retired = allLibraryItems.find(item => item.icon === 'azure-00776-icon-service-azure-hcp-cache')!
  assert.equal(lifecycleDecision(retired).excluded, true)
  for (const key of ['azure-redis', 'azure-10786-icon-service-cache', 'azure-02509-icon-service-connected-cache', 'azure-02518-icon-service-azure-hpc-workbenches', 'azure-10031-icon-service-batch-accounts']) {
    assert.equal(lifecycleDecision(allLibraryItems.find(item => item.icon === key)!).excluded, false, key)
  }
})