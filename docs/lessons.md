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

## 2026-10-15: Sprint 4 Integration Evidence And Timeout Diagnosis

Evidence: [Sprint 4 review](verification/sprint-4-review.md) and
[current disposition](roadmap.md#2026-10-15-consolidated-disposition).

- A full source command can collect browser tests with fixed evidence paths and
	embedded builds. Inspect those writers before execution; a byte-matched
	isolated copy with actual dependencies preserves previous failures and dist
	without changing assertions. Retain input/output manifests and first-run logs.
- A clean tree, version number or passing log without complete input identity
	is not proof of reuse against today's candidate. Preserve the historical pass
	and state the uncovered inputs; do not erase it or invent provenance.
- A timeout reproduced in isolation is still not a diagnosed product defect.
	Retain diagnostic passes as diagnostics, keep the timeout, and measure the
	owning stages before changing code. For S4-INTEGRATION-001, queries were not
	dominant; repeated 696-row picker mounts were costly, but scheduling/GC and
	instrumentation overhead remain unresolved. No standby event is not proof
	of an otherwise idle host, and no speculative repair is accepted as GREEN.
- Existing DGM-113 paperwork and newer local package records can outlive a
	stale queue. Reconcile them instead of recreating the spec or claiming a
	local build is published/native-qualified. Independent documentation can
	finish while the source gate stays visibly blocked.

### Post-Repair Resolution

[Independent closeout](verification/sprint-4-review.md#s4-integration-001-independent-full-source-closeout):
5,488/5,488 tests pass after attempt 1 / cycle 1 / local typing fix 1.
The preceding unresolved findings describe the earlier diagnostic state.

- Bound the measured work, not the test's patience. Mounting 32 picker rows
	initially and expanding on scroll/keyboard demand retains all ranked choices
	without repeatedly constructing 696 rows. Keep the original timeout and
	add structural RED/GREEN coverage plus real browser keyboard/wheel checks.
- Focus can cause scrolling, which can mount another batch. A browser oracle
	must trap from the actual current final control, not assume the initial
	batch remains the end. Preserve the invalid-oracle failure and replace its
	assumption with full-list focus assertions, not a weaker product check.
- Focused Vitest PASS and editor diagnostics did not catch a test mock's
	return-type mismatch. Typecheck remains authoritative; correct the local
	annotation, preserve the failure and resume independent verification.

## 2026-10-15: Windows ARM64 Qualification

Evidence: [independent native report](verification/DGM-113-windows-arm64.md).

- Focus transitions are part of the workflow contract. Tab from the title into
	New diagram deliberately preserves a draft; a verifier must explicitly
	commit with Enter before asserting durable storage. Retain the failed
	persistence assertion and fix the harness under RED/GREEN, not the product's
	correct draft guard or the assertion's meaning.
- A harness-only repair does not require rebuilding an unchanged signed or
	unsigned payload. Reuse exact artifact/ASAR hashes in a fresh runner workspace
	and profile; preserve the failed candidate and downloads instead of replacing
	its output. Here, 10 groups / 3 sessions / 8 downloads passed after one repair.
- Distinguish portable launcher architecture from embedded runtime architecture:
	this x86 NSIS bootstrap carries ARM64 Electron, verified natively after launch.
	CDP offline and a local unsigned launch are bounded evidence, not physical
	disconnection or downloaded-file SmartScreen/policy acceptance.

## 2026-10-17: DGM-125 Fullscreen And Release Verification

Evidence: [final release closeout](verification/DGM-125.md#final-stable-publication---2026-10-17).

- Browser fullscreen acceptance does not prove packaged Electron permission
	behavior. Trace the actual trusted request before changing policy; keep a
	narrow registered-live-main-frame exception, deny automatic fullscreen and
	all unrelated permissions, and verify both actual target portables.
- Validate effective runtime paths, not just outer environment settings. The
	desktop driver deliberately sets TEMP/TMP to profileRoot. Separate nested
	reports from short fresh owned profiles; bound both extracted payload paths
	and Chromium IndexedDB paths before launch. Shortening only outer TEMP or
	guessing a helper's imported output root did not repair the real paths.
- Test actual controls and their owning handlers. Exit presentation leaves
	both Present and fullscreen; a nonexistent Exit fullscreen selector cannot
	establish a product defect. Preserve the failure, correct the adapter only,
	and retain exact restoration/history checks plus a separate idle-Escape case.
- Distinguish artifact hashes from historical filesystem metadata. Complete
	anonymous download hashes and old-release fingerprints passed while seven
	local text-file modification times drifted with unchanged bytes. Retain and
	disclose the failed metadata check; do not restore timestamps or claim an
	unqualified historical-preservation pass to close the release.

## 2026-10-19: DGM-126/127 Source UI Follow-Ups

Evidence: [About verification](verification/DGM-126.md) and
[startup/recovery verification](verification/DGM-127.md).

- Empty loading UI changes component lifecycle timing. Initial camera fitting
  must wait for the first real document, not consume its one-shot on a loading
  placeholder. Cover narrow recovered content before Fit and preserve a later
  user pan across informational dialogs and canceled New actions.
- A fixture helper must not hide a product regression. An explicit Fit made
  startup-dependent harnesses pass while recovered work was initially offscreen.
  Retain the browser failure, repair the lifecycle under RED/GREEN, and remove
  the helper's Fit before accepting recovery.
- Changing the default startup document also changes browser-test preconditions.
  Seed samples explicitly for sample-workflow checks; test fresh empty startup
  separately. Preserve unrelated baseline failures rather than claiming the
  full suite passed or repairing outside the approved task.

## 2026-10-19: DGM-128 Catalog Browser Harness

Evidence: [independent verification](verification/DGM-128.md).

- An edge can be obscured by a selected component's contextual toolbar even
  when its canonical route is valid. Restore the required selection state with
  a real hit-tested canvas click, then choose a supported label/stroke target
  and assert the exact selected edge. Never force the click or hide controls.
- A regression fixture must reproduce the previous selection state, not only
  its document geometry. Retain missing/offscreen-target rejection checks and
  preserve historical evidence through task-specific output directories.

## 2026-10-20: DGM-130 Release Provenance

Evidence: [0.3.0 verification](verification/DGM-130.md).

- Final provenance must reconcile inherited preliminary fields, not merely
  append a passing runtime object. Public verification caught contradictory
  acceptance/limits/finalization text even though every download hash matched.
  Preserve that failed content gate, correct and reseal the two metadata assets,
  and independently verify their fresh public bytes. Reuse complete EXE download
  proof only when exact asset identity, digest, size and retained bytes match.

## 2026-10-27: DGM-131 Live MCP Mutation Boundaries

Evidence: [independent source verification](verification/DGM-131.md).

- Reuse canonical session validation/history/autosave for remote editing; do not
  create a competing main-process document store. Validate a whole command batch
  before one history commit, and require a lifetime/generation token that changes
  across Undo/Redo as well as ordinary edits to reject ABA stale requests.
- Wall-clock expiry must be checked after blocking native confirmation and
  immediately before mutation, not only via asynchronous timers. The independent
  runtime held a confirmation for 5.5 seconds, then accepted it; the expired
  request correctly failed without changing live or recovered work.
- Retain complete owner handoff and source manifests on disk. A lost agent handle
  did not require rebuilding implementation or guessing status: the saved receipt
  routed final-source independent verification while preserving first failures.