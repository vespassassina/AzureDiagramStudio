# Sprint 4 Independent Review

Date: 2026-10-15. Role: independent VERIFIER, not implementer.
**Current: AUTOMATED COMPLETE, scoped source verification only.** The exactly-once
post-repair full source gate passed **5,488/5,488 tests, 36/36 files, zero failed
or skipped, exit 0**, UTC **2026-10-15T13:09:23.295Z to
2026-10-15T13:12:21.568Z**, Vitest **177.04s**, command elapsed **178.273s**.
S4-INTEGRATION-001 owner attempt **1**, repair cycle **1**, local typing fix **1**;
verifier source repairs **0**. Independent typecheck/build, Catalog **32/32**,
Editor **16/16 selected** and production picker browser **2/2 viewports** are
reused from this verified repaired candidate, not rerun for reassurance.
See the [independent closing report](#s4-integration-001-independent-full-source-closeout)
and its [machine-readable closeout](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/full-source-closeout-v02.json).
**Retained initial full gate: FAIL, 5,485 passed / 1 timeout, exit 1.** Original
failures and earlier recheck sections below remain chronological history, not the
current disposition. Original dist is unchanged; the repaired snapshot's fresh
build has a distinct verified identity. No new full DGM-110 browser or Sprint 3
performance PASS, native/platform qualification, packaging or release acceptance
is inferred. Parent must reconcile its queue, manual and DGM-113 introductions
before recording LOCAL COMPLETE; those documents were not edited here.

Authority: [current execution queue](../roadmap.md#execution-queue),
[repository workflow](../../.github/copilot-instructions.md),
[lessons](../lessons.md) and the four independent reports below. Only this
document and fresh evidence in
[20261015T091247723Z](../../app/test-results/sprint-4-verifier/integration/20261015T091247723Z)
and [20261015T092052957Z](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z)
were written. No original source/test/config/spec/manual/roadmap/old evidence/dist/release
edits, repairs, installs, packaging, native launches, network requests,
commits, profile access or power changes occurred. Port 5207 was not queried or
touched. Terminal work was serial. Already-authorized suite-owned ephemeral
browser contexts and the embedded build wrote only inside the snapshot.

## Final Source Gate

Command: `npm test -- --maxWorkers=1`, cwd
`C:/Projects/Diagrammer/app/test-results/sprint-4-verifier/integration/20261015T092052957Z/snapshot/app`.
The retained prepared snapshot was resumed, not prepared again. Wrapper:
`node C:/Projects/Diagrammer/app/test-results/sprint-4-verifier/integration/20261015T092052957Z/isolated-verifier.mjs run`,
requested synchronously with no timeout, **exactly once**. Source-gate scope only.

| Fresh first-run fact | Recorded value |
| --- | --- |
| UTC start / end | **2026-10-15T10:56:35.408Z / 2026-10-15T11:03:38.812Z** |
| Exit / signal | **1 / null** |
| Tests | **5,485 passed / 1 failed / 0 skipped / 5,486 total** |
| Files | **35 passed / 1 failed / 0 skipped / 36 total** |
| Vitest duration / command elapsed | **418.69s / 423.404s** |
| Invocations / repair count | **1 / 0**; no unchanged retry, code fix, skip or timeout change |
| Full log SHA256 | `7817143d365844e32de7d53d6d103c92d23361d2fcaf3d197d449454fb415cee` |

[Full log](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/full-source-validation.log),
[execution result](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/execution-result.json),
[failure extract](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/failure-extract.txt)
and [completion/preservation](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/results.txt)
retain the first run. The runner's literal verdict is `FAIL / INCONCLUSIVE`;
the complete totals establish a failed suite, not a missing completion record.

**Fresh failure S4-INTEGRATION-001:**
`src/editor/Editor.test.tsx > controlled editor > should_choose_addConnected_by_Enter_and_cancel_without_mutation_or_recent`.
Original location: [Editor.test.tsx](../../app/src/editor/Editor.test.tsx#L583).
Exact error: `Error: Test timed out in 5000ms.` The log records 5537ms for
this test. Its behavior is Escape cancellation without a command, followed by
APIM search and Enter emitting one `addConnected` command. No mismatched assertion
value or root cause was reported; no product-versus-environment diagnosis is
inferred. Do not increase the timeout or rerun unchanged for a favorable result.
Orchestrator must route the retained log and test contract to a scoped implementer;
repair count remains **0**. A concrete repair returns for independent recheck.

### Snapshot Identity And Preservation

[Prepared provenance](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/provenance.json)
and [snapshot validation](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/snapshot-validation.json)
record preparation on 2026-10-15, 09:22:47.718Z to 09:38:41.634Z, validated
09:38:42.488Z: **18,858/18,858** original/snapshot inputs match, zero symbolic
links. Dependencies were actually copied, not junctions: **16,315** files;
other executable inputs **2,543**, including **2,362** source files and **36**
existing dist files. HEAD `a523a7e4feca5148d1a1a28fc34e97d28c82d1d6`, package
0.2.0, Node v26.7.0, npm 11.19.0, Windows ARM64; these observations are not
native/runtime support qualification.

| Prepared input identity | SHA256 aggregate |
| --- | --- |
| All 18,858 inputs | `aa131abddea7bd957de9d194cbb952ef3ad5aeea1b0b5c0fcd4b34cd0da21f57` |
| 16,315 dependency files | `71aebaa327ba363d9926b2ffe56eb785b5ee3bbd2b32408271e504839a294e69` |
| 2,543 executable inputs | `59ee326bdd8a7a3054edaa989585cc94cf6af2974306ea841e4862df0ad47d42` |
| 2,362 source files | `9bfcd603fb51e2fdb1098497107b9118c447c0d6274dba06018daba956671a34` |
| 36 dist files | `dd7afe274459dbe147e80f2174a75cff57e3a9529364827e6a76dd10dcb2689f` |

[Preservation](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/preservation.json)
completed **2026-10-15T11:08:53.137Z**: original inputs **18,858/18,858**,
old evidence **7,169/7,169**, prior protected inputs **2,550/2,550**, and snapshot
inputs **18,858/18,858** match; all difference arrays empty, zero added original
evidence files, original dist untouched, HEAD unchanged. The preserved old-evidence
aggregate is `0fd0a0bdb41c84978ac27d8593b6de3980c87b6fe0614592b3e77c17e10990d1`.
The suite generated **79** output files inside the snapshot only; see the
[output manifest](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/generated-output-manifest.json).
This review's authorized factual reconciliation follows that preservation check;
the snapshot retains the pre-update review bytes. Post-review link/log validation
is documentation validation, not another executable source gate.

The sync tool moved the runner to background terminal
`fcd03fcc-79c9-4b8d-8f1b-9d9eeeab13ee`; its exact ID/log are retained in
[runner resume record](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/runner-resume.json).
No polling, sleep, cancellation or duplicate invocation was used.

## Original Blocked Inspection (Retained)

The following is the original 09:15Z inspection, not the current verdict.
Its write-scope blocker and next action were superseded by the authorized retained
snapshot above; its historical evidence and reuse limits remain intact.

Required command then: `npm test -- --maxWorkers=1`, cwd `C:/Projects/Diagrammer/app`.
Invocations in that inspection: **0**; exit code/totals: **not applicable**;
repair count: **0**. No new execution occurred during that inspection.

The cheapest discriminating check found two complete retained PASS logs, but
their current-input reuse cannot be proven. The newer log records package 0.2.0
and clean before/after porcelain, not its commit or input/build hashes. The
nearby package hash baseline covers 2,373 entries; 2,372 fall within the compared
input scope, 2,370 match, and package/lock hashes differ. It omits all 36 source
test files, scripts, dist, examples, the HTML entry and Vitest config. Neither
timestamps nor a clean tree at another time substitute for those missing hashes.

The fallback execution cannot respect the exclusive write boundary:

| Collected test | Fixed output outside the allowlist |
| --- | --- |
| [Export browser test](../../app/src/editor/export.browser.test.ts#L8) | `app/test-results/sprint-3-owner/105`: overwrites screenshots, downloads and reports. |
| [Direct-edit browser test](../../app/src/editor/direct-edit.browser.test.ts#L9) | `app/test-results/sprint-3-owner/108`: overwrites screenshots/reports; [its build call](../../app/src/editor/direct-edit.browser.test.ts#L82) also writes `production` there. |
| [Grid browser test](../../app/src/editor/grid.browser.test.ts#L8) | `app/test-results/sprint-3-owner/115`: overwrites screenshots, SVGs and reports, including failure artifacts. |

[Vitest config](../../app/vitest.config.ts) collects all three through
`src/**/*.test.{ts,tsx}`. Their output constants have no environment redirect.
The verifier did not exclude tests, patch writers, replace evidence directories,
change permissions or launch the unsafe command. This is an execution-scope
blocker, not a newly diagnosed product defect.

**Exact next action, parent-owned:** authorize a write-safe full-suite execution
arrangement, or dispatch an owner to add artifact-output redirection without
changing assertions. Then an independent verifier runs the exact command once,
retaining start/end, exit, totals and full source/config/lock/asset/dist hashes in
a fresh integration directory. Any assertion failure returns to the scoped
implementer; this verifier's repair count remains 0. Parent owns queue updates,
manual reconciliation, DGM-113 readiness documentation and consolidated delivery.

## Original Inspection Identity And Reuse Proof

Fresh read-only provenance capture: **2026-10-15T09:15:54.166Z to
09:15:56.964Z**. HEAD: `a523a7e4feca5148d1a1a28fc34e97d28c82d1d6`;
branch: `feat/DGM-070-desktop-release`; initial tracked worktree clean;
package: **0.2.0**; Node **v26.7.0**, `win32`/`arm64`.
These are observations, not a supported OS/runtime minimum.

Machine-readable [provenance](../../app/test-results/sprint-4-verifier/integration/20261015T091247723Z/provenance.json),
[protected input hashes](../../app/test-results/sprint-4-verifier/integration/20261015T091247723Z/protected-inputs.json)
and [reuse/blocker decision](../../app/test-results/sprint-4-verifier/integration/20261015T091247723Z/reuse-decision.json)
retain 2,550 protected files, per-file SHA256, source/dist aggregates, retained-log
hashes and missing-baseline coverage. Fresh work here is inspection/provenance and
document validation only, not a test/build/browser/generator/performance rerun.

| Retained baseline | Fresh byte comparison | Permitted conclusion |
| --- | --- | --- |
| [DGM-110 provenance](../../app/test-results/sprint-4-verifier/110/20261014T165335439Z/00-provenance.log) | **2,402/2,402 match**, zero changed/missing: 2,337 source/asset files, 29 public files, 36 dist files. | Reuse its recorded source implementation/dist/browser scope. This baseline excludes source tests, scripts and gate config/lock; it is not full-suite identity proof. |
| [DGM-116 provenance](../../app/test-results/sprint-4-verifier/116/20261014T170000827Z/provenance.txt) | **36/36 match**, zero changed/missing: 16 public, 16 dist, 4 scripts. | Reuse the dated asset/generator result for recorded bytes and scripts; no new raster render, aesthetic assessment or packaged GUI result. |
| [Local package hashes](../../app/test-results/sprint-4-release/local-desktop/20261014T185451026Z/source-package-hashes.json) | **2,370/2,372 compared input entries match**; package/lock changed and executable gate inputs are uncovered. | Cannot prove current full-source-gate reuse. Packaging record is observed locally only. |

Current dist bytes match the recorded DGM-110 dist baseline. This verifier did not
build dist or attest an unrecorded build-to-current-test/config dependency chain.

| Dist identity | SHA256 |
| --- | --- |
| `index-RZcTxx25.js` | `e0b0b28960678117f80fc152b35c3066eb46b535440d61da34ec63b7688fce44` |
| `index-BQ1QDiF7.css` | `140652f64c82da80b760a86d5a6a0fc5fc620c9404b423f5c6f53c5b6cbeecd2` |
| `elk-worker.min-r_yRvuMO.js` | `e4f5c51c6f2fd564bb64e52e81c4a85a316ef2f24f8b90e1db5eb886c765b030` |
| Source aggregate, all protected `app/src` files | `421d18188ce8c9cb3472e1a71beae528f1dccce1a08a52c467aa7c66a3d8e41a` |
| Dist aggregate | `c137ae195df9cad61a20e3db38b4fda77eedca0dd2596a9d96117629ed5a1b7e` |

## Retained Gates And Scoped Outcome

All rows below are **REUSED/OBSERVED OLDER RESULTS**, not fresh scoped executions
in this review. The full source suite above does not broaden these scoped gates.
Scoped independent reports remain the acceptance-detail authority.

| Task/gate | Recorded result, command and UTC window | Boundary |
| --- | --- | --- |
| [DGM-109](DGM-109.md) | 356/356 tests, 4 files; scoped Vitest. Source 2026-10-12 10:03:39.9396040Z to 10:05:01.0533559Z. `npm run typecheck`, `npm run build`, `npm run test:browser` each exit 0; [timing record](../../app/test-results/sprint-4-verifier/109/20261012T100339905Z/results.txt) ends 10:06:39.0008143Z. | Bounded starters/Blank/chooser cancel, fresh IDs, draft preservation, validation and stale/readonly guards. Later DGM-110 browser log repeats the chooser scenarios; old 356 count is not a current full-source count. |
| [DGM-111](DGM-111.md) | `npx vitest run --maxWorkers=1 src/editor/Editor.test.tsx src/app/session.test.ts src/app/App.test.tsx`: 278/278, 3 files, 54.46s; 2026-10-12 08:01:51.4531394Z to 08:02:47.5701760Z. Typecheck exit 0, 08:02:59.8112168Z to 08:03:07.8805071Z. Browser exit 0, 30 status scenarios plus 3 foundation viewports, 08:03:18.6829264Z to 08:04:19.5030893Z. | Local autosave and JSON marker independence, local failure, readonly export and callback/stale guards. Native cancellation/completion remains deferred. Later DGM-110 log records the 30 status scenarios again. |
| [DGM-110](DGM-110.md) | `./node_modules/.bin/vitest.cmd run --maxWorkers=1 src/editor/interactions.test.ts src/editor/Editor.test.tsx src/document/commands.test.ts src/app/session.test.ts`: 458/458, 4 files, 140.07s; 2026-10-14 16:54:23.2418519Z to 16:56:46.4120097Z. Typecheck exit 0, 16:56:46.4132146Z to 16:56:58.2839558Z; build exit 0, 16:56:58.3022632Z to 16:57:15.0388272Z; browser exit 0, 16:57:15.0437933Z to 16:58:55.5661363Z. [Results](../../app/test-results/sprint-4-verifier/110/20261014T165335439Z/results.txt). | Same-parent alignment/distribution, detached rejection, root/subtree policy, guard tests and bounded production menu/focus/undo/redo. Scoped implementation/dist hashes match; full test/config identity does not follow. |
| [DGM-116](DGM-116.md) | `node --test --test-concurrency=1 --test-reporter=tap scripts/generate-brand.test.mjs`: 3/3, zero failures, 5820.4457ms, exit 0; 2026-10-14 17:00:00.8298595Z to 17:00:07.9287136Z. [TAP](../../app/test-results/sprint-4-verifier/116/20261014T170000827Z/generate-brand.test.tap). | Original connected-node mark; recorded deterministic generation/raster/header checks. Current logo is 856 bytes, badge `rx=16`, SHA256 `84c8f212d1ade169af7498669a3a24884d65c4a2c14131741215772680bac710`. Older radius/raster counts are not current renders. |
| [DGM-112 findings](../specs/DGM-112.md) | Desk investigation completed 2026-10-11; no executable gate or platform qualification. | Retain native/emulated/workflow/source boundaries, per-target prerequisites and unknown costs/owners. Its package-version observations are dated snapshots, not today's package metadata. |

[DGM-110 browser log](../../app/test-results/sprint-4-verifier/110/20261014T165335439Z/04-test-browser.log)
records Edge 155.0.4283.45, DGM-109 chooser paths, 30 DGM-111 status scenarios,
DGM-110 scenario completion and three foundation viewports. It does not give an
aggregate DGM-110 scenario count; none is invented. Its scenario temporarily
disables the selection-toolbar pointer target to select the second node: **not
unaided toolbar reachability**. Nested containment is deterministic-helper
coverage. Route-cache internals, camera/tool identity and all save/cache rejection
details are not newly instrumented DGM-110-only browser assertions. Disabled
reasons/tooltips and native 200% zoom are not passed by this record.

[Sprint 3 review](sprint-3-review.md) retains 5,431 source tests/36 files, 20
generator tests, 51/51 browser cases and original 100-entity/150-edge performance:
edit p95 **51.69999998807907ms**, maximum layout **734.1999999880791ms**,
2026-10-11 11:43:48.9929390Z to 11:57:31.8207260Z. These are historical regression
measurements, not a current performance PASS: Sprint 4 source/bundle changed and
full unchanged-input reuse is not established. No additional standalone full
browser, generator, build or performance gate was run for reassurance; only the
browser contexts and embedded build already collected by the snapshot source
suite ran. Existing build chunk-size and
ineffective dynamic ELK-import warnings are not repaired or suppressed here.

## Preserved Integration History

Every full-source row used `npm test -- --maxWorkers=1`; historical rows ran from
original app, while the fresh row ran from the hash-identical snapshot/app.

| UTC start/end | Recorded totals and disposition | Retained evidence |
| --- | --- | --- |
| 2026-10-14 17:01:10.0642766Z / 17:05:47.7359405Z | **FAIL**, exit 1: 3 failed/33 passed files; 3 failed/5,483 passed tests, 5,486 total; 274.10s. | [Original log](../../app/test-results/sprint-4-verifier/integration/20261014T170110062Z/full-vitest.log), [completion](../../app/test-results/sprint-4-verifier/integration/20261014T170110062Z/results.txt), [extract](../../app/test-results/sprint-4-verifier/integration/20261014T170110062Z/failure-extract.txt). |
| 2026-10-14 18:51:05.7474923Z / 18:54:22.5354229Z | **Historical PASS**, exit 0: 36/36 files, 5,486/5,486 tests, 195.01s. Raw log has complete totals; completion record totals fields are blank. Recorded HEAD `d5ac8f8ff400471a0ec1ea377ebb04b90fcaf15f` and dirty candidate are not today's identity. | [Raw log](../../app/test-results/sprint-4-verifier/integration/20261014T185105747Z/full-source-validation.log), [record](../../app/test-results/sprint-4-verifier/integration/20261014T185105747Z/results.txt). |
| 2026-10-14 21:34:53.2621076Z / 21:38:26.6151450Z | **Observed local historical PASS**, exit 0: 36/36 files, 5,486/5,486 tests, 212.15s. Package 0.2.0 and clean before/after porcelain; no recorded commit/hash baseline. | [Local release-folder source log](../../app/test-results/release-v0.2.0/20261014T213453260Z/full-vitest.log). No remote/release verification inferred. |
| 2026-10-15 10:56:35.408Z / 11:03:38.812Z | **Fresh snapshot FAIL**, exit 1: 1 failed/35 passed files; 1 failed/5,485 passed tests, 5,486 total; no skips; 418.69s. S4-INTEGRATION-001 timeout, repair count 0. | [Full log](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/full-source-validation.log), [result](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/execution-result.json), [failure](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/failure-extract.txt). |

The first failed log records the brand description regex
`/<desc[^>]*>Original.*three.*tiles/i`, the clipboard wait for `Image copied.`
timing out after 30,000ms, and failed dynamic import of `/src/editor/Editor.tsx`
in the grid test. Later passing logs do not erase these failures or prove an
unrecorded RED/GREEN repair history. No repairs or retries were made here.
DGM-109's first browser attempt without a completion marker and DGM-111's
standby-interrupted/timeout/precheck evidence remain retained under their reports;
none is relabelled PASS. DGM-110/116 report no open scoped defect, repair count 0.

## Manual Drift And Package Boundary

[Manual](../manual.md) was inspected, not edited; it is outside this allowlist.
Concrete parent-owned reconciliation:

| Manual location | Observed drift / required factual correction |
| --- | --- |
| Start With an Example | Says New diagram creates a blank document. DGM-109 now opens a chooser with explicit Blank and bundled starters; Open JSON remains a separate path. |
| Save, Open and Import | Uses `Saved` / `JSON backup needed`. DGM-111 records `Saved on this device` / `Editable JSON copy needed` and `No newer JSON changes`; include independent local failure and readonly status, without promising durable OS-file acknowledgement. |
| Group, Move and Arrange | Omits DGM-110 same-parent alignment/distribution actions and their eligibility/no-op/rejection limits. These are local moves, not Auto-arrange. |
| Introduction / Limits and Notices | Describes only Sprint 3 source and an unbuilt candidate. Scoped Sprint 4 work and newer local packaging records exist. Update the dated source description separately from any approved/published artifact claim. |

[Local Windows packaging record](../../app/test-results/sprint-4-release/local-desktop/20261014T185451026Z/results.txt)
observes a 2026-10-14 local v0.1.0 ARM64 portable build/copy, 403,327,713 bytes,
SHA256 `9be9b083db68acd3ce93e8cda079be5909356fb0b01506617db8c15cbb117f68`,
explicitly **RUNTIME SMOKE TEST: NOT RUN**. Today's package metadata is 0.2.0;
that earlier filename/hash is not proof of today's package/runtime. These records
were read only; no executable, user-profile destination or published asset was
opened, hashed afresh, installed, launched or remotely verified. Historical
v0.1.0 release evidence remains historical; publication/support acceptance is
not part of this review.

## Open Acceptance And Handoff

- Final snapshot source gate: **FAIL**, local integration **BLOCKED** on
  S4-INTEGRATION-001. The write-safe execution arrangement is established; parent
  routes the precise failure to a scoped implementer, preserving this first run.
  No verifier repair, unchanged retry, test skip or timeout relaxation is allowed.
- Teams second-recipient readability and presenter return, native Teams/Office
  paste/insertion, uncoached novice AC-13/M2 and starter/JSON transfer trials:
  **UNVERIFIED**, requiring participants and actual environments.
- Native file-dialog cancellation and durable save completion: **DEFERRED**;
  callback resolution is not OS acknowledgement. Native fullscreen Escape and
  managed-machine policies remain human/native checks.
- Physical 200% browser zoom, touch/tablet and unaided contextual-control
  reachability/tooltips: **UNVERIFIED**. Viewport/DPR/hasTouch simulations do not
  qualify physical behavior.
- Current native Windows ARM64/x64 and macOS artifacts/runtime, Mac shortcuts/IME,
  normal SmartScreen/Gatekeeper/signing policy and physically disconnected cold
  launch: **NOT QUALIFIED HERE**. Historical ARM64 native and x64-on-ARM64 emulation
  evidence do not fill native x64/Mac cells; Edge does not substitute for Chrome.
- Support matrix, devices/owners, OS/browser minima, signing and release decisions
  remain parent/PO-owned prerequisites. DGM-113 readiness documentation can proceed
  independently; no platform support or release acceptance is granted.

**Status:** blocked for local integration by the observed source-gate failure;
the single verifier run and preservation checks are complete.
**Changes/Docs updated:** this review and fresh allowlisted evidence only.
**Evidence:** 5,485 passed/1 failed of 5,486 tests, exit 1, 418.69s; 18,858
inputs and 7,169 old evidence files unchanged at gate completion; dated DGM-110/116
scoped gates reused with their original boundaries. **Repair count:** 0.
**Next:** parent dispatches S4-INTEGRATION-001, retains this log as the failing
candidate, owns manual/roadmap/DGM-113 documentation and local queue closure,
and continues independent readiness work without marking integration, missing
manual/native evidence or the parent queue PASS/complete.

## S4-INTEGRATION-001 Owner Diagnosis And Repair Attempt Record

2026-10-15, scoped IMPLEMENTER only. The independent verdict and evidence above
are unchanged. **Status: BLOCKED, no justified repair; persisted repair count 0.**
No production/test edit, timeout change, assertion weakening or full-gate rerun
occurred. No repaired GREEN or independent recheck is claimed.

Owner evidence: [diagnosis](../../app/test-results/sprint-4-owner/integration/20261015T111408513Z/diagnosis.json),
[runner](../../app/test-results/sprint-4-owner/integration/20261015T111408513Z/focused-runner.mjs)
and [power observation](../../app/test-results/sprint-4-owner/integration/20261015T111408513Z/power-events.json).
Before any test, System Kernel-Power 506/507 was queried for the original gate
plus/minus 15 minutes (10:41:35.408Z to 11:18:38.812Z): no matching events.
There is no confirmed Modern Standby; other interruptions/contention are not excluded.

The local hypothesis was that the two dialog-scoped search-field label lookups
dominate the frozen test. Nearby owning paths inspected were
[ComponentPicker](../../app/src/editor/CatalogAccordion.tsx#L71) and
[chooseConnectedComponent](../../app/src/editor/EditorSurface.tsx#L614).
Their existing Escape/cancel and guarded command paths exposed no behavioral
defect. Direct query timing **rejects the hypothesis**: all eight queries total
364.15ms of a 1660.73ms test (21.93%); the two Search components label queries
total 90.26ms (5.43%). Whole-document dialog role queries total 206.20ms (12.42%).
These calls do not dominate execution; speculative query/production repairs
would not establish the timeout's cause.

All focused runs used the prepared snapshot/app and selected only the named
existing failing test (`--maxWorkers=1`, unchanged 5000ms limit). Each retained
command, start/end, exit, complete log, JSON totals and nearby before/after input
hashes from its first invocation. 241 nonselected tests are explicitly filtered
out, not source skips or acceptance passes.

| UTC start/end | Selected result | Evidence |
| --- | --- | --- |
| 11:15:55.837Z / 11:17:22.882Z | RED: 0 passed / 1 failed, exit 1; unchanged timeout at 11496.18ms. CPU flags emitted no profile. | [diagnostic record](../../app/test-results/sprint-4-owner/integration/20261015T111408513Z/diagnose/execution.json) |
| 11:19:07.618Z / 11:19:14.947Z | Unchanged diagnostic PASS: 1/1, exit 0, 2359.67ms; not repaired GREEN. Worker preload active, but teardown retained no CPU profile. | [profiling record](../../app/test-results/sprint-4-owner/integration/20261015T111408513Z/profile/execution.json) |
| 11:20:37.522Z / 11:20:44.877Z | Unchanged diagnostic PASS: 1/1, exit 0, 1660.73ms; direct query timing retained immediately, not repaired GREEN. | [trace record](../../app/test-results/sprint-4-owner/integration/20261015T111408513Z/trace/execution.json), [query timings](../../app/test-results/sprint-4-owner/integration/20261015T111408513Z/trace/queries.jsonl) |

**Blocker/prerequisite:** the timeout reproduces but remains unattributed.
Runtime variation alone does not prove a code/test inefficiency. A new bounded
diagnostic dispatch needs stage-level setup/event/render timings under controlled
execution conditions or concrete interruption evidence; no unchanged full gate
or speculative memoization is justified. This record does not consume a repair
attempt or reset a count. Parent owns the queue and any further diagnostic dispatch.

**Exact next independent action:** inspect the retained diagnosis and trace,
not rerun an unrepaired gate. Evidence-review command:
`Get-Content -Raw 'C:\Projects\Diagrammer\app\test-results\sprint-4-owner\integration\20261015T111408513Z\diagnosis.json'`.
There is no repaired independent test command yet. Focused identity checks cover
package/lock, Vite/Vitest config and the three nearby source/test files; full
source/dependency provenance remains the existing verifier snapshot record.
The [handoff check](../../app/test-results/sprint-4-owner/integration/20261015T111408513Z/handoff-validation.json)
checks append-only review preservation, old failure hashes and unchanged focused
inputs. It is documentation/evidence validation, not integration verification.

### Bounded Stage Diagnosis Continuation, 2026-10-15

Scoped IMPLEMENTER continuation S4-INTEGRATION-001. **Status: BLOCKED; persisted
repair count 0.** The independent FAIL above is unchanged. Exactly one
snapshot-instrumented named test ran; no original source/test repair, repaired
GREEN, affected-slice rerun or full gate occurred. The original default 5000ms
limit, all six event calls, setup and all three assertions are retained;
TypeScript AST call comparison passed. No assertion mismatch was reported.

Fresh owner evidence: [diagnosis and stage breakdown](../../app/test-results/sprint-4-owner/integration/20261015T112855710Z/diagnosis.json),
[immediate stage JSONL](../../app/test-results/sprint-4-owner/integration/20261015T112855710Z/stage/stages.jsonl),
[execution identity/totals](../../app/test-results/sprint-4-owner/integration/20261015T112855710Z/stage/execution.json),
[complete diagnostic log](../../app/test-results/sprint-4-owner/integration/20261015T112855710Z/stage/vitest.log)
and [one-shot runner](../../app/test-results/sprint-4-owner/integration/20261015T112855710Z/stage-runner.mjs).
Command: `node C:/Projects/Diagrammer/app/test-results/sprint-4-owner/integration/20261015T112855710Z/stage-runner.mjs`.
This launched only the frozen named case with `--maxWorkers=1` in the existing
prepared snapshot/app. Start/end **11:30:27.175Z / 11:31:46.994Z**; exit **1**;
**0 selected passed / 1 failed**, 241 nonselected tests filtered. The selected
test timed out at **7158.4671ms** with `Test timed out in 5000ms.` Twenty-four
stage records were written synchronously before/after the work, not deferred to
worker teardown. Log SHA256:
`68dfea027022256b35778b0ed55211df86f183a6d6b4de2443be171313c23785`.

| Stage (original synchronous query arguments included) | Wall ms | Worker CPU ms | DOM elements after |
| --- | --- | --- | --- |
| Sample document and initial Editor render | 652.2930 | 438 | 704 |
| Select app | 255.7565 | 249 | 1,525 |
| Open unfiltered picker | 1,771.9010 | 1,109 | 8,542 |
| Escape/cancel picker | 831.9182 | 531 | 1,525 |
| Reopen unfiltered picker | 1,900.9529 | 937 | 8,542 |
| Resolve reopened search field | 304.3729 | 187 | 8,542 |
| Filter APIM | 83.1174 | 30 | 1,549 |
| Enter choice | 65.6847 | 47 | 1,525 |
| Three assertions combined | 28.9168 | 32 | 1,525 |

**Hypothesis supported for dominant measured work:** the two unfiltered mounts
total **3672.8539ms**, **62.31%** of measured stages (5894.9134ms). Each adds
**696 picker rows / 7017 DOM elements**, removed again on cancel/choice. Initial
setup is not the dominant stage; filtering and Enter are small. One nearest
owning read of [ComponentPicker](../../app/src/editor/CatalogAccordion.tsx#L71)
shows eager `rankedSearch(query)` rows mapped to CatalogRow on each mount. The
inspected shared test setup renders the actual Editor/catalog; no existing
bounded fixture in that local path eliminates those mounts while preserving
the original exercised scope. A reduced/mocked catalog would not be a repair.

**Causality limits:** the instrumented interval is 7107.6077ms, including
**1212.6943ms** of unassigned probe/interstage work (DOM scans, serialization,
synchronous writes and any scheduling). Worker PID 30852 used **4281ms CPU**
over that interval; RSS rose **248.78 to 401.78 MiB**. Event-loop utilization was
1, but the synchronous body allowed **zero heartbeat callbacks / zero delay
histogram samples**: those samples are unavailable, not proof of no lag or of
exclusive CPU work. Scheduling/GC attribution is not available. This supports
mount dominance, not a sole explanation of the original cold timeout. The
diagnostic timeout is not an uninstrumented final source gate.

**Exact modified snapshot input, retained and isolated:**
`app/test-results/sprint-4-verifier/integration/20261015T092052957Z/snapshot/app/src/editor/Editor.test.tsx`,
SHA256 `0b5c0aa2d7249b8b2cefc6afd362e9312bf2f36d91c9f6671e9dd266bea5a7dd`.
[Exact instrumented input archive](../../app/test-results/sprint-4-owner/integration/20261015T112855710Z/instrumented-Editor.test.tsx)
preserves those bytes. The snapshot now contains diagnostic instrumentation;
do not treat it as the original hash-identical uninstrumented gate input. The
original test remains SHA256
`8b3619a692c6a86ec5c4f78b250183881b62329d7a3312c94a24ced7760a9220`.
[Current baseline](../../app/test-results/sprint-4-owner/integration/20261015T112855710Z/baseline.json)
and execution record compare **2442/2442** current original source/asset/script/
config inputs unchanged, plus the retained full-gate log, failure extract and
prior owner diagnosis. Legitimate parent manual/DGM-113 edits are outside this
baseline and were not challenged. No dependencies, configuration, release,
native platform, power or port 5207 changes occurred.

**Precise remaining prerequisite, parent/PO-owned:** authorize a bounded
picker-render performance task with a first-open budget and explicit full-catalog
keyboard navigation, modal focus restoration and query-reset acceptance before
implementing/regressing lazy or virtualized mounting. No minimal existing
frozen-contract repair was established in this dispatch. An alternative is a
representative idle native Windows ARM64 host providing process scheduling/GC
evidence to establish environmental causality without weakening this test.
Neither is an instruction to rerun the unchanged full gate. Stop this diagnostic
dispatch here; no second stage run or speculative optimization is justified.

**Next independent action:** review the stage JSONL, frozen-call comparison and
input preservation in the fresh diagnosis; there is no repaired source to
recheck. [Handoff validation](../../app/test-results/sprint-4-owner/integration/20261015T112855710Z/handoff-validation.json)
checks the exact pre-append review prefix and evidence links, not integration
PASS. Parent retains the failed candidate and owns the bounded performance or
environment routing decision. Repair count remains **0**, not reset.

## 2026-10-15: Independent Documentation Closeout

Role: independent documentation VERIFIER, not implementer. **Document checks:
PASS. Source integration: FAIL / BLOCKED on S4-INTEGRATION-001.** The local
documentation task is complete; the local queue remains BLOCKED. This is not
platform qualification, current performance acceptance or release approval.

The parent has completed the factual [manual](../manual.md),
[DGM-113 readiness packet](../specs/DGM-113.md),
[queue/disposition](../roadmap.md#2026-10-15-consolidated-disposition) and
[dated lessons](../lessons.md#2026-10-15-sprint-4-integration-evidence-and-timeout-diagnosis).
Those four authorized document changes intentionally differ from the original
inspection manifest. Earlier manual-drift and parent-next-action paragraphs
above describe their recorded time, not unfinished documentation work now.

Fresh evidence: [document-validation JSON](../../app/test-results/sprint-4-verifier/integration/20261015T114002668Z/document-validation.json)
and [document-validation log](../../app/test-results/sprint-4-verifier/integration/20261015T114002668Z/document-validation.log).
The focused pre-append check passed **50/50** checks: **147** local links,
**24** anchors (including **8** source-line anchors), **15** exact source UI
labels, **7** script declarations and **14/14** retained key hashes. The final
evidence also records the immediate post-append link/fact and prefix checks.
Static source inspection confirms chooser draft/identity guards, independent
local-save/JSON markers, and alignment/distribution eligibility and move limits.
Runner declarations match the packet: production browser output redirection,
fixed Windows output/Git identity, and Mac ZIP/tools/temporary-profile cleanup.
No runner was executed. The packet has **9 distinct desktop/browser targets**
and **2 manual overlays**; all 11 rows remain **BLOCKED / NOT RUN** while
readiness documentation is **COMPLETE**.

Original-file preservation against the 09:12 inspection manifest: **2,546/2,546**
non-exempt protected files match, including **2,479/2,479** app inputs:
**2,373** source, **29** public, **25** scripts, **7** Electron, **9** package/
config/entry files and **36/36** dist files; another **67** protected files match.
Only the four explicit parent document changes are excluded, not relabelled
baseline matches. Manual/readiness/lessons retain CRLF; roadmap retains LF.
CRLF-aware `git diff --check` passed. The tracked stat has only the expected
four parent documents; this review remains the new, untracked review file.
The 14 GB historical evidence tree was not rescanned/rehashed; the key retained
logs and input archive were checked individually. The original review prefix
is preserved byte-for-byte. No source, tests, dependencies, configuration, old
evidence, snapshot, dist, packaging, profile, native or publication edits/runs
were performed by this documentation verifier.

The [first full-gate record](../../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/execution-result.json)
still records **one unfiltered run**, **5,485 passed / 1 timeout / 0 skipped**,
**35 passed / 1 failed files**, **exit 1**, **418.69s**, UTC
**2026-10-15T10:56:35.408Z to 2026-10-15T11:03:38.812Z**. Repair count is **0**.
The [owner stage diagnosis](../../app/test-results/sprint-4-owner/integration/20261015T112855710Z/diagnosis.json)
records the two 696-row opens at **1771.9010ms / 1900.9529ms**, **62.31%** of
measured stages, and an instrumented **7158.4671ms** timeout with **1212.6943ms**
unassigned probe/interstage overhead. Scheduling/GC causality remains unresolved;
diagnostic passes are not repaired GREEN. The snapshot's instrumented test is
not current original source or a clean final-gate input. Historical preservation
and performance records remain dated observations, not fresh acceptance.

**Exact next owner action:** evaluate the retained 696-row picker-open/render
cost through a bounded internal performance design preserving full-catalog
keyboard navigation, modal focus restoration and query reset; establish the
task/budget authorization before implementation. Alternatively establish
environmental scheduling/GC causality with representative host evidence. No
unchanged full-suite retry, timeout inflation, reduced catalog or acceptance
change. A justified TDD repair returns to an independent affected recheck.

**Combined external PO inputs, unchanged from the queue:** adopt/narrow the
platform/browser/OS minima and delivery requirements; assign native ARM64/x64/
Mac devices, qualification owners, policies and Teams/Office/novice participants;
approve a specific current candidate and bounded packaging/runtime actions;
decide whether signing/notarization is required and funded. These inputs do not
turn documentation delivery into runtime/support/release acceptance or prevent
an otherwise justified in-contract source repair.

**Status:** docs PASS; documentation closeout done; local queue BLOCKED.
**Discrepancies:** none in the checked documentation, source declarations and
retained facts. The source timeout and external qualification blockers remain.

## S4-INTEGRATION-001 OWNER Attempt 1: Bounded Picker Repair

2026-10-15, role IMPLEMENTER. Parent-authorized frozen DGM-107/106 in-contract
performance repair. **Status: OWNER GREEN; independent recheck pending. Repair
count: 1 (previously 0); local repair retries: 0.** This append does not change
the independent full-source FAIL, historical failures or platform/manual gates.
No full suite, build, browser, package, native or external operation ran here.

Only [CatalogAccordion.tsx](../../app/src/editor/CatalogAccordion.tsx) and its
[existing tests](../../app/src/editor/CatalogAccordion.test.tsx) changed.
ComponentPicker initially mounts at most 32 rows from the unchanged full
rankedSearch result. Near-end scrolling exposes the next ordered prefix;
Arrow navigation indexes the full list, extends that prefix when necessary,
then focuses and scrolls the requested row after commit. ArrowUp wrapping can
still mount the full catalog once. Search changes reset the bound, scroll and
pending focus; cancellation unmounts normally and restores the opener. Normal
CatalogAccordion and its navigateResults helper are unchanged. No CSS, ARIA
role, dependency, configuration, public contract or acceptance change occurred.

Two new deterministic regressions use the real ranked catalog and production
picker, not a reduced inventory or mocked picker. They cover initial bounded
rows and exact ordering, one-batch keyboard crossing, input/first-row ArrowUp
wrap and last-row ArrowDown wrap, tail search/Enter, incremental pointer-scroll
availability, APIM/query reset, IME guards and cancel/reopen focus. Existing
callback, readonly, modal focus, favorites, recents and cancellation assertions
are retained. No wall-clock threshold was added or timeout changed.

Fresh evidence directory:
[20261015T120219566Z](../../app/test-results/sprint-4-owner/integration/20261015T120219566Z).
Each first invocation retains full log, JSON reporter, exact command, UTC
start/end, exit, selected test durations and source/config SHA256 manifest.
All commands ran synchronously from original app, with --maxWorkers=1.

| Gate / selector | UTC start/end | Selected result / Vitest duration |
| --- | --- | --- |
| RED, should_bound_picker_mounts\|should_expose_picker_rows | 12:02:20.906Z / 12:02:51.416Z | 0 passed / 2 failed, exit 1; 27.99s. Both fail specifically because 696 mounted rows exceed 32. |
| GREEN, identical selector and assertions | 12:04:08.675Z / 12:04:12.365Z | 2/2 passed, exit 0; 2.80s; cases 577.46ms / 212.03ms. |
| Frozen original Editor Escape/reopen/APIM/Enter case | 12:04:29.132Z / 12:04:38.120Z | 1/1 passed, exit 0; case 612.69ms at unchanged default 5000ms, suite 8.28s. |
| All CatalogAccordion tests, no selector | 12:05:09.110Z / 12:05:14.213Z | 32/32 passed, exit 0; 4.49s. |
| Editor addConnected\|connected_picker\|connected_arrows | 12:05:54.838Z / 12:06:06.782Z | 16/16 passed, exit 0; 11.18s. Original case in this slice: 532.63ms. |

Focused selections exclude 30, 30, 241 and 226 nonselected cases respectively;
these are filtered scopes, not acceptance passes or source skips. The complete
accordion run excludes none. The connected slice covers all four directions,
stale selection/document/revision/readonly/Present invalidation, limit rejection,
callback failure, annotation exclusion and contextual-arrow guards.

[Owner disposition](../../app/test-results/sprint-4-owner/integration/20261015T120219566Z/owner-disposition.json)
records 2380 source/config inputs with no post-GREEN drift. RED-to-GREEN changes
only production CatalogAccordion.tsx; the tests were already present at RED.
Original Editor.test.tsx remains SHA256
8b3619a692c6a86ec5c4f78b250183881b62329d7a3312c94a24ced7760a9220.
The retained full-suite and stage-timeout logs match their prior hashes. Both
edited source files preserve CRLF. Focused VS Code diagnostics report no errors;
typecheck was not run. Dependency-tree/build/browser/native qualification is
outside this bounded owner check, not implied by its input manifest or timings.

**Exact next independent action:** on this candidate in original app, run
node node_modules/vitest/vitest.mjs run --maxWorkers=1 src/editor/Editor.test.tsx
-t "addConnected|connected_picker|connected_arrows", then independently run all
CatalogAccordion tests with the same runner and no selector. Retain fresh logs,
timings and candidate hashes. Parent owns queue updates and the subsequent
write-safe final source gate; do not reuse the diagnostic-instrumented snapshot
as a clean candidate. No full integration, platform or release PASS is claimed.

## S4-INTEGRATION-001 Independent Repair 1 Recheck

2026-10-15, independent VERIFIER. **Focused tests PASS; typecheck/build FAIL;
production browser BLOCKED / NOT RUN; final integration pending.** This is the
first independent recheck of owner attempt 1, persisted repair count **1**, owner
local retries **0**, verifier source repairs **0**. No source fix, test/timeout
change, assertion weakening, dependency install or full-suite invocation occurred.
The historical full FAIL and timeout diagnoses above remain unchanged.

Evidence: [independent disposition](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/repair1-disposition.json),
[focused disposition](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/focused-disposition.json),
[source/fact validation](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/source-and-fact-validation.json)
and [handoff validation](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/handoff-validation.json).
All four first invocations were synchronous, serial, without a timeout override;
each retains command/arguments, cwd, UTC start/end, exit and SHA256 of its full log.

| Independent gate | UTC start / end | Actual result |
| --- | --- | --- |
| All CatalogAccordion tests | 12:12:19.203Z / 12:13:40.586Z | 32/32 PASS, 1 file, exit 0, Vitest 75.25s; no filtered cases. |
| Editor addConnected\|connected_picker\|connected_arrows | 12:13:40.603Z / 12:14:19.709Z | 16/16 selected PASS, 1 file, exit 0, Vitest 38.13s; 226 nonselected cases reported as skipped by the selector, not executed or acceptance passes. |
| npm run typecheck, isolated snapshot/app | 12:23:42.918Z / 12:23:53.583Z | FAIL, npm/tsc exit 2; two TS2769 diagnostics. |
| npm run build, same isolated snapshot/app | 12:24:02.728Z / 12:24:14.146Z | FAIL, npm/tsc exit 2; same two TS2769 diagnostics; Vite never ran. |

Focused commands from original app were
`node node_modules/vitest/vitest.mjs run --maxWorkers=1 src/editor/CatalogAccordion.test.tsx`
then
`node node_modules/vitest/vitest.mjs run --maxWorkers=1 src/editor/Editor.test.tsx -t "addConnected|connected_picker|connected_arrows"`.
Both added only default/JSON reporter and output-file arguments for retained
evidence, not selection/timeout/assertion changes. See the exact argument arrays
in the [catalog result](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/focused-catalog-result.json)
and [Editor result](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/focused-editor-result.json),
with first-run [catalog log](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/focused-catalog.log)
and [Editor log](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/focused-editor.log).
The unchanged named frozen case
`controlled editor should_choose_addConnected_by_Enter_and_cancel_without_mutation_or_recent`
is present among the 16 selected and passed in **1079.0080ms** at the unchanged
default **5000ms** limit. Original Editor test SHA256 remains
`8b3619a692c6a86ec5c4f78b250183881b62329d7a3312c94a24ced7760a9220`.

**Concrete owner defect:** the real-catalog `rankedSearch` replacement at
[CatalogAccordion.test.tsx:171](../../app/src/editor/CatalogAccordion.test.tsx#L171)
and [211](../../app/src/editor/CatalogAccordion.test.tsx#L211) returns
`CatalogItem[]`, whose `category: string` is not assignable to the narrower
`"azure" | "fabric" | "software"` return type inferred by the pre-existing
mock. `policy.rankedSearch.withImplementation(rankedSearch, ...)` fails TS2769
at both locations. This new test typing defect blocks required gates despite
passing runtime tests and the parent's earlier clean editor diagnostics.
See the first [typecheck log](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/typecheck.log)
and [production build log](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/build.log).
The verifier did not alter either callback, annotation, production code or oracle.

**Fresh candidate and preservation:** prepared 12:14:39.661Z to 12:23:34.561Z,
at
`app/test-results/sprint-4-verifier/integration/20261015T141049067Z/snapshot/app`.
[Provenance](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/candidate-provenance.json)
and [full input manifest](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/candidate-snapshot-inputs.json)
record **18833/18833** byte-identical inputs: **2518** source/tests/config/scripts/
assets/examples/docs/root files and **16315** actually copied dependency files,
248530492 dependency bytes, zero junctions/symbolic links. Input SHA256 aggregate
`44446ba46bce7016f4e9cdb1aedf7d8ca7cab2effd5f042c061e134855973ee5`;
dependency aggregate
`71aebaa327ba363d9926b2ffe56eb785b5ee3bbd2b32408271e504839a294e69`.
No old snapshot, old browser report, original dist, release, original test-results,
.git, spike or cache directory was copied into the fresh candidate. HEAD before
and after is `a523a7e4feca5148d1a1a28fc34e97d28c82d1d6`.

The original **2544/2544** non-exempt protected inputs match the older baseline;
the two legitimate source changes and four parent documents are explicitly
exempted rather than incorrectly required unchanged. The owner's **2380/2380**
GREEN inputs match. Prior catalog test statements are retained exactly at AST
statement level; normal accordion prefix/suffix and original Editor test match.
Source CRLF is preserved. Fresh snapshot non-dependency inputs remain unchanged
after both failed commands. The original 36 dist files and key retained failure/
owner evidence are protected separately; the 14 GB old evidence tree was not
recursively rehashed. Only fresh evidence and this review's current disposition/
append were written by the verifier; no manual/roadmap/spec/global edits occurred.

**Production browser:** [blocked record](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/browser-result.json).
No fresh dist exists because `tsc -b` failed. Actual Edge scenarios **0**, browser
launches **0**, screenshots **0**; requested 1440x900 and 390x844 checks remain
**NOT RUN**, not PASS. No private preview/profile was launched; port 5207 was not
touched. Physical scrolling, full-tail pointer access, boundary keyboard focus,
hit testing, bounds/fonts/assets and browser errors still need verification on
a successfully built repaired candidate. Old DGM-110 browser evidence remains
historical for the changed shared picker and does not qualify this candidate.

**Prepared, not active:** the separate later phase is retained as
`node C:/Projects/Diagrammer/app/test-results/sprint-4-verifier/integration/20261015T141049067Z/independent-verifier.mjs run`.
Its inner command is exactly `npm test -- --maxWorkers=1`, cwd snapshot/app;
invocations here **0**. It is deliberately guarded against this failed candidate.
Preserve this snapshot; do not overwrite it after an owner fix or use the older
diagnostic-instrumented Editor snapshot as clean input.

**Exact next action, parent/owner:** correct the two typed mock replacement
callbacks without weakening the real-catalog cases or changing frozen Editor
behavior/5000ms limit. Return to independent affected tests, a fresh byte-proven
snapshot typecheck/build, and actual production Edge desktop/mobile checks; only
after those pass should the parent dispatch one separate full integration gate.
Count this as repair attempt 1 independently rejected at compile/build, not a
new attempt 0. No unchanged full-suite retry or timeout inflation is authorized.
Teams/Office/novice, native ARM64/x64/Mac, physical zoom/touch, native save/dialog,
packaging/signing/support/release gates remain unverified and separate.

## S4-INTEGRATION-001 Owner Attempt 1: Local Typing Fix 1

2026-10-15, role IMPLEMENTER. **Status: OWNER TYPING REPAIR GREEN;
independent recheck pending. Persisted owner attempt 1, repair cycle 1,
local repair retries 1 (local typing fix 1).** This does not reset the repair
counter, supersede the independent compile/build failure with independent GREEN,
or close the historical full integration failure.

Known RED was read, not rerun unchanged: the independent
[typecheck log](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/typecheck.log)
and [build log](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/build.log)
both retain exit 2 / TS2769 at the two real-catalog replacement callbacks.
The hoisted `policy.rankedSearch` inferred narrower fixture metadata than the
actual `rankedSearch` return type. The falsifiable local hypothesis was that an
explicit fixture-or-real return type on that mock would clear both diagnostics
without a runtime change; the first check after the source edit was typecheck.

Only [CatalogAccordion.test.tsx](../../app/src/editor/CatalogAccordion.test.tsx)
changed: one type-only `vi.fn` generic unions `typeof selectionLibrary` with
`ReturnType<typeof import('../catalog/presentation.ts').rankedSearch>`.
Both existing `withImplementation(rankedSearch, ...)` callbacks and the full
catalog oracle are unchanged. No production source, assertion, timeout,
dependency, configuration, public API, test selection or acceptance change.
The original test bytes are recoverable exactly by removing that generic:
before SHA256 `de000bfafef173ed5da255af351621d632f4203cbdfe21b805e7e97feb9b398c`;
after SHA256 `b478de9ce04fa152f58b14fecf6a86a99e18e54946f15ea9e3651fc2108b83d3`.
CRLF remains 470, lone LF 0.

Fresh owner evidence:
[disposition](../../app/test-results/sprint-4-owner/integration/attempt1-localtypingfix1-20261015T122815Z/owner-repair-disposition.json),
[baseline](../../app/test-results/sprint-4-owner/integration/attempt1-localtypingfix1-20261015T122815Z/repair-baseline.json),
[exact local diff](../../app/test-results/sprint-4-owner/integration/attempt1-localtypingfix1-20261015T122815Z/source-repair.diff)
and [local evidence audit](../../app/test-results/sprint-4-owner/integration/attempt1-localtypingfix1-20261015T122815Z/local-audit.json).
All commands ran synchronously, serially, from the original app without imposed
timeouts. Each first invocation retained start, full output, end and exit.

| Owner check | UTC start / end | Actual result |
| --- | --- | --- |
| `npm run typecheck`, immediate post-edit action | 12:29:06.1230888Z / 12:29:37.1427726Z | PASS, exit 0; [log](../../app/test-results/sprint-4-owner/integration/attempt1-localtypingfix1-20261015T122815Z/typecheck.log), [result](../../app/test-results/sprint-4-owner/integration/attempt1-localtypingfix1-20261015T122815Z/typecheck-result.json). |
| `npm test -- src/editor/CatalogAccordion.test.tsx` | 12:29:58.0855643Z / 12:30:43.8411935Z | PASS, 32/32 tests, 1/1 file, 0 failed/skipped/filtered, exit 0, Vitest 43.01s; [log](../../app/test-results/sprint-4-owner/integration/attempt1-localtypingfix1-20261015T122815Z/catalog.log), [result](../../app/test-results/sprint-4-owner/integration/attempt1-localtypingfix1-20261015T122815Z/catalog-result.json). |
| Focused VS Code `get_errors` | After typing repair | No errors found in the edited test. |

The complete 32-test run includes both new full-catalog regressions; no redundant
two-test rerun was needed. No full suite, build, browser, package or native check
ran here. The independent 32+16 focused passes remain retained prior evidence,
not a fresh post-typing independent result. No old evidence or snapshot was
updated by this owner.

**Exact next action, parent:** dispatch the independent recheck; synchronize
only this typed test/new SHA256 into the prepared 18,833-input fresh candidate
and record updated provenance, then independently recheck affected tests and
typecheck, build fresh, and execute the pending desktop/mobile production
browser checks. The parent owns candidate synchronization, queue updates and
later full integration dispatch. Build/browser remain pending, not PASS;
all platform/manual/release gates remain separate.

## S4-INTEGRATION-001 Independent Local Typing Fix 1 Recheck

2026-10-15, independent VERIFIER continuation. **Status: BLOCKED at a named
browser assertion; final integration NOT STARTED.** Persisted owner attempt 1,
repair cycle 1, local typing fix/retry 1, verifier source repairs 0. Independent
typecheck/build and the affected tests now pass; this is not an independent
repair PASS or an overall integration PASS. All earlier sections remain history.

Evidence: [disposition and preservation audit](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/disposition.json),
[candidate revision](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/candidate-revision.json),
[exact revised snapshot inputs](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/snapshot-inputs-revision.json)
and [original inputs at this continuation](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/original-inputs-revision.json).
The existing prepared snapshot/app was reused; no dependency recopy and no use
of the older diagnostic-instrumented snapshot occurred. Only the corrected
original CatalogAccordion test was mechanically copied into the candidate.

The [retained pre-annotation test](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/CatalogAccordion.test.before.tsx)
has SHA256 `de000bfafef173ed5da255af351621d632f4203cbdfe21b805e7e97feb9b398c`.
The copied/current original hash is
`b478de9ce04fa152f58b14fecf6a86a99e18e54946f15ea9e3651fc2108b83d3`;
removing precisely the one generic reconstructs the old bytes. All other source,
tests, assertions, timeouts, configuration and dependencies remain unchanged.
The prior review append is allowlisted documentation drift, not a source failure.
Preparation independently rehashed both copies before running typecheck first.

Revised 18,833-entry snapshot aggregate:
`99ad5e2b370ba40ed149f6ce2aaea09df0a6a32ce4c35e9f6f948ed8f4cd1247`.
The retained node_modules inventory has 16,315 entries: 16,313 executable
dependency files, unchanged aggregate
`a96ee5eef3d1492d39b2f9a7fbe07bd11c06e8d615b03110e2cebd163bcbf6e4`,
plus two explicitly recorded generated tsbuildinfo caches. The old failed compile
had changed one cache; the first preflight stopped before copying/running npm.
That [preflight failure](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/preflight-first-failure.json)
is retained, not treated as executable dependency drift or silently overwritten.

| Independent gate | UTC start / end, 2026-10-15 | Result |
| --- | --- | --- |
| npm run typecheck, first npm gate | 12:45:15.133Z / 12:45:26.590Z | PASS, exit 0. |
| npm run build, fresh snapshot dist | 12:47:12.958Z / 12:47:24.845Z | PASS, exit 0. |
| CatalogAccordion, no test selector | 12:47:48.809Z / 12:48:02.798Z | 32/32 PASS, 1/1 file, 0 skipped/filtered, exit 0, Vitest 11.64s. |
| Reused independent connected Editor slice | 12:13:40.603Z / 12:14:19.709Z | 16/16 selected PASS, 226 filtered; exit 0; unchanged production/Editor bytes. Frozen original case 1079.008ms at unchanged 5000ms limit. |
| Actual production Edge wrapper | 12:50:29.574Z / 12:50:43.597Z | FAIL, exit 1, named Tab assertion; 0/2 completed viewport cases. |
| Full source npm test -- --maxWorkers=1 | NOT STARTED | 0 invocations; blocked, not waived. |

Fresh retained [typecheck result/log](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/typecheck-result.json),
[build result/log identity](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/build-result.json)
and [Catalog result/log identity](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/catalog-result.json)
bind commands, cwd, UTC, exit and full-log SHA256. The unchanged independent
[Editor result](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/focused-editor-result.json)
is reused, not redundantly rerun. Its readonly/Present invalidation and connected
arrow guards remain focused unit evidence, not a native/browser platform claim.

Fresh [production build manifest](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/production-build-manifest.json):
36 files, aggregate `3dc6b53152caa962a70f8795faec9161533af8826398b42dde8dda94cc6a3086`.
Main bundle index-UsLzYCtS.js SHA256
`d9c8581961561330c45a16ac946ca3a31fa8036e3095f2aef6c87696d3beb033`.
Original dist was neither rebuilt nor replaced. Ordinary chunk-size and
ineffective-dynamic-import build warnings were retained; no configuration change.

**Named browser failure:** `1440: initial 32 / focus / assets: Tab traps back to
cancel`; expected active aria-label `Cancel component picker`, observed
`Insert Application Gateway`. The evidence script's extra focus-trap check does
Shift+Tab from search to cancel, Shift+Tab to initial ranked row 31, then Tab.
Initial exact 32-row order/search focus/zero scroll and font/icon/bounds assertions
completed before this failure. Focus remained inside the dialog. Progressive
scroll mounting may invalidate the harness assumption that initial row 31 stays
the final control; a product regression is NOT established by this assertion.
No assertion was changed, no failing browser scenario retried, and no source fix
was made. Parent/owner must assess the oracle and actual required behavior first.

[Browser result](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-result.json),
[actual run log](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-command-launch3.log),
[initial 32 screenshot](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/1440-initial32.png)
and [failure screenshot](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/1440-failure.png)
retain the observation. Private headless Edge **155.0.4283.45**, one browser launch,
nonpersistent context, private ephemeral preview `http://127.0.0.1:51512/`, closed
after the failure. Actual browser UTC 12:50:31.171Z / 12:50:43.458Z; two screenshots;
zero page/console errors, failed resources or external browser requests observed.
Port 5207/main user profile were not touched. Earlier startup-only failures are
retained separately: [cmd quoting failure](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-command-result.json)
at 12:48:28.668Z / 12:48:28.897Z and
[Node JSON import failure](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-command-launch2-result.json)
at 12:49:16.556Z / 12:49:17.641Z, both exit 1 before any browser launch/assertion.
Only evidence-launch plumbing was repaired; unchanged source oracles were loaded
with installed Vite SSR middleware, without changing source imports or serving
a development application to the browser.

**NOT RUN:** desktop full-ranked ArrowUp/Enter and ArrowDown crossing index 32,
APIM cancel/reopen/query reset, physical wheel access to later/all-tail choices,
connected item/order/one-undo assertions, and all 390x844 scenarios. Do not borrow
unit tests or the screenshot to claim those required production browser passes.

**Preservation audit:** 12:51:26.562Z / 12:52:18.583Z, all checks PASS:
original inputs 18,833/18,833; non-cache snapshot inputs 18,831/18,831;
13/13 retained key evidence files; original dist 36/36; fresh build 36/36;
old snapshot test recoverable; frozen Editor unchanged; HEAD unchanged;
full-source invocation count 0. Original TS2769 logs, earlier focused results,
old manifests and original full failure (5485 passed / 1 timeout, exit 1) retain
their bytes. The only current documentation edit is this top disposition/append.
The sync preparation was moved by the tool to managed execution
44b6d482-551e-40ac-8728-260aff4616d6; its completed result was retrieved, not rerun.
All commands requested sync/no imposed timeout; no power/native/release/git change.

**Guarded later command, NOT authorized/ready to execute while browser FAILs:**
`node C:/Projects/Diagrammer/app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/recheck.mjs run`.
Inner command exactly `npm test -- --maxWorkers=1`, cwd existing
`app/test-results/sprint-4-verifier/integration/20261015T141049067Z/snapshot/app`.
The fresh evidence wrapper has a first-invocation guard and requires browser and
scoped disposition PASS; no full invocation existed and no invoked guard was reset.
Parent owns the named browser failure/oracle disposition and remaining required
production browser coverage before dispatching the one full source gate.

## S4-INTEGRATION-001 Independent Full-Source Closeout

2026-10-15, independent VERIFIER. **Status: AUTOMATED COMPLETE for scoped source
verification only**, owner attempt **1**, repair cycle **1**, local typing fix
**1**, verifier source repairs **0**. Parent authorized RUN NOW after the repaired
candidate's independent typecheck/build, Catalog32, Editor16 and corrected
production browser oracle passed. This is a new candidate after the bounded
picker repair and its annotation-only typing fix, not an unchanged retry.
The initial **5,485 passed / 1 timeout / exit 1** and all later failed compile,
launch, browser-oracle and audit evidence remain retained with their script bytes.

### Exactly-Once Full Gate

Prepared entrypoint, invoked once synchronously with no timeout argument:
`node C:/Projects/Diagrammer/app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/recheck.mjs run`.
Its inner command was exactly `npm test -- --maxWorkers=1`, cwd
`C:/Projects/Diagrammer/app/test-results/sprint-4-verifier/integration/20261015T141049067Z/snapshot/app`.
The existing snapshot was reused without preparation, dependency recopy, scoped
reruns or another build/browser invocation. The clean original Editor test was
resynced already; no older stage-instrumented input was used. Candidate-specific
process and exclusive start-file guards found no active/previous full invocation.
An unrelated focused Vitest process in another repository was left untouched.

| First-run fact | Value |
| --- | --- |
| UTC start / end | **2026-10-15T13:09:23.295Z / 2026-10-15T13:12:21.568Z** |
| Exit / signal | **0 / null** |
| Tests | **5,488 passed / 0 failed / 0 skipped / 0 pending / 0 todo, 5,488 total** |
| Files | **36 passed / 0 failed / 0 skipped, 36 total** |
| Vitest duration / command elapsed | **177.04s / 178.273s** |
| Full invocations for this repaired candidate | **1**; no repeat after bookkeeping failure |
| Full log SHA256 | `22fc9b34e4cdb5b9c56ca72cef642782f0db1741a271b65ae2220795c1be71d3` |
| Full result SHA256 | `0966686ada038bd0896efb4ff391e64be03aebf540d51eb0b4e10d0837d8da77` |

[First-run log](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/full-source.log),
[result JSON](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/full-source-result.json),
[start record](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/full-source-start.json)
and [fresh preflight](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/full-source-preflight.json)
were persisted by the wrapper from that first invocation. Complete totals were
parsed from the actual log, not hardcoded from the expected two added tests.
The sync call completed normally; no background terminal, polling, sleep,
cancellation or duplicate resume was required. The default full reporter emitted
no individual Editor-case timings: none is invented from the focused result.

### Reused Independent Repaired-Candidate Checks

These checks were validated against current candidate/build/log hashes during
this dispatch, not executed again. [Browser authority and audit](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/audit-v02/disposition.json)
and the [browser handoff](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/handoff.json)
bind their inputs and preserve all earlier failed oracles.

| Independent gate | UTC start / end, 2026-10-15 | Result and evidence |
| --- | --- | --- |
| Typecheck | 12:45:15.133Z / 12:45:26.590Z | PASS, exit 0; [result](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/typecheck-result.json). |
| Fresh snapshot production build | 12:47:12.958Z / 12:47:24.845Z | PASS, exit 0; [result](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/build-result.json). |
| CatalogAccordion | 12:47:48.809Z / 12:48:02.798Z | 32/32 PASS, 0 skipped, exit 0, 11.64s; [result](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/catalog-result.json). |
| Connected Editor slice | 12:13:40.603Z / 12:14:19.709Z | 16/16 selected PASS, 226 filtered, exit 0; [result](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/focused-editor-result.json). Frozen original Escape/reopen/APIM/Enter case **1079.008ms**, unchanged 5000ms limit. This is its focused timing, not its unlogged full-run timing. |
| Actual production picker browser | 12:57:07.538Z / 12:57:36.292Z | **2/2 viewports PASS**, 28.754s, Edge 155.0.4283.45; [result](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/browser-result.json). |

Browser cases: **1440x900** and **390x844**, each initially bounded to **32**,
with actual access to all **696** ranked choices, **43 physical wheel events**,
bidirectional tail Tab containment, ArrowUp/wrap and Enter, ArrowDown crossing
the initial batch boundary, APIM cancel/reopen/query reset and restored search
focus. Each viewport completed **4 connected insertions and exact single Undo**,
including the physical-wheel tail choice, with cancellation causing no change.
Across both viewports: **18 named steps, 18 screenshots, 20 JSON downloads**;
all artifact hashes validated; **zero page/console errors, failed resources or
external requests**. Private preview `http://127.0.0.1:53128/` was already closed
with awaited context/browser cleanup; no user profile or port 5207 was touched.
The v03 nested fixture reserves header/sibling space under existing containment
rules without weakening insertion, geometry, semantic or exact-Undo assertions.
Earlier fixed-32-tail and cramped-fixture failures remain historical, not passes.

### Input, Build And Evidence Preservation

Preflight and post-run checks cover **18,833/18,833 original** and
**18,833/18,833 snapshot** actual input hashes. The post-run original inventory
has **277,873,801 bytes**; snapshot input inventory **277,852,046 bytes**.
Source and executable dependency copies match; generated cache identities are
recorded separately. HEAD remains `a523a7e4feca5148d1a1a28fc34e97d28c82d1d6`.

| Identity / manifest | Count and SHA256 aggregate |
| --- | --- |
| Prepared repaired candidate revision | 18,833 inputs; `99ad5e2b370ba40ed149f6ce2aaea09df0a6a32ce4c35e9f6f948ed8f4cd1247` |
| Approved original preflight / actual post-run | 18,833; `0257e895a15b7271bd682fdd271fd14afa1676185f2e46db57ffab4e2736094c` |
| Approved snapshot preflight / actual post-run | 18,833; `86abfb39898ae53fc860394bed666a259032a4d4191d4337e6007e0960a896db` |
| Current source/tests/assets | 2,373 files, 14,245,023 bytes; `5b1c52bfca068f5ba9075977eca884a13ee0cfcb31a678f47bee12643f747083` |
| Executable dependencies | 16,313 files, 248,527,618 bytes; `a96ee5eef3d1492d39b2f9a7fbe07bd11c06e8d615b03110e2cebd163bcbf6e4` |
| Original dist, unchanged | 36/36; `dd7afe274459dbe147e80f2174a75cff57e3a9529364827e6a76dd10dcb2689f` |
| Fresh repaired snapshot build, unchanged through full gate | 36/36; `3dc6b53152caa962a70f8795faec9161533af8826398b42dde8dda94cc6a3086` |

[Actual original inputs](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/original-inputs-after-full.json),
[actual snapshot inputs](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/snapshot-inputs-after-full.json),
[source manifest](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/source-inputs-after-full.json)
and [dependency manifest](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/dependency-inputs-after-full.json)
retain per-file actual sizes/hashes. Revision and approved post-build aggregates
are distinct because the revision predates already-validated documentation and
generated-cache changes; neither is silently relabelled. Frozen original
Editor test SHA256 is `8b3619a692c6a86ec5c4f78b250183881b62329d7a3312c94a24ced7760a9220`.

The [fresh build manifest](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/production-build-manifest.json)
identifies snapshot bundle `index-UsLzYCtS.js`, **7,687,904 bytes**, SHA256
`d9c8581961561330c45a16ac946ca3a31fa8036e3095f2aef6c87696d3beb033`.
It is not the original dist's historical `index-RZcTxx25.js` bundle. DGM-110/116
old browser/dist comparisons establish historical provenance for that older
bundle only. Their source behavior tests, including the full Editor file, are
carried by the new unfiltered source gate; **no new standalone full DGM-110
browser or generator gate was run**. Sprint 3 timings remain historical, not a
fresh repaired-candidate performance PASS.

The [generated-output manifest](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/generated-output-manifest.json)
records **115 files, 53,937,363 bytes**: 36 fresh dist files and 79 suite-generated
snapshot outputs, aggregate `b6a312ca0566fbf119df8802e009119be435212eeb330df6925e8988ae77188c`.
The 36 build files already existed before this full run, not 115 newly created
files. Original fixed-output directories were not used. Preservation also
matched **13/13 key evidence**, **48/48 prior failed/other historical files** and
**48/48 mechanical copies**. The old 14GB output tree was not hashed again.

**Bookkeeping-only failure, resolved without a suite repeat:** the
[first closing audit](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/full-source-closeout.json)
compared the approved review's stale size **56,604** with actual **65,805 bytes**.
Both before/current SHA256 values were exactly
`b5b3b7848e40cb977f132fc8c085db787591284860f199d0ad4d0d1ada4597f9`;
the earlier audit had updated its review hash but not its size metadata. There
was no actual review/input byte drift. The failed audit and its original script
remain; the [corrected evidence-only disposition](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/full-source-closeout-v02.json)
classifies this exact metadata defect and binds the retained actual manifests.
No test, timeout, assertion or acceptance threshold was changed to get green.

### Parent Handoff And Remaining Boundaries

Only this review's current top and closing append, plus fresh evidence, were
written by this dispatch. Its immediate [closing fact/link validator](../../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/closing-reconcile.mjs)
checks the current disposition, exact totals/times/hashes, retained history and
local links. This is documentation validation, not another executable gate.

Parent's next action: reconcile the stale failed-gate introductions in
[manual](../manual.md) and [DGM-113 readiness](../specs/DGM-113.md), plus the blocked
[roadmap queue](../roadmap.md#execution-queue). Those documents are parent-owned
and were deliberately not edited. This source PASS justifies **LOCAL COMPLETE
after those parent updates**, not release acceptance or a new sprint.

Actual Teams/Office recipient/paste/insertion, uncoached novice and JSON transfer,
native save-dialog cancellation/durable completion, physical zoom/touch,
current native ARM64/x64/macOS artifacts, normal managed-device/signing policies,
disconnected cold launch, supported browser/OS minima and platform owners remain
manual/native/readiness boundaries. No package, native app, release state,
dependency/config/security/CI/schema, commit, profile, port 5207 or power setting
was changed. Missing qualification is not PASS and does not negate the scoped
source closure. No further executable reassurance gates are required here.