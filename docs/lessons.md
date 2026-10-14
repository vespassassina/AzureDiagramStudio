# Sprint Lessons

The PO accepted Sprint 0 and authorized V1 on 2026-10-09. The verified observations below are adopted for Sprint 1; the visual language and explicit-layout behavior are retained.

Every agent must read this document before starting a sprint. At each PO-led review, append the date, sprint, root cause, adopted solution and task/decision link. Record agent-workflow issues as well as product/engineering issues. Do not present planning assumptions as verified lessons.

## 2026-10-09: Sprint 0 / DGM-000 Observations

Evidence: [spike report](verification/DGM-000.md).

- Retain measurements in controlled React Flow nodes. Rebuilding derived objects without metadata caused drag initialization failures; canonical explicit dimensions now preserve them.
- Use ELK's documented worker transport. The wrapper failed in-browser despite passing Node tests; workerFactory with the official worker works.
- ELK edge coordinates can be container-relative even when root-listed. Translate using container origins and assert endpoints in both directions. A screenshot caught the initial gap; it is now covered by unit/browser tests.
- Exact geometry checks compare transform/size, not selection z-order or camera, which intentionally sit outside history.
- Capture actual output with a real browser when integrated-browser download events are unavailable. Local Edge provided repeatable file/pixel evidence.
- Keep the spike isolated and stop at PO review. Passing feasibility checks do not authorize production work or prove full-MVP acceptance.

## 2026-10-09: Sprint 1 Technical Observations

Evidence: [independent verification](verification/DGM-050.md), [review](verification/sprint-1-review.md). PO-led acceptance review remains pending.

- Freeze contracts before parallel dispatch and keep owners disjoint. Source edits stayed with implementers; the verifier reported defects and made no repairs.
- A coordinate invariant must be expressed at the correct level. Layout preserves annotations in canvas coordinates even when parent-relative values change; guard absolute positions within a tight numeric tolerance while still protecting size/content/membership. Add compute/apply/UI regressions, not only isolated module tests.
- Prototype status text is not a durable verification oracle. Assert real geometry changes, preserved semantics, valid route revisions and exact undo; keep old failures as evidence rather than silently dropping a gate.
- Performance needs a production browser measurement. A 137ms edit p95 failed despite green Node timings. Memoize only measured repeated work and use complete comparisons; retain the same stress data and thresholds when verifying repairs.
- Quality fixtures must fit their measured text. Fix overlapping fixture coordinates/bounds without truncating long text or changing the stress fixture. Screenshots found a failure broad pixel counts missed.
- Official glyph filenames can be misleading. Confirm product identity from official labelled diagrams and retain actual file hashes/terms; use the separate official Entra collection where appropriate.
- Automated candidate readiness does not establish Office fidelity or novice usability. Record those checks as unverified and stop for PO review; do not start another sprint automatically.

## 2026-10-09: DGM-060 Catalog Refinement Observations

Evidence: [DGM-060](verification/DGM-060.md).

- Separate exhaustive asset provenance from presentation. An official icon archive contains duplicates, variants, interface glyphs and historical services; it is not a current product menu. Preserve old keys while curating new browsing/search.
- Use explicit lifecycle rules with dated sources, not broad words such as Cache or ML. Future retirement/deprecation is not present retirement. Record unknown dates and source gaps rather than inventing facts.
- Prioritize familiar choices editorially and label that assumption accurately. Four pins plus alphabetical tails and a small number of icon-led groups make the common workflow scannable; search holds the long tail.
- A mobile pixel test must not place probe nodes on top of one another. Correct deterministic fixture geometry while retaining per-icon ink assertions, rather than weakening export checks.
- Large asset inventories can trigger thousands of module reloads in isolated tests. A hash-deduplicated verified registry removes module fan-out without altering glyph bytes, and test setup must finish fresh imports before clearing spies.
- Do not accept a narrowly failed performance gate or retry for a favorable sample. Profiling isolated repeated descriptor/UTF-8 traversal; bounded encoding and eliminating redundant validation reduced costs while retaining security, Unicode, mutable-input and atomic rejection tests. The verifier reran the unchanged production gate once after the repair.

## 2026-10-10: Sprint 2 Technical Observations, Pending PO Review

Evidence: [Sprint 2 review](verification/sprint-2-review.md). These are verified implementation observations, not a claim that the PO has closed the sprint.

- Canonical stacking must be shared by mutation and rendering. Missing-rank defaults of zero changed unselected legacy objects. Shared sibling/band policy, parent-first traversal and manual React Flow ranks now preserve default appearance and no-op identity without selection elevation masking the result.
- Reusing current boundary size prevents shrinkage; reserving worst-case narrow text avoids clipping but wastes space. Deterministic intrinsic minima and bounded same-engine width/header reconciliation pass repeated-direction, shrinkage, header and endpoint checks together.
- A presentation guard only in the editor misses async file/layout completion owned by the shell. A session-only entry callback invalidates request tokens while retaining independent lock ownership and pre-existing autosave writes.
- Responsive reachability requires actual pointer hit testing. A drawer covered a selected-properties toggle even though the button had correct dimensions and a valid callback. Reserved navigation space now permits real one-click panel swapping without changing selection or camera.
- Test the action's actual scope: selected-content framing must assert the full selected subtree, while whole-diagram fit separately checks every object. Pan probes must start on a hit-tested pane, not a toolbar. Short viewports require scroll/focus reachability, not all rail actions simultaneously visible.
- Asset-format and fixed-slot oracles can drift after authorized changes. Owner repairs retain exact MIME/payload/hash/signature and complete brand containment rather than broadly accepting arbitrary assets or deleting fit checks.
- Retain red/green logs when a delegate first runs them. End-of-task summaries are not independently reconstructable proof in a shared uncommitted tree. New tasks should write scoped failure/repair evidence as they go; final verification preserves failed candidates and does not invent missing history.

## 2026-10-11: Sprint 3 Technical Observations, Pending PO Review

Evidence: [Sprint 3 review](verification/sprint-3-review.md). Automated readiness does not close the PO review.

- Physical targets must follow the settled rendered camera, not canonical dimensions or an assumed zoom. Await fonts and stable viewport transforms after animated fits; proportionally scan the rendered node and retain exact hit testing plus handle exclusions. Fixed 12px insets cannot target a node fitted to 7.91 CSS pixels. Both owner repairs retain geometry/history assertions.
- Distinguish test preconditions from product defects. Preserve failed candidates, add failure-only diagnostics, and validate focused repairs before an independent unfiltered production run. Serialized source tests passed all 5,431 checks; parallel timeout causality remains unproven.
- Windows Modern Standby can invalidate timeout and elapsed-time evidence. Confirm sleep/resume events, preserve the interrupted log without claiming a pass, and cancel only the owned process tree before a fresh run. Do not change system sleep settings or unrelated processes.
- Reconcile the manual with actual source controls after verification. A new export dialog, custom canvas background and optional Present grid make old white-only/menu instructions incorrect; current source verification still does not qualify historical packaged executables or native Teams/Office handoff.

## 2026-10-14: Sprint 4 Continuation Workflow Correction

Authority: [PO workflow decision](decisions.md#2026-10-14-autonomous-completion-of-approved-local-work)
and [live execution queue](roadmap.md#execution-queue). These are observed workflow
problems and adopted process corrections, not new product test results.

- A chronological roadmap with multiple historical hard stops is not a usable
	execution queue. Keep one current state/owner/evidence/next-action table above
	the archive; use it on resume instead of restarting old work.
- Repeated permission requests for already-approved repairs, tests and handoffs
	interrupted completion. Continue the bounded queue automatically; escalate
	only genuine approval gates and consolidate external decisions. Persist the
	per-defect repair count across handoffs; three failed cycles block that item
	instead of starting another automatic loop.
- DGM-116 was reworked while DGM-110 still needed closure. Verify existing
	implementation and evidence before choosing more code changes; a completed
	cosmetic task is not a substitute for the next runnable acceptance task.
- Terminal-only evidence was lost between turns and prompted duplicate runs.
	Capture logs and final exit/totals from the first execution. Partial output is
	inconclusive; retained passing evidence with unchanged inputs is reusable.
- Skipping a review meeting is not passing native or manual acceptance. Track
	those gaps per platform/release claim and continue independent local work.