# Diagrammer Roadmap and Delegation Plan

Updated: 2026-11-06. Status: DGM-165 WINDOWS 0.5.3 EXACT PACKAGES QUALIFIED / SOURCE COMMITTED / PUBLICATION NEXT. OLDER RELEASES, INSTALLATIONS, PREVIEWS AND DRAFTS REMAIN PRESERVED.

## Current Execution Policy

This section and the queue below are the current routing authority. The PO said
"skip revire and start next sprint" and subsequently requested a roadmap agents
can complete without stopping for every minor decision or task. For this
repository, that supersedes the older task-by-task approval and sprint-review
continuation stops in the historical record, DGM-100 and task handoffs. It does
not waive tests, independent verification, frozen behavior, manual acceptance,
or the safety gates below. Global preferences are unchanged in other repositories.

Reviews are asynchronous reporting checkpoints, not permission to take the next
already-authorized action. Complete the approved local queue before returning a
consolidated handoff. Do not invent another sprint, redo a completed feature, or
substitute cosmetic work because a different task is blocked.

The PO's 2026-10-16 request explicitly approved [DGM-117](specs/DGM-117.md):
a question-mark Help button and ordered first-use UI callouts. This bounded
source follow-up is now complete; it was not inferred from a generic "next"
and does not authorize another feature sprint, packaging or publication.

The subsequent explicit "merge, push and Tag" request authorized source delivery.
It completed directly on the existing default branch, without a PR. The PO
clarified "no PRs, just merge/push and tag"; use that Git delivery workflow for
this repository. The source milestone does not update packaged release assets.

The subsequent "ok let's do it" approves the recommended current-guide local
Windows ARM64 package and automated native check, scoped by the
[2026-10-16 cell authorization](specs/DGM-113.md#current-guide-windows-arm64-authorization---2026-10-16).
This is not approval to publish/sign, build other targets or pass manual gates.

The PO subsequently approved source UI follow-ups: [DGM-118](specs/DGM-118.md)
component quick delete, [DGM-119](specs/DGM-119.md) larger connection handles,
Escape gesture cancellation, tooltip repair and right-click quick actions, and
[DGM-120](specs/DGM-120.md) temporary five-color presentation markup. Complete
their integrated source acceptance without reopening old package gates. Shared
surface/CSS/test edits stay serial, and the live portable/profile stays untouched.

The subsequent explicit request "merge, push and tag, rebuild local package ant
open it" authorizes [DGM-121](specs/DGM-121.md): direct source delivery without
PRs, an isolated current ARM64 package/native check and normal launch in a fresh
persistent profile while preserving the old live window. Existing release
assets remain unchanged; no public binary publication or signing is inferred.

The PO's 2026-10-17 request authorizes [DGM-122](specs/DGM-122.md), an additive
saved Markdown-source diagram description in Properties, and [DGM-123](specs/DGM-123.md),
seven curated Azure Architecture Center adaptations with original short guides.
No Markdown parser dependency was approved while the PO was unavailable, so the
description remains an inert source editor. Preserve earlier binaries/live
profiles; this source feature request does not authorize packaging or Git delivery.

The PO subsequently explicitly requested rendered Edit/Preview, a Markdown
sidebar button beside Properties, and a resizable/collapsible preview bar in
Present. [DGM-124](specs/DGM-124.md) supersedes SOURCE-only display for this new
request. Following the delegated parser decision it pins only marked 18.1.0,
reuses DOMPurify and changes no Electron policy. Prior field/storage/guide
acceptance stays; no Git, packaging or release operation is inferred.

The PO then explicitly requested "merge push and tag" for this accepted source.
Direct source merge `58448ff45f105caf5eb8d07d4a52181abd8f6f8a` is pushed to the
existing default branch. The annotated source-only milestone
`source-v0.2.0-dgm124` includes this factual documentation closeout. No PR,
desktop rebuild, binary upload, old-tag replacement or release publication is
part of that request; normal existing branch CI may run without policy changes.

The PO subsequently requested final ARM64 and x64 releases, explicitly not RC.
[DGM-125](specs/DGM-125.md) authorizes fresh two-target Windows packaging,
independent actual-runtime checks and stable/latest GitHub publication under
`windows-v0.2.0` at source `69d89cc`. Prior releases remain intact; native ARM64,
x64-under-ARM64-emulation and unsigned/human qualification limits stay explicit.
This is not permission for a Mac release, signing or security/CI changes.

The PO's 2026-10-19 "ok, go" approves the recommended qualification-summary
reconciliation and continuation using the existing Windows release. The
[DGM-113 continuation](specs/DGM-113.md#acceptance-continuation---2026-10-19)
records exact artifacts, existing acceptance cases and missing human/device
inputs. It does not authorize a new feature sprint, rebuild, publication,
signing, policy change or support promise.

The PO subsequently removed the participant trials and chose independent
colleague sharing. Formal participant recruitment, timed novice scoring and
observed Teams/Office trials are no longer required by the active queue.
Optional colleague feedback is not a gate or a substitute for native/platform
evidence. This scoped [decision](decisions.md#2026-10-19-replace-formal-participant-trials-with-optional-colleague-feedback)
supersedes earlier participant-trial stops, not technical safety requirements.

## Execution Queue

**Latest delivery authorization, 2026-11-06:** the PO requested "compile and
publish latest". [DGM-165](specs/DGM-165.md) has compiled and independently
qualified both distinct 0.5.3 Windows ARM64/x64 portable packages from accepted
DGM-163/164 source commit `8f8e3de`. Desktop tests passed 115/115, the focused
verification-script correction passed 21/21, and build/staging/packaging passed.
Both ASARs match all 61 staged files; both actual GUI/MCP runtimes passed
35-template discovery, architecture insertion/Markdown preservation and
JSON/PNG/three-page PDF checks. x64 was exercised under ARM64 emulation.
See [exact package evidence](verification/DGM-165.md).
**Exact next action:** fast-forward push source/docs, create the new annotated
0.5.3 tag, publish both qualified executables and checksums, and verify fresh
public downloads. Preserve 0.5.2 and current previews; publication is not yet
complete.

**Accepted feature cursor, 2026-11-06: DGM-163 and DGM-164 complete;
compiled catalog preview open.**
The PO-requested Add diagram/workbook-preservation flow, trailing page-strip
plus, undoable guarded page removal, direct rename paths, white Select cursor
and tabbed/column-aligned Page styles are implemented.
[Acceptance evidence](verification/DGM-163.md): 659 focused tests and 27
MCP/workbook regressions passed, TypeScript/Vite build passed, independent
browser checks and the bounded repair recheck passed. Documentation is
reconciled. A separate compiled source preview is open on port 37435 with
its own profile/workspace; the published app on 37434 remains preserved.
The subsequent DGM-165 release authorization above covers packaging and
external delivery of this accepted feature batch.

The PO subsequently requested the exact File menu groups: New Workbook,
Load Workbook, Save Workbook, Save Workbook As; then Add New Page and
Add Diagram; then the retained Recent/Import group. The trailing page-strip
plus now shares direct blank-page creation with Add New Page. Final integrated
source tests and independent actual menu/action checks passed. Initial stale
label, callback typing and timeout receipts remain preserved under
`app/test-results/dgm-163/`; they are not relabeled green.

The PO also approved [DGM-164](specs/DGM-164.md): 24 new original Azure
architecture starters, split eight Microsoft-origin, eight AWS-origin and
eight Google-origin conceptual Azure adaptations, retaining the existing
11 starters. The PO selected replacing the Add Diagram picker with a
hierarchical category navigator and large preview/Markdown pane. The verified
24-entry source inventory and three supplementary provider architecture blogs
are complete. The Spanner-origin adaptation explicitly uses a single-region
Azure SQL writer with asynchronous replication, not Spanner-equivalent global
relational write consistency.

All 24 native diagrams/guides and the replacement catalog are implemented.
The integrated affected selector passed 516/516; the provenance/readability
repair selector passed 506/506, with counts overlapping. Full TypeScript/Vite
builds passed. One independent verifier accepted 24 actual renders, 202 routes,
35-template discovery/new-key acceptance, actual workbook/menu actions,
responsive/keyboard behavior and the bounded provenance/readability repairs.
The residual template-reset fix passed its focused regression and direct
compiled-browser final review. See [DGM-164 evidence](verification/DGM-164.md).

The compiled browser preview is open at `http://127.0.0.1:4178/`; existing
source/release windows on 37435/37434 and their drafts remain untouched.
Documentation is consolidated. No further approved feature work remains;
the exact continuation is the DGM-165 distribution cursor above, not another
implementation or source-verification sweep.

**Previous release cursor, 2026-11-06:** the complete 0.5.2 implementation and
consolidated repair batch are finished. Source tests passed 6,064/6,064,
desktop tests 115/115, and typecheck/build/staging passed. Independent
current-input wheel/drag, PDF pagination/content, ZIP and VSDX structural
checks passed with no confirmed product defects. The historical grid browser
test retains a superseded `move`-command oracle and is not reported as green.

Both final portable candidates have been built in
`app/test-results/releases/0.5.2/final-20261106/`. Exact packaged desktop/MCP
checks passed on ARM64 and emulated x64: version, all 14 tools, three-page
workbook mutation/full-root JSON, PNG and three-page PDF. PDF took 1,781 ms
and 2,254 ms respectively. All 61 staged files match both ASARs.
The PO approved publishing with native Visio interoperability explicitly
unverified. Real native chooser interaction remains an evidence limitation,
not a claimed pass. See `docs/verification/DGM-162.md`.
Source milestone `341e238` is committed, fast-forward merged and pushed to
the default branch. The final ARM64 app is deployed/open with a separate
profile and stable port 37434; the earlier Desktop test app is preserved.
**Delivery complete:** tag `0.5.2` points to `fd213f8`; the public
[0.5.2 release](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/0.5.2)
contains both executables and `SHA256SUMS.txt`. Fresh downloads of both
published executables match the qualified candidates' sizes and SHA-256.
The independent exact-package GUI/MCP addendum passes with no product
defects confirmed. No additional sprint was started as part of this release.
Older diagnostic cursors
below are historical, not instructions to restart per-feature verification.

**Current delivery decision, 2026-11-06:** the PO requested completing the
whole scope before publication, declined an incomplete 0.5.2 prerelease, and
approved the existing launcher as the supported headless CLI/stdio MCP entry
point instead of requiring direct Electron executable framing. This changes
the entry-point contract, not a claim of runtime acceptance or permission to
weaken cleanup, token, validation, file or sandbox guards.

Finish the remaining approved workbook, tabs, scoped export/PDF and native
Visio implementation plus the consolidated Recent/legend repairs before any
new verification phase. Consolidated verification, compile/run, commit,
merge/push, tag and executable publication follow the completed scope.
No tag or release has been created. Preserve the running Desktop test build.

**Current PO execution override, 2026-11-05:** finish implementation before
testing and verification, then compile and run. The PO confirmed this cadence
across repositories and requested less waste and delivery of usable features.
The historical DGM-157 verification cursor below is paused, not the next
action. No further legend diagnostics, per-feature test rounds or repeated
artifact sweeps precede completion of the current approved implementation.

**DGM-158 + DGM-159 implementation handoff, 2026-11-05:** the combined
starter-preview/replacement-safeguard and Save/Save As/Load/default-workspace
workflow source batch is implementation-ready for one consolidated validation.
Targeted native IO, session replacement/current-filename and editor interaction
regressions are authored but intentionally unrun under the PO cadence. The next
owner runs that consolidated validation, then compiles/runs a fresh candidate
without replacing the user's running test executable or profile.
DGM-150's architecture decision and dependent workbook/PDF/Visio remain
genuine blockers; they do not authorize silently narrowing their contracts.

**Current source-acceptance cursor,2026-11-05:** DGM-153 source/browser and
DGM-154 source acceptance remain complete. The independent DGM-155 verifier
rebound to the resize-hit-repair receipt (7/7 source inputs and39/39 build
assets matched), independently passed typecheck/build, completed the
trusted-resize recheck and runnable existing-diagram source matrix. DGM-155
**existing-diagram source qualification is accepted**; this is not full
cross-workbook or portable/native acceptance. The broad independent focused
run remains 843/853: ten tests timed out at the unchanged5-second limit, and
must not be reported as a pass. Targeted endpoint, lifecycle, resize, guard,
DGM-153/154, MCP snapshot and output checks passed; the exact per-criterion
dispositions and first failures are in
[DGM-155 verification](verification/DGM-155.md) and retained records under
`app/test-results/dgm155/independent/`.

DGM-150 remains at its documented launcher/bootstrap/cleanup architecture
gate; no headless repair or live CLI/Desktop qualification was performed.
DGM-151 workbook and DGM-152 PDF/Visio remain dependent/pending. DGM-148
manual segments remain default-off. No Desktop/profile/prohibited-port,
package, Git, deployment or publication work was done by this verifier.

**Active DGM-157 verification cursor,2026-11-05:** the independent legend
meaning run verified current UI/scene output through save/reload, then the
640x480 `withinViewport` assertion failed. A bounded follow-up used the exact
revision-15 fixture and current post-revert production preview; all 2,502
source inputs matched the prior binding, all 39 current build artifacts were
hashed, and each served entry/asset matched dist bytes. No rebuild or source
change was needed.

The narrow result is now classified as a **scrollable-viewport oracle issue**,
not evidence of unreachable content or a legend paint/order defect. At
1280x720 the configured meaning was at y=574.594 and visible. At 640x480 before
opening Page styles it was at y=499.594–510.922, below the window edge by
30.922px; `.workspace` was a native scroll container (`clientHeight=328`,
`scrollHeight=832`, range 0–504). The normal Page styles open/Cancel path
returned focus to the Page styles button and left `.workspace.scrollTop=816`
(the measured maximum after the Properties dock opened), placing the meaning at
y=-316.406–-305.078. The legend stayed inside its own box; `.workspace` was
the first effective clipping ancestor. A native AX snapshot retained the
“Reduced service capacity.” StaticText as `ignored:false`. No wheel was sent
because no visible legend hit point existed; the legend had no keyboard tab
stop. The narrow CSS explicitly implements a scrollable dock. Exact bounds,
clip/scroll metrics, focus path, AX result, screenshots, source/build hashes,
and retained first failures are in
`app/test-results/dgm157/independent/run-20261105-2227-responsive-legend-diagnostic/`;
the previous assertion failure remains preserved in
`app/test-results/dgm157/independent/run-20261105-2215/`.

DGM-157 remains **not accepted**. No current-input MCP, Present, used-removal
replacement/Unset, read-only/ownership, or final DGM-153/154/155/156 matrix was
run in this diagnostic.

**Exact next action:** owner
`55dbbf79-31c4-4938-a464-4688a6974942` revises only the narrow-viewport test
oracle to account for `.workspace` scroll reachability and the normal
focus-return state; do not make a speculative production CSS/order change.
The same verifier independently checks that scoped correction before
resuming the remaining original matrix. DGM-150 headless, DGM-151 workbook,
and DGM-152 PDF/Visio/native/package cells remain dependent/pending and
unaccepted. No Desktop/profile, prohibited-port, dependency/package, Git,
delivery or release action occurred.

**DGM-157 prior independent stop (historical, superseded),2026-11-05:** at test time after
status-invariants-repair1, all 8/8 owner-declared source/document inputs and
68/68 retained owner artifacts matched exact paths, sizes and hashes. The six
production source inputs remain bound; the two documentation inputs have
since been updated to record this result, with their new hashes in
`app/test-results/dgm157/independent/run-20261105-1840/post-documentation-binding.csv`.
The independent status-only entity/connection/batch source suite passed 5/5.
The real HTTP MCP/session/broker integration passed 20/20 cases, including
geometry/anchor/route preservation, the target-specific `web-edge` SVG with
all five box paint fields, used-state legend name/meaning, JSON export, PNG
snapshot signature, stale-output rejection, remap/Unset, atomicity and
undo/redo. It stopped at the first new UI product failure: removing the used
default `synthetic` style and clicking Apply silently unset every assigned
entity. The Page styles dialog exposed no explicit replacement/Unset mapping;
the revision changed from 1 to 2 and no entity retained `status: "synthetic"`.
DGM-157 remains **not accepted**. Exact run logs, exits, screenshots, hashes
and bindings are in [DGM-157 verification](verification/DGM-157.md) and
`app/test-results/dgm157/independent/run-20261105-1840/`.

The independent browser also verified that a draft did not change persisted
IndexedDB state, outside-pointer input kept the dialog open, and Escape
cancelled and returned focus. Remaining UI assignment/CRUD/remap/history/
guard, decoded-PNG/Markdown/save-reload, default/equal-paint/manual-legend,
and DGM-153/154/155/156 checks were not reached after the first product
failure. Text entities remain a distinct kind: only `textColor` is specified
by the current tests; no full box-paint guarantee is claimed for them.
Exact next action: owner `55dbbf79-31c4-4938-a464-4688a6974942` repairs Page
styles removal to require an explicit replacement or explicit Unset mapping
before a used state can be removed, without changing the approved contract.
Then the same verifier resumes at the used-state UI removal check and
continues the remaining runnable matrix. Do not start a new feature or claim
unrun checks. DGM-150 headless, DGM-151 workbook and DGM-152 PDF/Visio/native
remain blocked/dependent and unaccepted; no Desktop/profile, prohibited-port,
package, Git, delivery or release work was performed.

**DGM-157 verification cursor after used-removal-repair1 (superseded),2026-11-05:** after
used-removal-repair1, all 7/7 owner-declared source/document inputs and
69/69 listed owner artifacts matched exact paths, sizes and hashes at test
time. The earlier independent status-invariants suite (5/5) and
real-server MCP integration (20/20) remain reusable for unchanged document,
scene and MCP bridge sources. The live UI showed the selected connection
`azure-web-app-flow-1` with canonical Unset; selecting the available `live`
state left both the control and canonical document unchanged at revision 1.
This is the first new coherent product failure. The focused result and exact
source/artifact bindings are in
`app/test-results/dgm157/independent/run-20261105-1906/`. Its process exit
also records a later screenshot-path harness error, classified separately
after the unchanged-state observation.

Verification stopped before independently rechecking the owner's used-state
removal repair. Exact next action: owner
`55dbbf79-31c4-4938-a464-4688a6974942` repairs UI connection-status assignment
without changing the approved contract; the same verifier resumes at this
mutation, then performs used-`synthetic` no-choice/remap/Unset/UndoRedo checks
before the remaining runnable matrix. Component UI update and previous MCP
creation evidence do not qualify connection assignment. Remaining entity-kind
creation/update, UI CRUD/guards/responsiveness, image/Markdown/save-reload and
DGM-153/154/155/156 checks remain unrun, not passed. DGM-150 headless, DGM-151
workbook and DGM-152 PDF/Visio/native remain blocked/dependent and unaccepted.
No Desktop/profile, prohibited-port, package, Git, delivery or release work
was performed.

**DGM-157 cursor after connection-status-ui-repair1 (superseded),2026-11-05:** after
connection-status-ui-repair1, all 6/6 owner-declared source/document inputs
and 64/64 listed artifacts matched. Independent renderer/MCP snapshot
reference-validation parity passed 12/12 cases, including omitted-v2
legacy-default IDs and explicit-empty behavior. In the actual UI, the selected
`azure-web-app-flow-1` connection changed from Unset to `live` and persisted
at revision 2/schemaVersion 2 with no explicit registry; entity geometry,
connection membership, anchors, offsets and route points remained unchanged
(valid routeRevision metadata was restamped to revision 2).

The verifier then clicked the enabled Undo button. It did not observe the
expected next revision with the edge returned to Unset in the bounded,
document-ID-bound check. This is the first coherent new product failure;
verification stopped. Exact scripts, first/oracle classifications, result,
logs, exits and hashes are retained under
`app/test-results/dgm157/independent/run-20261105-1936/`. The latest
connection-status repair is not independently accepted for history behavior.
Exact next action: owner `55dbbf79-31c4-4938-a464-4688a6974942` investigates
connection status Undo, then the same verifier resumes at this one-edit
Undo/Redo check before the used-`synthetic` removal and remaining runnable
matrix. UI defaults beyond `live`, custom assignment/clear, used removal,
remaining output/legend/save-reload and DGM-153/154/155/156 checks remain
unrun, not passed. Current canonical MCP operations have not been rerun after
the latest repair; earlier unchanged-bridge evidence and the new 12-case
validator parity check do not replace them. DGM-150/151/152 and native/package
cells remain dependent/unaccepted. No Desktop/profile, prohibited-port,
package/dependency, Git, delivery or release action occurred.

**Resize-hit repair owner result (historical),2026-11-05:** the owner fixed the
overlapped connector/resize hit target by clipping only the selected editable
boundary/rectangle/text handle boxes (5 CSS px at current zoom); painter order
and unrelated hit areas were unchanged. The owner's RED/GREEN records and
full-suite result are in `app/test-results/dgm155/resize-hit-repair/`.
Independent record `26` then confirmed a trusted resize at the exact center,
one revision with anchors kept, and exact toolbar Undo/Redo; record `27`
verified the clip/hit-state matrix. The prior File-menu-focus Ctrl+Z
observation is classified in the verification report: canvas-focused
Ctrl+Z/Ctrl+Y and toolbar history work. Historical STOP/NOT-ACCEPTED language
above this cursor is superseded by the current DGM-155 source-qualification
disposition.

**DGM-156 pre-repair independent finding, 2026-11-05 (historical):** the
actual Lines path painted black after Blue was selected. The owner repaired
the shared CSS-variable resolution; that paint defect is now independently
verified as fixed. Keep the original failure JSON in the verification report
as historical evidence.

**DGM-156 owner renderer repair, 2026-11-05:** the actual Lines failure was
reproduced as a source-browser RED: the Dots circle computed Blue while the
Lines path computed the Automatic `--grid-dot` value. The repair makes that
existing CSS variable resolve to explicit `grid.color` when present, preserving
the exact Automatic contrast-aware value otherwise. Owner evidence is retained
in `app/test-results/dgm156/owner/`: the actual computed-paint regression,
the original actual-app matrix (44/44), focused domain/Editor/Help/shared
output/MCP checks (723/723), typecheck, and build all pass. The independent
verification passed the repaired Dots/Lines paint and shared outputs. Its
first Present-state observation was later traced to a color/style-only test
wait accepting an earlier Blue snapshot before a delayed Red save; the exact
revision-bound follow-up below did not reproduce a product reversion.

**DGM-156 independent source result, 2026-11-05:** final current-source
typecheck/build passed, and the actual-app matrix passed 128/128 checks for
palette, Editor paint, state guards/history, reload/theme/background, keyboard,
layout, Present and decoded shared outputs. Revision/document-bound
Blue→Red→Blue testing verified persisted and immediate Present entry; both
painted the latest accepted Blue with monotonic writes and no extra Present
command. Current Markdown grid-on/off and canonical MCP mutation/output also
passed. The focused aggregate test command is **not fully green**: 723 passed,
with one unrelated DGM-127 startup-picker test exceeding its unchanged
5-second timeout. DGM-156 source-behavior criteria are independently verified;
this is not package/desktop or cross-workbook acceptance. See
[DGM-156 verification](verification/DGM-156.md).

**DGM-156 final input check and lane handoff, 2026-11-05:** the complete
128-check matrix's six declared inputs match current byte hashes.
`EditorSurface.tsx` is 191,290 bytes (SHA-256
`D04EF8D42FBB77DC53640CA8ECFEC0E6E9A850841ED70DA4AD46B913DB021040`);
`session.ts` is 28,761 bytes (SHA-256
`88B2E74D6BADE2B620FA8E326E76323EA11178CFE9FBA6AC0D4153D136C9C46F`).
The active source contains the verified Lines `--grid-dot` binding and no
cycle1 speculative grid-save/emit guards or cycle2 instrumentation. The
owner's first failed Present observer trace and the independent failed
candidate remain preserved; only the observer was corrected, not a production
assertion. The independent verifier released the serial source/build/runtime
lane. Do not start a next feature here. DGM-150 headless and DGM-151/152
workbook/PDF/ZIP cells remain dependent/pending; no CLI, Desktop, package or
release acceptance is inferred.

**Orchestrator continuation:** the preceding no-next-feature restriction was
the verifier's bounded handoff, not a new PO queue stop. DGM-156
existing-diagram source behavior is accepted with the aggregate timeout and
dependent-format limitations above retained. The next independent ready task
is approved [DGM-157](specs/DGM-157.md), using the concrete registry in
[RFD005](rfd/005-exact-anchors-and-grid-style.md). The DGM157 implementer owns
the serial source/build/runtime lane: plan acceptance tests, retain executed
RED/GREEN, implement the existing-diagram registry/popover/shared
command/legend/output/MCP paths, then hand back for independent verification.
Workbook, unavailable formats and headless entry remain pending dependencies,
not inferred passes. Preserve all accepted interaction and grid behavior.
No packaging, Desktop replacement, push or publication occurs at this stage.

**DGM-157 owner handoff,2026-11-05:** the approved existing-diagram source
slice is ready for independent verification. The owner retained RED/GREEN,
focused and typecheck/build evidence under `app/test-results/dgm157/owner/`;
the exact record is [DGM-157 verification](verification/DGM-157.md). The next
action is independent verification of the guarded Page styles UI, state-token
MCP atomic configure/remap/assign path, and decoded shared outputs. DGM-150
headless, DGM-151 workbook and DGM-152 PDF/Visio remain dependent/unrun; no
Desktop, package, Git or release conclusion is inferred from this source handoff.

**DGM-157 repair1 handoff,2026-11-05:** independent verification stopped at
DGM157-UI-01 because seven approved page-style paint editors were missing.
The bounded repair restores all approved box/connector paint controls, samples,
draft validation and Escape focus return, and repairs the one-brace DGM-156
MCP-output test parser failure. Evidence is retained under
`app/test-results/dgm157/owner/repair1-*`; this is not acceptance. The exact
next action is independent verifier `2494afbc-b407-47c9-b287-b3e5b8a7276f`
resuming the previously unrun DGM-157 matrix. Dependent DGM-150/151/152 cells
remain unrun; no Desktop/package/Git/release result is inferred.

**DGM-157 MCP-boundary-repair1 handoff,2026-11-05:** DGM157-MCP-01 rejected
valid v2 state-style snapshots and JSON output at the main-process exact-shape
boundary. The bounded repair validates the approved registry and resolved
entity/connection references without relaxing output, broker or transport
guards. Retained RED/GREEN/node/source/typecheck/build receipts are under
`app/test-results/dgm157/owner/mcp-boundary-repair1/`. This remains unaccepted:
independent verifier `2494afbc-b407-47c9-b287-b3e5b8a7276f` resumes at
DGM157-MCP-01, then the remaining unrun DGM-157 matrix.

**DGM-157 boundary-box-paint-repair1 handoff,2026-11-05:** canonical MCP
assignment correctly persisted a custom state on a boundary but shared SVG
rendering used the boundary base paint. The bounded renderer repair applies
only configured box overrides across entity kinds while preserving omitted
base paint and legacy behavior. RED/GREEN, actual canonical MCP output and
current manifests are retained under
`app/test-results/dgm157/owner/boundary-paint-repair1/`. This remains
unaccepted; independent verifier `2494afbc-b407-47c9-b287-b3e5b8a7276f`
resumes the unrun DGM-157 criteria.

**DGM-157 status-invariants-repair1 handoff,2026-11-05:** entity
status-only updates incorrectly invoked text/ancestor growth and invalidated
authored routes. The canonical command now recognizes only label/subtitle
edits as geometry-affecting; state and other appearance-only edits preserve
geometry and routes while restamping the route revision. Owner RED/GREEN,
actual MCP target-boundary paint output, live Page styles proof, and final
manifests are under
`app/test-results/dgm157/owner/status-invariants-repair1/`. The retained
older raw-shorthand renderer fixture failure is documented in DGM-157
verification and is not represented as a pass. This remains unaccepted;
independent verifier `2494afbc-b407-47c9-b287-b3e5b8a7276f` resumes exact
status invariants, boundary SVG, and the remaining runnable matrix.

**DGM-157 used-removal-repair1 handoff,2026-11-05:** Page styles previously
silently unset users when removing a used state. The dialog now requires an
explicit remaining-style replacement or Unset selection per removed used ID,
shows affected entities/connections, and submits the approved atomic remap
contract. It also exposes configured state choices for connection updates.
Retained RED/GREEN, browser interaction output, focused tests, build, and
manifests are under
`app/test-results/dgm157/owner/used-removal-repair1/`. This remains
unaccepted; verifier `2494afbc-b407-47c9-b287-b3e5b8a7276f` resumes used
removal and the remaining matrix.

**DGM-157 connection-status-ui-repair1 handoff,2026-11-05:** selected
connection status updates reached canonical validation but v2 omitted-registry
validation incorrectly rejected legacy default IDs, leaving the UI unchanged.
The shared validator now resolves the four defaults when the registry is
absent. Current UI proof commits the selected edge and repeats the combined
entity/connection used-removal flow. Evidence is under
`app/test-results/dgm157/owner/connection-status-ui-repair1/`. This remains
unaccepted; verifier `2494afbc-b407-47c9-b287-b3e5b8a7276f` resumes the exact
flow and remaining criteria.

**DGM-157 independent MCP-boundary repair1 stop,2026-11-05:** the direct v2
bridge matrix and initial real HTTP MCP operations passed, but a real
`export_diagram` SVG omitted the configured box fill/stroke for assigned
boundary entity `web-edge` while applying the custom connector stroke and
legend. The exact sequence, raw SVG, diagnostic and hashes are retained in
`app/test-results/dgm157/independent/run-20261105-1758/` and
[DGM-157 verification](verification/DGM-157.md). This is a new product failure,
not acceptance. Exact next action: owner
`55dbbf79-31c4-4938-a464-4688a6974942` investigates the scene boundary paint
path; the same verifier resumes at the real MCP SVG assertion. Remaining UI,
real output/history and DGM-153/154/155/156 checks remain unrun. DGM-150/151/152
and native/package cells remain dependent/unaccepted; no Desktop, profile,
restricted-port, Git or release action occurred.

**DGM-157 initial independent source stop,2026-11-05 (superseded by repair1
recheck):** the real source UI initially omitted seven approved paint editors.
The exact sequence, screenshot/hash and original matrix are retained in
[DGM-157 verification](verification/DGM-157.md), with browser evidence under
`app/test-results/dgm157/independent/run-20261105-1730/`. Repair1 later fixed
this UI gap; retain this failure as historical evidence, not the current
blocker.

**DGM-157 independent repair1 stop,2026-11-05:** the repaired Page styles UI
and tested actual exports passed the bounded recheck. The first new product
failure is the shared MCP bridge exact-key boundary rejecting a custom v2
`stateStyles` snapshot and JSON export (`Invalid document snapshot` / false).
Evidence, hashes, exact command and matrix are recorded in
[DGM-157 verification](verification/DGM-157.md) and
`app/test-results/dgm157/independent/run-20261105-1742/`. The source slice
remains **not accepted**. Exact next action: retained owner
`55dbbf79-31c4-4938-a464-4688a6974942` repairs the existing main-process v2
shape validation with focused RED/GREEN and a fresh input manifest; the same
verifier resumes at this boundary. Do not start another feature. DGM-150/151/152
remain blocked/dependent; no package, Desktop, Git or release work occurred.

**Latest final-delivery authority,2026-11-04:** [DGM-162](specs/DGM-162.md).
PO requested "finish, compile and deploy, then open" and "finally when done
push all and publish binaries", and explicitly selected Windows ARM64+x64.
Finish/verify the approved remaining source queue, compile and qualify both
exact portables, deploy/open the completed local build, then push the milestone
source/docs and publish0.5.2 assets/checksums with public-download verification.
This supersedes earlier Desktop-only/no-Git/no-publication restrictions only
for this final milestone. Preserve old releases and the user's running test
instance/work/profile; no force-push, existing tag replacement, installer,
Mac/runtime/dependency/signing/CI change or false acceptance is authorized.

**Latest PO override,2026-11-04:** "i don't care, compile and run NOW",
repeated, authorizes immediate current-source local0.5.2 as an explicitly
unverified test build. ARM64 compile/package/Desktop copy/open are now complete:
visible responsive0.5.2 process155400, no-token MCP on saved test-profile
port37432. Use Desktop **Azure Diagram Studio 0.5.2 Test** shortcut for the
isolated persistent profile. Exact EXE/stage/manifests/delivery receipt are
frozen at `app/test-results/releases/0.5.2/immediate-20261104`.
Independent DGM-161 verification was canceled; no source acceptance or
completed segment gate is implied. Preserve the known boundary no-op defect.
PO then said "after compiling and running keep working on finishing all the
leftovers": resume approved repairs and independent verification after launch.
No GitHub release, installation or closing another app is inferred.
Preserve the running test instance, Desktop candidate and frozen artifact;
no automatic replacement/relaunch while the user is trying it.
The PO subsequently confirmed "pefect. now finish the rest". Continue the
approved source queue: current boundary repair, prepared default-off segment
gate, independent boundary/MCP acceptance, then headless/workbook/export and
the remaining approved editing/File/style work. The immediate Desktop launch
is complete; another qualified Desktop delivery is not a prerequisite for
resuming independent source features. The canceled MCP verifier had no
completed turns. Narrow DGM-161 packaged-runtime cells passed against the
immutable delivered candidate in owned profiles; the lane is handed back and
the evidence is in [DGM-161 verification](verification/DGM-161.md). This
does not qualify the whole build or accept DGM-153.
DGM-153 owner handed back repair3:487 focused editor checks/typecheck/build
and actual isolated no-op/cancel/full-child-exit pass. The reported retained
membership case was a fixture coordinate issue; accepted full-exit persisted
detachment. Latest resize intent uses fixed screen-space gesture deltas and
captured global release. Full independent matrix remains pending; a sequential
hidden-control issue is not yet classified as fixture or product behavior.
The source-only default-off segment gate now has retained behavioral RED,
451 GREEN editor checks,191 connector/routing/boundary checks and typecheck/
build; no package/version/Desktop replacement.
The latest independent boundary run passed no-op/Escape, then stopped on an
admitted child-drag displacement failure: intended absolute left604 beyond
original parent right600, actual canonical left585.5556 still overlapping,
parent retained/expanded. Root cause is not established; do not assume a pure
membership-classifier error. Full matrix remains unrun after that failure.
The narrow guide/docs follow-up is complete with retained RED,464 guide/
segment checks and typecheck/build; default Help no longer promises hidden
segment controls, and README/manual mark the feature experimental/off.
The child-drop repair owner now reports exact intended604 persisted604.00004,
detachment/unchanged parent and Undo/Redo, no-op/Escape,638 focused checks and
typecheck/build passing. Pointer start/release capture and threshold0 need
independent click/multi-root/pan/zoom preservation, not only the isolated exit.
Independent recheck passed exact604 exit/Undo/Redo, no-op/Escape and plain node/
border clicks at actual100%normal. It then reproduced a coordinate regression
under trusted React Flow auto-pan: camera translation changed-2769.0023px,
release-world x3396.9286 was required, but canonical x627.1009 persisted.
Coordinate attempt2/`repair5` now has owner GREEN:39 pure coordinate checks,
threshold/typecheck/build and actual changing-camera drop/history plus static
exit/Undo/Redo/no-op/Escape/click guards. Respective start/release transforms
preserve grab offset without disabling auto-pan.
Independent repair5 recheck passed auto-pan, exact604, no-op/cancel and all32
ordinary resize gestures at normal/fitted zoom. It then found a distinct
minimum-clamp release defect: trusted top-edge399.8808px inward showed600x292
preview but IDB/MCP remained600x360/revision1.
**DGM-150 independent verification update,2026-11-04:** repair1 startup and
bounded lifecycle checks passed through both the source runner and direct
Electron dispatch; the prepared CLI/MCP contract passed **9/9**, and
independent typecheck/build passed. The owner’s direct-edit cancellation
repair was independently verified at1440x900,720x450,390x844; the affected
DGM-153 zero-distance click/double-click, auto-pan, drag and resize checks also
passed. The grid browser rerun reached a snapped persisted child position
(absolute192,256) with no page errors, but its test adapter records only a
generic `boundary-operation` while the assertion requires `positions[0].id`.
This is an evidenced harness/oracle mismatch, not a product failure; later
grid undo/group/resize assertions remain unrun. The isolated importer test
passed21/21, but the original full-suite timeout remains unresolved.
Verification then found a coherent DGM-150 CLI defect: a real source-runner
invocation `validate FILE --not-a-real-option` returned valid JSON, exit0 and
empty stderr rather than rejecting an unsupported option. The source/build
paths for this probe matched the retained DGM-150 input manifest 5/5.
DGM-150 remains unaccepted; no product changes were made by the verifier.
The retained headless implementer completed unsupported-option repair attempt1:
owner malformed-grammar RED/GREEN, source contract **10/10**, direct Electron
exit-2 probe, typecheck, and build are retained under
`app/test-results/dgm150/repair2`. **Current serial owner:** independent
verifier `1b155500-4e28-4e3c-b486-7176a4a54786`; the implementer is idle.
Resume independent DGM-150 acceptance at criterion 2 and then continue the
remaining matrix; do not start a new feature.
No package, Desktop/user-profile, port, Git, or publication work was performed.
See [DGM-150 verification](verification/DGM-150.md) and
`app/test-results/dgm150/independent-repair1` for the exact evidence and
remaining acceptance cells. At that point in the DGM-150 history no
DGM-154 selection behavior had yet been authorized; the later PO-directed
DGM-154 source follow-up below supersedes that status.
**DGM-150 independent continuation2,2026-11-04:** option-validation repair2
was independently rechecked: prepared contract **10/10**, source/direct
grammar, actual CLI outputs, MCP concurrency/crash handling, and adapted
grid/DGM-153 browser checks passed for their exercised cases. Current
2,517-path source/build identity matched; retained direct-edit and DGM-153
evidence inputs matched14/14 and2,452/2,452. The isolated importer rerun
passed21/21, but the original full-suite importer timeout is still
unclassified; the old grid optimized-React failure was not reproduced in the
serial run, and the original grid oracle was corrected only in a temporary
observer copy.
The first current product defect is direct-Electron MCP lifecycle: the
Electron main process/renderer exits cleanly with no visible top-level window
or listener, but its exact disposable profile remains after exit. The source
runner removes its own profile; that does not prove direct-entry cleanup.
The verifier stopped at criterion6 and did not audit the guide. Evidence and
the complete disposition are in [DGM-150 verification](verification/DGM-150.md)
and `app/test-results/dgm150/independent-continuation2`.
The retained headless implementer completed application-owned direct-entry
profile disposal, cycle2 of the same startup/profile-lifecycle defect. Owner
direct EOF, normal, and error probes passed without wrapper cleanup; the
prepared contract remained **10/10** and typecheck/build passed, with evidence
under `app/test-results/dgm150/repair3`. **Current serial owner:** independent
verifier `1b155500-4e28-4e3c-b486-7176a4a54786`; the implementer is idle.
Next is a direct-entry MCP EOF/profile cleanup rerun before any harness
deletion,including bounded cleanup-helper exit and exact-path safeguards.
Only then resume guide
audit and importer-timeout classification. DGM-150 is not accepted; no
package, Desktop/user-profile, protected-port, Git, or publication work
occurred. Do not start the next feature.

**Independent continuation3,2026-11-04:** repair3's direct-Electron EOF
cleanup was independently reproduced after an MCP initialize handshake. The
exact newly created headless profile was observed before EOF, then disappeared
without verifier deletion; the Electron process exited0 and no matching
application/helper process remained. However raw direct-Electron stdout began
with an empty CRLF before its JSON-RPC response. The source runner filters that
bootstrap line; direct entry therefore fails the strict stdio framing cell.
The verifier stopped at this first coherent acceptance failure. The fresh
2,477-file manifest matches2,475 paths from the previous identity; the
headless CLI entrypoint changed and the cleanup helper is new, so prior CLI,
render and MCP results remain historical rather than current input-matched
proof. Current evidence and the full criterion disposition are in
[`DGM-150 verification`](verification/DGM-150.md) and
`app/test-results/dgm150/independent-continuation3`.
**DGM-150 architecture gate:** owner raw `electron.exe --version` also emits
the leading CRLF before app JavaScript. App-local framing changes cannot meet
the strict direct-entry contract. Detached cleanup additionally cannot forward
a failure to an exited parent. Helper path validation passed; observable
cleanup failure remains unresolved. A launcher-only contract or a new
bootstrap/cleanup architecture requires genuine PO approval; neither is
authorized here. Preserve all passes/failures and batch this decision at the
handoff. DGM-150 and its dependent workbook foundation remain blocked,not
accepted. Headless owner/verifier are idle; no more speculative repair loops.
After a decision,resume current-input CLI/render/MCP,helper error forwarding,
GUI/profile/guide,native interrupt and importer classification cells.

**DGM-154 independent first-pass finding,2026-11-04 (historical):** the source behavior passed
real painted-label select-then-edit checks for component, boundary, rectangle,
text and connection titles; selection kept the closed Sidebar closed, open
Properties followed a keyboard selection without taking focus, Markdown view
and draft survived selection, and component-body/connection-line double-click
did not rename. Independent typecheck/build passed, and the unchanged
editor/guide suite passed466/466 on retry. Verification stopped at the first
coherent failure: a real right-click on a painted item title opened the
**Canvas actions** menu without an **Edit label** entry, although the spec,
Help and manual promise it. Evidence and full criterion disposition:
[`DGM-154 verification`](verification/DGM-154.md) and
`app/test-results/dgm154/independent/`.
**DGM-154 repair attempt1 source handoff,2026-11-04 (historical):** restored the explicit
**Edit label** Canvas-actions entry for entity and connection contexts through
the established inline-edit path. Focused tests cover entity, connection,
empty-label, Enter/history, Escape/no-history, and read-only guards; a
production bundle exercised real painted entity and connection title
right-clicks, input focus, Escape and Enter. The editor/guide suite passed
469/469, typecheck and build passed. Evidence is retained in
`app/test-results/dgm154/repair1/`. This was a source handoff, not acceptance. Preserve the initial default-timeout
failure and harness setup failures alongside their passing reruns.
**DGM-154 independent repair1 recheck,2026-11-04:** the real production-browser
matrix passed 36/36 checks, including actual painted-title and empty/unpainted
context-menu targets, Enter/Escape history behavior, first-selection/no-rename
then selected-title edit across component, boundary, rectangle, note and
connection, Sidebar/panel/draft intent, modified selection, drag/resize,
tool-mode and endpoint protections, and narrow/short/theme cases. Read-only,
Present and modal guards passed. Editor/guide tests passed 469/469; typecheck
and Vite production build passed. Evidence, exact criterion dispositions and
source-only qualification are in
[`DGM-154 verification`](verification/DGM-154.md) and
`app/test-results/dgm154/independent/`.

**DGM-154 completion continuation,2026-11-04:** the verifier retained all
36/36 repair1 browser passes and the 469/469 editor/guide, typecheck, and build
evidence, then built the current source into an isolated Vite production
directory. The first new source-browser case passed Enter commit/focus and
exact Undo/Redo. It then found a coherent criterion-2 defect: the component
remained the sole selected node after that history round-trip, and
`elementFromPoint` hit the actual painted title text, but the next discrete
title click did not open the editor. One additional discrete title click did.
This is not a harness or device limitation; verification stopped at this first
coherent failure, without production changes.
Full trace/input hashes/build inventory:
`app/test-results/dgm154/independent/completion/dgm154-completion-browser-2026-11-04T20-41-29-254Z.json`
(exit 1).
The current-input integrated DGM-153 run passed top-clamp, zero-distance and
Escape no-op, auto-pan geometry, child membership/exit, fresh-after-history,
and multi-root membership/history cases (1 resize and 15 membership cases;
exit 0):
`app/test-results/dgm154/independent/completion/dgm154-completion-dgm153-integration-2026-11-04T20-28-35-278Z.json`.
No default-off DGM-148 segment editing was enabled. The physical IME,
pointer/touch, and scaling cells remain unavailable in headless; they are
separate platform limits, not the reason verification stopped. Runnable blur,
invalid-label, synthetic composition, document-replacement, exhaustive
double-click and remaining tool-operation cells are **UNRUN after the
criterion-2 failure**. The complete disposition is in
[`DGM-154 verification`](verification/DGM-154.md).
No verifier production changes were made. Browser/server processes are closed.
**DGM-154 selected-title-after-history repair source handoff,2026-11-04:**
history actions now request a one-time cancellation reset only after their
replacement document has stabilized and no active move/route/boundary gesture
remains. This keeps the pointer-admission identity and revision checks intact,
so a pointer admitted before Undo/Redo still cannot edit a replaced document,
while the first fresh painted-title click after an Enter/Undo/Redo round trip
opens inline edit. Focused history/identity and DGM-153 pending-gesture tests
passed; the production-browser test exercised first-click editing after
Undo/Redo across its narrow/short viewports, and initial first-title selection
remains covered. Editor/guide tests passed 471/471; typecheck and source build
passed. Evidence and final input hashes are retained in
`app/test-results/dgm154/repair2-history/`. This is a source handoff—not
acceptance—for verifier `5e74a349-0a98-4193-9cf9-ccb0fb4c2dd5` to continue the
unrun source cells. That verifier now owns the serial source/build/runtime
lane; the implementer is idle. First recheck the exact history/title-click
failure and first-selection/active-gesture guards, then complete the remaining
runnable original criteria with current input identities.
Do not start another feature or perform packaging,
Desktop/profile, Git, deployment, or publication work.

**DGM-154 independent source acceptance,2026-11-04:** current repair2-source
verification passed all runnable approved criteria: the current production
browser matrices passed 36/36, 8/8 and 11/11; the strict initial-selection/
post-Undo/Redo title-admission check passed 2/2; the editor/guide suite passed
471/471; typecheck/build passed; and the current-input DGM-153 integration
matrix passed one resize case and 15 membership cases. The final criterion
disposition, input/build identities, full reports and retained harness
failures are in [DGM-154 verification](verification/DGM-154.md) and
`app/test-results/dgm154/independent/repair2-recheck/`. Physical IME,
pointer/touch-device and operating-system scaling cells remain blocked by
unavailable hardware; no runnable source cell remains unrun. This accepts the
approved source scope only—not Electron, portable/native, Desktop, package,
or release qualification. The verifier made no production changes and closed
its owned browser/preview helpers.

**DGM-155 independent source verification,2026-11-04:** owner inputs and
builds matched their retained hashes; the independent focused suite passed
643/643, Help passed13/13, and an independent typecheck/build passed with
byte-identical output. A real selected-edge pointer gesture did not reach its
visible endpoint: the overlapping React Flow node connector port received the
pointerdown, a 2,601-point endpoint-region hit scan admitted zero endpoint
targets, and the canonical readback remained schema v1/revision0 with the
original connection. This is a product interaction failure, not a harness
failure. See [DGM-155 verification](verification/DGM-155.md) and the evidence
manifest. Remaining runtime/output matrix stopped at this first defect.

The implementer handed back hit-layer repair1:controls now occupy selected
node layers above connector ports,offsets round deterministically,and edge
selection survives endpoint commit. Owner built-source trusted-pointer proof
passed both ends/nonmidpoint other-item attachment; typecheck passed.
**DGM-155 repair1 independent recheck,2026-11-04:** the current owner source
hashes matched; the independent TypeScript/Vite build passed. Trusted source
same-item and target other-item gestures each advanced one revision and their
rendered endpoints matched canonical v2 geometry within0.000016 CSS pixels.
The first expanded source cross-item gesture targeted visible item `d` with
trusted pointer input but saved source `b` instead, advancing revision3→4.
This is a product interaction failure, not a harness mismatch. Retain the
first failing input/canonical trace and current build identities under
`app/test-results/dgm155/independent/`; the rest of the matrix stopped at this
first coherent defect. **Current serial owner:** DGM-155 implementer
`d024de75-3f0f-480e-a170-731bf73b04de` executes cross-item commit repair
attempt1 against the exact independent fixture; verifier
`19abbcd2-c43c-4767-b177-d3b0d51bbfee` is idle.
Owner reports a release-lifecycle/capture fix and exact copied-fixture
cross-item source/target browser proof plus typecheck passing,but the focused
suite still requires its post-final-jsdom-guard rerun. This is an incomplete
handoff,not independent-ready acceptance. The owner retains the lane to
finish final focused checks,production build,current byte identities and
matching actual browser proof before independent continuation.
That final controlled-Editor regression still failed:no target-endpoint
command in the unchanged both-end nonmidpoint test after document-level
release changes. Earlier browser/build proof predates the final adjustment
and is not final-source acceptance. The owner now executes cycle2 of the
same cross-item/lifecycle defect,first distinguishing actual lifecycle bugs
from evidenced controlled-test ordering. Preserve assertions and failures;
targeted GREEN,full focused checks/build and final matching browser proof
remain required. The verifier stays idle; per-defect limits still apply.
Cycle2 still failed the unchanged target-endpoint assertion. A narrow
read-only review traced live-preview endpoint ownership moving the control
from the original item to its new target mid-drag,unmounting the captured DOM
node before its pointerup. Source-side same-item movement keeps its node,
explaining the asymmetric test result. This is a static causal diagnosis;
the production pointer-capture cancellation race is not yet demonstrated.
The owner now executes final cycle3,verifying the trace and preserving the
gesture's control host identity until completion/cancel,with unchanged
behavior assertions and actual final-source browser proof. A failed third
cycle blocks this defect; do not restart its budget.
**DGM-155 historical disposition at that queue stage:** cycle3 did not produce final validation.
Host pinning exposed a render/ref dereference race; the owner's local
snapshot correction has no final targeted GREEN/full suite/build/browser
proof. DGM-155 is blocked and its last source edits remain unqualified.
Both owner and verifier are idle. Preserve all artifacts; no new automatic
repair or release-ready claim is authorized after the three-cycle budget.
Batch the PO disposition with the genuine DGM-150 architecture decision.

**DGM-156 initial source handoff,2026-11-05 (historical, superseded):** 12 swatches plus Automatic,page-local
RFD005 color validation,MCP and shared outputs are implemented. Owner245
focused checks and real browser SVG/PNG decoding passed; evidence is under
`app/test-results/dgm156`. Typecheck/build fail on unqualified DGM-155
EditorSurface errors at lines159/1753,and the combined Editor suite reaches
a null endpoint-gesture dereference. These are not accepted grid UI evidence.
Independent grid editor/Present/history/keyboard/reload/output qualification
cannot proceed against a compiling current app until that source blocker is
dispositioned. DGM-156 owner was idle at that point; this blocker was later
resolved by the DGM-155 recovery and current-source verification above.
**PO disposition,2026-11-05:** approved one escalated DGM-155 recovery pass
to restore compilation and complete connector validation; see
[decision](decisions.md#2026-11-05-one-escalated-connector-recovery-pass).
**Serial owner at that stage:** retained independent DGM-155 verifier
`19abbcd2-c43c-4767-b177-d3b0d51bbfee` rebinds to the completed escalated
handoff and repeats actual connector lifecycle/geometry/output checks.
The escalated implementer and earlier DGM-155/156 actors are idle.
The next action at that stage was independent source acceptance,then grid UI continuation;retain and
classify suite timeout/grid-observer evidence rather than assuming baseline.
The ledger records attempt4 with explicit renewed
authority,not a reset. No acceptance or publication waiver is implied.
The separate DGM-150 architecture and workbook/PDF/Visio gates remain open.
**Escalated pass result,2026-11-05 (historical):** owner handoff complete,NOT accepted.
Root causes were the live-preview endpoint host unmounting the captured
control,and React Flow's Escape deselect committing the preview. Both are
fixed with RED→GREEN tests;the DGM-156 metadata no-op was canonicalized for
DGM110. Typecheck/build pass. Non-browser files pass serially (load timeouts
pass on serial rerun). The production-browser exact lifecycle/export matrix
passes. The only source-browser failure is the documented DGM-150 grid
observer. Evidence: `app/test-results/dgm155/escalated-recovery/receipt.json`.
**Next action at that stage:** the independent DGM-155 verifier rebinds to the
receipt identities and repeats the matrix; then DGM-156 grid UI/build
qualification resumes. The owner lane is released.
Preserve accepted DGM-153/154 behavior, the
default-off DGM-148 gate and DGM-161 protections. Do not modify the blocked
DGM-150 bootstrap, claim workbook/PDF/Visio qualification, or begin
packaging/Desktop/Git/deployment/publication work. After DGM-155 acceptance,
the DGM-150 architecture gate still applies before headless/workbook
continuation.

Owner repair6 retained a pure clamp fix (40 checks and typecheck pass), but
its production runner stopped at the previously classified invalid480-wide
fixture growing to content minimum544. This is not established recurrence of
the resolved no-op defect. Owner continues the same clamp attempt using the
independently validated600-wide baseline, with the original failure retained;
actual minimum-clamp production acceptance remains pending.
Owner then handed back40 passing valid-baseline production resize cases,
including top clamp to `(120,168,600,292)` with anchored bottom/fixed children,
history/persistence and valid no-op/Escape;40 pure checks/typecheck/build pass.
Current identities are in `app/test-results/dgm153/repair6/repair6-source-build-hashes.json`.
A later owner child-exit expected604/actual640.6666 remains unclassified,
not repaired or accepted. Independent verification checks actual camera and
hit admission before classifying it; full acceptance remains pending.
Independent repair6 source/browser qualification subsequently **PASSED**:
41 resize cases,15 membership cases,7 selection/hit-target cases,9 guard/
cancellation cases,real auto-pan,reload/history/MCP,JSON/SVG/PNG exports,
normal connectors/default-off segments and242 compatibility checks.
See [current evidence](verification/DGM-153.md); historical failures above
remain preserved. Source/browser DGM-153 is complete; packaged/native and
final release acceptance are separate gates. The verifier closed its helpers.
Per-defect limits still apply; DGM-148's exhausted authority remains blocked.

**PO-directed MCP amendment,2026-11-04:** [DGM-161](specs/DGM-161.md)
removes desktop MCP access-token authentication while retaining loopback-only
binding and browser/rebinding/request/session protections. PO explicitly chose
a persisted configurable port applied after restart, with no silent fallback
when occupied. The independent packaged-runtime cells now pass on the frozen
test candidate; the evidence is limited to that candidate and does not qualify
the whole build. Preserve diagram state tokens and the old running app/profile;
no remote access.
Retained implementer `f2cb8648-9a9e-4160-91f5-b42fe39718bb` handed back
implemented source, meaningful401 RED,38 renderer/native100 checks and
typecheck/build/stage. The independent runtime report verifies actual
two-start/collision behavior and records complete path/size/hash identities;
it does not reconstruct truncated owner receipts or infer pre-edit contents.
DGM-161 is independent of the outstanding boundary child-exit defect.
DGM-153 repair2 owner may continue the separately scoped repair; do not infer
its acceptance from DGM-161. DGM-160 still requires its own segment gate,
version, package, and exact-portable qualification.

**PO-directed delivery cutoff,2026-11-04:** [DGM-160](specs/DGM-160.md)
is now the next deliverable: a desktop-only0.5.2 ARM64 test executable with
verified Recent/boundary changes and unfinished segment editing excluded.
PO explicitly chose this over waiting for the whole queue. Complete current
DGM-153 repair/qualification, the newly requested DGM-161 MCP change, then
the narrow gate/version/local packaging
and exact-portable verification, then Desktop copy and launch as subsequently
requested ("ok, build deploy and open"), using an isolated test profile and
verifying the new instance is responsive. No GitHub publication,
Git delivery or installation is authorized. All remaining features stay queued;
headless source execution waits until this requested Desktop delivery closes.
Retained DGM-160 implementer `95d39730-66e7-4879-9a88-567c6b9f79ea` has
prepared an unexecuted segment-gate test outside normal discovery; no source,
version or packaging work is released yet. After DGM-153 qualification, reuse
that actor for executed RED, narrow gate/version and ARM64-only packaging.
Do not use stale standalone desktop selectors or git HEAD as dirty-build proof.

**Current delivery cursor,2026-11-04:** DGM-149 source technical acceptance is
complete. DGM-153 implementer `0c551ffc-f468-4da8-8eb8-ce0a8a2a53ce`
completed source changes with retained RED,645 unit checks/typecheck/build and
partial owner browser evidence. Independent verifier
`f9f1e1ef-f39e-41a4-b416-9caac55c1f5b` reproduced a production-App failure:
a real right-edge drag visually resized480 to516 but MCP-backed document/
revision readback and publication did not change. The owner later traced an
internal history revision2 with publication stopped by the window-error handler;
the independent failure remains, but stale MCP readback alone does not establish
that internal history or IndexedDB failed to commit. Source is NOT ACCEPTED.
Retained implementer `0c551ffc-f468-4da8-8eb8-ce0a8a2a53ce` has now handed
back repair1:308 focused App/session/boundary checks, typecheck/build and the
actual production right-edge/child-exit regression are reported passing under
`app/test-results/dgm153/repair1`. The earlier running-tests-only handoff was
incomplete; final logs and attempt5 JSON now exist. Independent verifier
`f9f1e1ef-f39e-41a4-b416-9caac55c1f5b` passed the real right-edge commit,
matching IDB/MCP, fixed children, Undo/Redo and a fresh gesture, then reproduced
a new defect twice: out24 CSS pixels and exactly back to the original pointer
commits width544/revision2 rather than zero history. Verification stopped at
that coherent defect; remaining matrix is not run. Helpers closed/lane clear.
Repair2 owner later reported 635 focused checks/build and the return-to-origin
regression passing, but the next production child-exit case failed with
`parentId` retained. DGM-161's narrow packaged-runtime verification then passed
and released the serial lane back to DGM-153. DGM-153 remains unaccepted; the
next action is repair3 focused on distinguishing a genuine accepted/full-outside
drop from a fixture hit/camera mistake, then rerun the production exit case
before resuming the remaining matrix.
Owner's duplicate-React combined browser fixture failure stays recorded, not
counted as a pass or a reproduced product bug. DGM-150 retained implementer
`6956bd6d-496d-4736-805c-63c44f4a70b2` may only prepare executable test
artifacts outside normal discovery while waiting: no commands/production edits.
Its corrected draft is prepared; actual RED/execution has not started.
After DGM-153 passes independent verification, follow the new DGM-160
Desktop delivery cutoff first, then release the lane to the retained
headless implementer for actual RED and implementation. Preserve all prior
failures and source/package distinctions. No repeated per-task PO stop.

**Additional PO request,2026-11-04:** [DGM-159](specs/DGM-159.md),
File Save / Save As / Load labels without JSON in the command names.
PO explicitly chose Save always writes configured default folder/current
filename, even after external Load/Save As; Save As picks any location.
Prefer diagram/workbook title for suggested initial file/new-workspace names.
An existing configured workspace stays authoritative: Save writes there
without another workspace picker or creating a per-diagram workspace.
Recent accelerates the same guarded original-file Load. Keep collisions,
atomic writes, full-workbook backups, typing and native path safety honest.
This intentionally changes future Save defaults without moving/deleting prior
export folders or silently writing an external original.

**Additional PO request,2026-11-04:** [DGM-158](specs/DGM-158.md),
make New diagram thumbnails genuinely larger/readable and suppress replacement
confirmation for proven current JSON backups or an unchanged template. PO
explicitly selected Save JSON, not autosave-only "Saved on this device".
Keep backup reporting honest, protect modified templates/workbooks and preserve
existing direct-choice/Blank/keyboard behavior. Source follow-up appended.

**Additional PO request,2026-11-04:** [DGM-157](specs/DGM-157.md),
advanced page-scoped functional state styles for boxes/connectors/colors:
add/edit/remove names, meanings and paint definitions in a page popover,
available to MCP/agents and shared legend/rendering. Current fixed statuses
are defaults, not immutable global states. Include this versioned registry in
RFD005's now-approved batched format/public contract; no arbitrary CSS/code or
automatic remapping of used styles.

**Additional PO request,2026-11-04:** [DGM-156](specs/DGM-156.md),
grid-color swatches:3 greys, white, black, red, green, yellow, blue, orange,
purple and brown. Recommend per-diagram/page persistence, matching Grid scope,
plus Automatic to preserve current default. Shared editor/Present/export and
CLI/MCP must agree. [RFD005](rfd/005-exact-anchors-and-grid-style.md) batches
the exact-anchor/grid-color format approval: preserve old Diagram v1, use v2
only for new saved fields, accept mixed supported page versions in workbooks,
no automatic migration and no free connector endpoints. The PO subsequently
approved RFD005 including its bounded64-entry state registry. Implementation
is authorized within that exact contract. **Initial DGM-156 implementation
handoff,2026-11-05 (historical, superseded):** the DGM-155 compile/runtime
blocker described at that time was subsequently repaired and independently
qualified. Final DGM-156 current-source behavior verification is recorded in
the current execution cursor above and
[DGM-156 verification](verification/DGM-156.md); workbook/CLI/package gates
remain separate.

**Additional PO request,2026-11-04:** [DGM-155](specs/DGM-155.md),
drag connector ends to exact border points or another item's border, retaining
relative attachment when that item moves/resizes. PO explicitly corrected the
earlier detach-only Delete choice: "when you press CANC delete the connector
completely". Canc/Delete on an edge/endpoint removes the whole connection;
do not add free/dangling endpoints. Preserve input typing and one-step Undo.
Exact attachment persistence follows the subsequently approved RFD005 v2
offset/side contract, coordinated with workbook/headless surfaces. Implement
that bounded contract, not arbitrary fields; no installed capability claim.

**Additional PO request,2026-11-04:** [DGM-154](specs/DGM-154.md),
canvas item selection must not auto-open rename or a closed sidebar. Already
open Properties follow selection; preserve panel intent and Markdown drafts.
A later click specifically on the sole selected item's title/label starts
rename; body/icon/line double-click is not a competing rename entry point.
Preserve F2/context editing and multi-select/drag/resize/connection guards.
Capture pre-click selection so React Flow's callbacks cannot rename on the
first click. Approved source follow-up appended; no installed change inferred.

**Additional PO request,2026-11-04:** [DGM-153](specs/DGM-153.md),
drag-to-enter/leave boundary membership and direct hand resizing by dragging
boundary borders/corners. PO chose expansion only for an item's current
parent; foreign overlap does not adopt or grow. Decide membership on release
against pre-gesture bounds so a growing parent cannot trap its escaping child.
Full exit detaches; full containment adopts; partial current-parent overlap
retains membership and expands only that parent. Border resize preserves child
absolute positions and clamps to contents, with undoable origin/size changes.
Approved source follow-up appended to existing queue; no reprioritization of
the current Recent/headless/workbook/Visio work or installed change is inferred.
It can proceed as independent ready work if an earlier platform cell is blocked,
with shared source/build/terminal work still serial.

**Additional PO requests,2026-11-04:** [DGM-151](specs/DGM-151.md),
multi-page workbooks with titled drag-sortable Excel-like bottom tabs, visible
in Present, workbook Markdown plus independent page Markdown, and per-page/
whole-workbook exports. PO chose a single workbook JSON containing full diagram
pages and explicitly requested combined multi-page PDF. [DGM-152](specs/DGM-152.md)
adds the requested Visio export, proposed as native editable macro-free .vsdx,
not renamed artwork, with one Visio page per exported diagram.
[RFD004](rfd/004-workbooks-and-interoperable-exports.md) records the schema,
history/isolation, PDF, interoperability and additive CLI/MCP proposals.
The PO approved the detailed backward-compatible workbook/PDF/VSDX scope,
including100 pages/64MiB and additive page-aware CLI/MCP contracts:
"Approve the workbook, PDF and native Visio export scope (Recommended)".
Freeze the small workbook slice contracts before assignment; do not silently
alter the currently approved DGM-150 single-diagram implementation.
Queue stays serial with the named independent-ready DGM-153 exception above:
DGM-149 acceptance -> in-flight DGM-153 -> approved DGM-150 -> approved
workbook slices -> Visio integration, with guide updates per feature.

**Additional PO request,2026-11-04:** [DGM-150](specs/DGM-150.md),
headless direct CLI and CLI-launched MCP for local AI tools, guide coverage,
lowest usage friction. [RFD003](rfd/003-headless-local-automation.md) proposes
one executable, explicit-file commands and stdio MCP backed by a dedicated
never-visible sandboxed shared rendering worker. New public/privileged contracts
were approved by the PO: "Approve the low-friction CLI and stdio MCP interface
(Recommended)". Source implementation is queued; no dependencies, packaging, global
configuration, release/install or GUI-profile changes are authorized.
DGM-149 repair1 independent verification is **PASS** for the approved
source-only scope and is technically accepted under the approved continuation
policy. Targeted renderer (3), native
filesystem/IPC (9), build/stage and source/runtime/dist hash checks passed.
Production-dist browser evidence verifies stale-read ownership, exactly-once
accepted reopen promotion, Escape/Close focus, browser-only Open/download
fallback, the guide limitation, reload recovery, and keyboard/MCP guards. The
final UI continuation stayed on the same admitted writable page; the earlier
fresh-context chooser obstruction did not recur there. Original RED and
intermediate observer/harness failures remain preserved. See
[`DGM-149 verification`](verification/DGM-149.md) and
`app/test-results/dgm149/independent-repair1`. No packaged/native-OS-dialog
claim is inferred. Next: complete the already-started independent DGM-153
TDD slice and its verification, then start DGM-150. DGM-153 test authoring began
while the Recent browser fixture was blocked; finish it to GREEN before the
next feature baseline rather than leave intentional RED tests in the tree.
This bounded ready-work exception does not change feature contracts or waive
any technical acceptance gate. No further per-task PO approval is needed.
Preserve blocked DGM-148
partial source and all evidence. No packaging, installation, Git delivery or
release state is authorized.

**Latest PO priority,2026-11-04:** [DGM-149](specs/DGM-149.md), File ->
Recent diagrams: last20 successfully opened/saved JSON originals, profile-local
history, newest first, retained across restart. PO chose originals rather than
snapshots and explicitly approved the narrow native file-access bridge extension
for user-selected/saved JSON only, with no arbitrary-path/MCP access.
Current cursor: independent verification is **PASS** for the approved
source-only scope and is technically accepted. The initial verifier run's three
pre-repair defects remain documented. The final same-context production-dist
continuation verified Escape/Close focus return, browser-only explanation and
File → Open JSON/download fallbacks, guide coverage, reload recovery with
exclusive document ownership and persisted editability, and keyboard/MCP
guards. Targeted renderer (3), native filesystem/IPC (9), build/stage and hash
evidence remain green. Evidence: [`DGM-149 verification`](verification/DGM-149.md)
and `app/test-results/dgm149/independent-repair1`. No packaged/native-OS-dialog
claim is inferred. Next: DGM-153 implementation/independent verification already
in flight, then DGM-150 and the remaining approved serial queue. Final PO
product acceptance and packaging/install decisions remain separate.
Preserve blocked DGM-148 partial source and all evidence.
No packaging, installation, Git delivery or release state is authorized.

**Latest PO priority,2026-11-02:** [DGM-148](specs/DGM-148.md), connector
segment dragging only (no bend-point editor). PO approved saved adjustments
and reset on geometry changes. Source-only: no new persisted fields, MCP tools,
dependencies, package/release/install or Git delivery. Current cursor:
initial implementation605 focused tests/typecheck/build pass, but independent
production-browser review is NOT ACCEPTED. The route hit stroke covers the
visible handle center; only narrow edge slivers accepted pointer input.
Retain first failures and partial drag/history/JSON/reset evidence in
[DGM-148 verification](verification/DGM-148.md).
Repair1 owner225af135 completed actual hit targets, endpoint approaches/clamping,
single-selected-edge handles, grab-offset/no-op semantics, typed completion
and cancellation/guard regression coverage. First RED has3 expected failures;
608 focused tests/typecheck/production build and owner center/interior hit
smoke pass. Evidence: `app/test-results/dgm148/repair1`; original failures stay.
Independent post-repair verifier95c333c7 confirmed center-hit/route fixes,
pointer history/no-op, keyboard Escape/Enter, snap/pan/zoom, JSON/autosave reload,
Present and actual SVG/PNG1x/2x/ZIP output. Full acceptance remains pending:
fit-scale handles shrink to10px narrow/13.4px short, and a retained
desktop-to-narrow resize/Fit path left the handle offscreen.
Repair2 implemented a24CSS-pixel minimum actual target, with owner fitted
desktop/narrow/short measurements and retained RED/GREEN/typecheck/build.
Independent repair2 verification confirms target sizing, Shift/blur, route
appearance/reset/Undo, background/order and pointer-cancel/lost-capture controls.
Measured Fit fails because below-canvas docks are subtracted as side overlays
and selected chrome leaves top168 > bottom148 in a340px canvas.
Subsequent pointer gestures also fail after Undo: the shared cancellation flag
stays set and segment admission does not establish a fresh gesture.
Repair3 source/build is ready: fresh segment admission retires obsolete
cancellation; Undo/Redo retire route gestures; Fit subtracts only an actually
overlapping library; narrow dock canvas reserves520px for chrome plus a real
scene band without closing panels. Typecheck/build pass. Owner focused run
found the expected340-to520 CSS assertion drift; updated exact expectation
has not yet been rerun. No new repair3 unit RED log was retained; do not invent
one or confuse this with the existing pre-fix independent browser failures.
Final independent verification95c333c7 passed609 focused tests, repaired
resize/Fit and fresh gestures after history, actual saved outputs, layout/reset
Undo/Redo and isolated endpoint reconnection. Source remains NOT ACCEPTED:
Present commits a live segment preview rather than cancelling; Shift-clicking
a second connector clears both selections. Keyboard-visible focus also needs
evidence. Source/test-only guards are not live IME/ownership certification.
All verifier previews are stopped; evidence is under
`app/test-results/dgm148/independent-repair3` and the verification report.
Three automatic repair cycles were exhausted; the PO explicitly authorized
one additional bounded pass: "Fix the remaining defects and verify".
Repair4 is limited to Present cancellation for segment gestures, reliable
multi-edge selection and keyboard-visible-focus verification.
Repair4 owner225af135 completed segment-specific Present cancellation and
single-authority edge selection; focused611 tests/typecheck/production build
pass. The test mock now models React Flow select-change-before-click callbacks.
No valid new pre-edit RED exists: production edits preceded regressions; this
process violation is recorded, not reconstructed. Owner browser checks were
not run. Final independent repair4 evidence remains NOT ACCEPTED:
pointer cancellation prevents Present activation ("Edit has not yet been
accepted"); keyboard route preview commits on blur before Present;
Shift-click selects only the second edge. Control multi-selection works on
Win32. Real Tab-visible focus passes both themes at greater than5:1 contrast,
and isolated endpoint reconnection passes.
All owned previews/browser helpers are stopped; evidence and exact hashes are
under `app/test-results/dgm148/independent-repair4`.
BLOCKED after the explicitly authorized extra pass. Next: PO decision on a
further scoped correction to mode-entry/blur ordering and modifier selection.
Do not install, publish, commit or claim accepted; preserve partial source and
all first failures. No further automatic implementation is authorized.
No criterion relaxation, automatic further pass, Git delivery or
installed0.5.1 mutation.
The installed0.5.1 portable was separately authorized and installed after
DGM-147 publication; its EXE hash and Start shortcut were read back, with
0.5.0 and profiles preserved. This source task does not change installed bytes.

**Latest PO priority,2026-11-02:** [DGM-147](specs/DGM-147.md),
"package, compile and distribute0.5.1". Release accepted DGM-146 with the
existing Windows ARM64/x64 portable formats, direct source delivery,
immutable builds, independent exact-package qualification and stable/latest
four-asset publication plus complete anonymous downloads. No installation,
old-release/tag mutation, dependency/security/CI change or Mac/Linux scope.
Current cursor: source preparation passed852 focused renderer tests,
92 desktop tests,7 checksum tests, typecheck/build/stage with no dependency
version drift. Accepted source is committed/pushed/read back on both refs at
`3dc7579db438f7c0780ebab03f8f29b6e79daec4`, tree
`7e638008a9b86f10db167c3927f7e3b342fb0631`. Both immutable Windows portables
are built/static-qualified under `p147-b1`: ARM64403613917bytes and
x64404466796bytes,47-file ASAR/stage and73-file payload equality.
Build handoff: `app/test-results/releases/0.5.1/build/14-static-build-handoff.json`.
Independent exact-portable acceptance passed ten general/MCP/routing/background
UI/export cells across both architectures, including live transparent MCP
outputs. Retain all original failures and adapter corrections.
Annotated numeric `0.5.1` points to exact3dc7579; four assets are published
stable/latest at https://github.com/vespassassina/AzureDiagramStudio/releases/tag/0.5.1.
Independent verifier12c3711b accepted all four complete anonymous downloads,
sidecar/source/tag/latest identity, five prior releases and nine prior tags.
Release431256718 and all ten public checks PASS; evidence is under
`app/test-results/releases/0.5.1/public-verifier-20261102-1017`.
README/manual/spec and [verification report](verification/DGM-147.md) record
the delivered state and native ARM64/emulated x64/unsigned limits.
Final factual documentation is delivered to both existing refs without moving
the immutable build tag. DGM-147 is complete.
Next: await an explicit PO request; no installation or next feature inferred.
Running installed0.5.0 and its profiles remain untouched.

**Latest PO priority,2026-10-31:** [DGM-146](specs/DGM-146.md), diagram
background choices and an Excel-style solid-colour palette/custom mixer.
PO approved White, Paper and Transparent presets, separate grid controls
and persistence/export parity. Source-only extension of Document properties;
no package/release/install/version/dependency/security change.
Current cursor: SOURCE ACCEPTED AC1-AC7 after repair1. First review's #fff
preset-state mismatch, low-contrast swatch selection and dark transparent
heading are closed by independent production-browser evidence. PO approved
the in-app RGB slider/numeric/hex mixer; real pointer/keyboard/hex sync, invalid
drafts/cancel/single history edit, JSON recovery and actual SVG/PNG exports
pass across desktop/narrow/short light/dark cells. Read-only/loading remain
focused-test coverage; no new packaged MCP host/native picker certification.
Typecheck/build pass; reports and first failures are preserved in
docs/verification/DGM-146.md. Parent inspected desktop-light/narrow-dark
screenshots. The implementer unexpectedly made local commitf4eeb5e despite
no-Git instructions; preserved without reset/amend. This was the source-only
acceptance boundary; the subsequent explicit DGM-147 request authorized source
delivery and0.5.1 packaging/publication, not installation.
Next: follow the DGM-147 cursor above; no follow-on feature is inferred.
DGM-144 is complete
and its running installed0.5.0 app and published assets remain untouched.

**Latest explicit PO priority, 2026-10-29:** [DGM-144](specs/DGM-144.md),
"compile and publish0.5.0", then install on this PC and report its location.
Prepare current approved source/version, immutable two-target Windows builds,
independent exact-portable qualification, stable public downloads and per-user
native ARM64 portable installation. Existing no-PR delivery policy applies.
No old tag/release mutation, new installer/dependency/security/CI or Mac release.
The DGM-143 historical MCP PNG timeout stays visible; fresh packaged gates
must pass and do not retroactively erase that failure. DGM-133 publication is
superseded by this new version request, not passed.

**DGM-144 current cursor:** PhaseA metadata0.5.0 prepared, no dependency drift.
Desktop85/85/checksums7/7/typecheck/build/stage pass; initial serial renderer
5910pass/3fail plus teardown and App fork-start errors blocks source sealing.
Directed harness repair1/3 COMPLETE: actual File/Commands menu navigation and
native chooser helpers replace obsolete Save/New/Document properties selectors;
readonly fixture now imports/recoveries real work instead of assuming populated
startup.36distinctfocusedtests pass across changed repair runs, including
App28/28 and icons5/5. Typecheck/build pass;36productoutputs byte-identical.
Old teardown/fork-start causes remain unproven; diagnostics retain their gates.
Fresh complete source requalification PASS:5941/5941 renderer tests in53/53
files, including App28; desktop85/85/checksums7/7/typecheck/build/stage PASS.
All product/stage outputs match phaseA; no dependency drift. Wrapper's first
exit1 was isolated to two parent-owned docs changing during the run, retained
and reconciled without rewriting the failure. No product/test/tooling drift.
Approved108-file source is committed and atomically pushed to feature/default:
`41f615345c0d5df8b55d99c6628eb379b356fb28`, tree
`e8d432666369a4b055bc36fc3ec2fb9fb2916581`; both remote refs read back exact.
Both isolated ARM64/x64 portables are built from that immutable commit:
403604764/404457642 bytes, unsigned, identical47-file ASAR. All15 build/static
commands accepted and protected outputs preserved; build owner terminal-free.
First independent ARM64 launch verifies actual runtime/security/ASAR identity,
but144-IV-01 chooser assertion observes a saved-blank reload, not pristine
navigation. Existing driver reloads unconditionally after DOMContentLoaded;
autosave/recovery explains why that observation cannot prove a chooser defect.
Directed observer corrections now prove pristine chooser/recovery and actual
inline-SVG artwork. Latest native ARM64 attempt accepts four general stages;
the export/clipboard stage stops before Copy image because the evidence driver
omits Electron's clipboard capability. Actual JSON/SVG/PNG/ZIP/Markdown files
were produced, but their enclosing stage is not accepted. No complete runtime
cell is accepted; x64/MCP/routing cells remain unrun.
The PO explicitly extended the three-correction limit for evidence-backed
adapter-only fixes and complete verification before publication. Attempt5
captures missing clipboard/dialog capabilities; 29 static assertions and
adapter syntax checks pass, but the actual ARM64 run still lacks
`clipboard.readImage`. Four stages pass and the clipboard stage remains
blocked; static capture assertions did not prove runtime API capability.
Actual Electron 44 has asynchronous clipboard read/write, not legacy image
methods. Existing desktop security denies browser clipboard writes; the
product's intended denial path saves a PNG. The PO explicitly chose to preserve
that policy and verify/document the PNG fallback instead of a product/security
change. Four independent MCP/routing cells in attempt8 all stop at stale
post-replay startup-dialog assumptions before exercising their actual gates.
Attempt9 runs all six cells once. ARM64 general reports 7/7 stages passed,
but direct history invariance after fallback needs supplemental evidence.
ARM64 routing fully passes 12 route cases and native cancellation/retry guards.
ARM64 MCP-output hits an observer missing `hash` import after ten HTTP200 calls.
x64 general/MCP stop at an initial-dialog state mismatch; x64 routing captures
12 routes then the domain-max post-cancel retry hits the unchanged 4000ms MCP
deadline with a worker still observed at failure (later closed).
All owned processes/listeners are closed; first receipts remain intact.
The PO explicitly chose to HOLD BOTH BUILDS and diagnose the x64 timeout.
Attempt11 setup overlapped confirmed Modern Standby; no dense dispatch occurred.
Attempt12's single instrumented retry completed in2755.6ms; original variance
remains unexplained. The PO subsequently APPROVED [DGM-145](specs/DGM-145.md):
only MCP arrangement receives the existing15000ms layout budget; all output/
other mutation deadlines remain4000ms and safety guards unchanged.
Implementation and independent source acceptance now PASS: owner desktop87,
renderer94/native5; independent desktop24 and renderer/native99 plus exact
all-tool clock-boundary probes. Only the broker changes production behavior;
renderer source and native15s cap are unchanged. Accepted source is committed
and atomically pushed/read back on both refs at
`5dc5a89c9a44da450d1b1d8ff70194b42ab045f5`, tree
`ac16092ad857768cf9a1eb47aa71943c6810a627`.
Both replacement targets are rebuilt/static-qualified in `p145-b1`:
ARM64403604863bytes/SHA`898dd593b59a4d041135b160d4247fdbe54fb3c6b16ca801cd9e2b26837100f2`;
x64404457743bytes/SHA`c5d813e220a2b68a960ddbfa2127beba1cf3d4d29bc9dee8a5a294c1a7206def`.
Both47-file ASARs match; all36 renderer outputs remain byte-identical.
Build owner is terminal-free. Parent rejected the first replacement adapter
packet: its navigation callback was not invoked and its post-replay Blank
selection masked the recovery assertion. Corrected `runtime-verifier-dgm145-r2`
attempted to use firstWindow, but its wrapper ran after the driver's existing
reload. Independent ARM64 general therefore stopped before its assertions;
the other five cells share that precondition and were not launched. The earlier
standalone proof did not exercise the same launch path and is not acceptance.
Parent traced the exact order: offlineWindow reloads before returning to the
common wrapper. R3 wires the real reload boundary; its six actual runtime
cells now report4PASS/2BLOCKED. ARM64 MCP/routing and x64 general/MCP pass.
ARM64 general is blocked by the10000ms WMI process observer. x64 routing
returns HTTP408 at5052.2ms: parent identified `mcp.mjs`'s separate5000ms HTTP/
socket timeout preempting the approved15000ms broker budget.
DGM-145 is reopened for the coupled transport repair: only authenticated,
fully validated arrangement may wait for its approved budget; all existing
ingress/idle/other request and output safeguards remain. Coupled HTTP repair
and independent AC1-AC7 acceptance now PASS: desktop91/91, renderer/native99/99,
real arrange>5000ms succeeds and a following request on the SAME socket
expires at5000ms with cancellation. Only the test client's keepalive buffer
was disabled to observe reuse; production policy is unchanged.
Accepted repair is committed/pushed/read back on both refs at
`5201cd746a3984a771889f1e6dbbb02b6c2a1c4f`, tree
`cda3b13497f61f32991818150ed4077167a8d135`.
Both targets are rebuilt/static-qualified in `p145-b2` from that commit.
ARM64:403605406bytes/SHA`5fd2c2bc43613957e191f33a4fb51b087393788d6c8118277d354e8abd230e55`;
x64:404458284bytes/SHA`38bd94e4c8f8925aff706d307573ac3d6bef9e337279d8e715fead6de78352f0`.
Both47-file ASARs match; only `electron/mcp.mjs` differs from B1 staged
inputs, and all36 renderer outputs remain identical. All15 build/static
commands are accepted; build owner is terminal-free. Handoff:
`app/test-results/releases/0.5.0/rebuild-dgm145-transport/handoff.json`.
Adapter owner ec4ec74c completed the actual R3 launch/reload observer rebind
in `runtime-verifier-dgm145-transport`; syntax/binding checks pass and no
runtime cell was launched by the owner. Independent verifier180455e6 ran
all six fresh exact-portable cells serially: ARM64/x64 general and MCP-output
PASS; both routing cells BLOCKED before routing assertions because fixture
paths resolve to absent files beneath the candidate app. Original fixtures
are present and hash-identified in the retained independent report.
Adapter owner ec4ec74c corrected fixture bindings in fresh routing packet
`runtime-verifier-dgm145-transport-routing-r2`, using the authoritative
handoff root and preserving original fixture hashes/bytes. Syntax and binding
checks pass; no routing runtime was run by the adapter owner. Independent
verifier180455e6 validated binding and ran only the two blocked routing
cells once, serially. Both pass12 routing cases, cancellation/retry and
output parity. Four passing cells are retained without repetition: final6/6
exact-portable cells PASS, report SHA
`578568a3ecff206fe3560620df5d0dc58018f8f604c7703ace6498fede9db533`.
Final cleanup confirms zero owned processes/listeners/errors.
No product/deadline/oracle change.
The prior ARM64 WMI timeout remains historical and
unexplained; no observer deadline change or qualification waiver.
5dc5a89 packages remain preserved but are not the complete release candidate.
No blanket timeout increase.
The two differing MCP JSON/ZIP outputs compare semantically equal except
independently generated document UUIDs; all other fields/Markdown match.
Old41f6153 EXEs and first evidence remain preserved.
Final packets accept observer corrections and direct fallback history coverage;
earlier missing coverage/failures remain preserved historical records. Original
deadlines, security and downstream assertions remain; no product change,
rebuild, gate waiver or unchanged favorable-sample retry is authorized.
No test/deadline/oracle relaxation, product speculation or unchanged full retry.
Accepted artifacts now have sealed provenance/checksums under
`app/test-results/releases/0.5.0/sealed-transport`. Annotated `0.5.0` points to
exact5201cd7; [release428859838](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/0.5.0)
is published stable/latest, with all four uploaded sizes/digests read back.
First draft readback by tag returned404; listing/release-ID readback verified
the intact uploaded draft, then publication resumed without retag/reupload.
Both first failure and successful continuation are retained. Independent
verifier180455e6 fully downloaded all four assets anonymously and accepted
sidecars/source/tag/latest/old-release preservation, report SHA
`13b3070c93cce6e172306424159c3715537a223e08e145effa3cbd21ccb8b1a2`.
Parent installed that verified native ARM64 public download at
`%LOCALAPPDATA%\Programs\AzureDiagramStudio\Azure-Diagram-Studio-0.5.0-win-arm64-portable.exe`
with versioned Start menu shortcut **Azure Diagram Studio 0.5.0**.
Installed bytes/hash and shortcut target/working directory/empty arguments
read back exactly; no elevation, old-version overwrite, launch, security
change or profile migration. Exact paths are in the ignored
`orchestrator/installation.json` receipt. This factual release/install closeout
is delivered to both existing refs without moving `0.5.0`; its Git operation
receipt records exact remote readback. Approved release/install queue complete.
Hand off the release URL and actual installed EXE path; stop here.
No next feature, rebuild, republish or automatic application launch is inferred.

Execute in order; skip only blocked dependencies, not acceptance criteria.
Update this table before every handoff with evidence and the exact next action.
The starting statuses below reconcile existing reports and session observations;
they are not fresh independent test results.

| Order | Work / current state | Owner and next action | Exit / automatic successor |
| --- | --- | --- | --- |
| 1 | [DGM-110](specs/DGM-110.md): AUTOMATED COMPLETE, verified 2026-10-14 | Independent [report](verification/DGM-110.md) records 458 tests, typecheck, build and browser gates with current coverage boundaries. Manual/native items remain separate. | No open source defect; do not requeue without new evidence. Continue 3. |
| 2 | DGM-110 repairs: CONDITIONAL on verifier findings | Scoped implementer fixes the named failing behavior or adds missing direct acceptance coverage in the existing spec allowlist, with RED/GREEN evidence. Verifier does not repair. | Automatically return to 1 for affected rechecks. Keep prior valid gates when inputs are unchanged; no PO prompt for an in-contract repair. |
| 3 | [DGM-116](specs/DGM-116.md): AUTOMATED COMPLETE, verified 2026-10-14 | Independent [report](verification/DGM-116.md) records 3/3 current generator tests, source/dist byte provenance and coverage limits. | No open asset defect; do not requeue without new evidence. Continue 4. |
| 4 | Sprint 4 local integration: AUTOMATED COMPLETE, independently verified 2026-10-15 | Independent [review](verification/sprint-4-review.md) records 5,488/5,488 tests, 36/36 files, zero failed/skipped, exit 0 after `S4-INTEGRATION-001` repair. The picker mounts 32 rows initially and expands without losing ranked keyboard/scroll choices. Typecheck/build, 32 catalog tests, 16 selected editor tests and 2 production-browser viewports pass. Attempt 1 / cycle 1 / local typing fix 1; original timeout and failures retained. | No open local source defect. Manual/review reconciled; continue completed row 5. Native/manual checks and historical performance coverage remain separate. Do not rerun completed work without new evidence. |
| 5 | [DGM-113 readiness packet](specs/DGM-113.md): DOCUMENTATION COMPLETE; bounded Windows ARM64 AUTOMATED PASS | Subsequent PO approval enabled isolated ARM64 packaging and independent native checks. [Cell report](verification/DGM-113-windows-arm64.md): 10 check groups, 3 sessions, 8 downloads, exit 0, protection PASS. Physical/human acceptance and other runtime cells remain BLOCKED. | No further ARM64 automated rerun or rebuild without new evidence. Remaining cells need their named owners/devices/policies/participants and any applicable bounded authorization. Missing prerequisites remain visible, never PASS. |
| 6 | Consolidated delivery: DELIVERED / ORIGINAL LOCAL QUEUE COMPLETE | [Sprint 4 review](verification/sprint-4-review.md), [readiness packet](specs/DGM-113.md) and the disposition below retain final passing evidence, historical failures, candidate provenance and the combined external decisions. The original approved local queue is complete. | Do not reopen completed baseline work. Later explicit approvals are recorded in rows 7/8; future runtime cells still need their named inputs/authorization. No platform/support promise, packaging, release or commit is inferred. |
| 7 | Subsequently authorized ARM64 publication: PUBLISHED / independently verified | PO requested "publish to github and next". [Publication report](verification/release-0.2.0-arm64.md): prerelease `arm64-v0.2.0`, ID 414118554, four uploaded assets, matching SHA256/size/readback and public download access. Stable v0.1.0 unchanged. Source branch/history were not pushed; attached candidate source ZIP is authoritative, not automatic tag archives. | Publication complete; do not upload or rebuild again. Next cells are physical/human acceptance and native x64/Mac/separate-browser qualification, blocked on their named participants/devices/policies/scope. No next feature sprint is authorized. |
| 8 | [DGM-117](specs/DGM-117.md): AUTOMATED COMPLETE / parent visual review PASS, 2026-10-16 | Separate implementer and verifier delivered question-mark Help and ten ordered anchored callouts. [Independent report](verification/DGM-117.md): 18 focused tests, typecheck, isolated production build, 16 browser groups and 60 viewport/theme/step geometry combinations pass; screenshots inspected. Drafts, selection, camera, panel intent and history are preserved. | Source preview http://127.0.0.1:5224/; Help is at the top of the left rail. No confirmed source defect. Published executables and their source ZIP are unchanged and do not contain this guide. Stop local work; physical/human/platform cells still need their named inputs. A current desktop rebuild/release requires separate bounded authorization. |
| 9 | Subsequently authorized source delivery: MERGED / PUSHED / TAGGED; independently verified 2026-10-16 | Existing default branch `feat/DGM-070-desktop-release` and annotated `source-v0.2.0-dgm117` resolve to merge `52f66306e09798b79d907e97f52c03ddada2e1ad`. [Independent receipt](../app/test-results/source-publication/20261016T070058473Z/verifier/verification-reconciled.json) confirms remote refs, candidate/merge tree equality, 2,744 unchanged inputs and clean worktree/index at handoff. No PR was created or merged. | Complete; do not repeat the merge, push or tag. Existing `v0.1.0` and `arm64-v0.2.0` refs/assets remain unchanged. The source tag avoids tag-based release publication. Merge [Mac CI](https://github.com/vespassassina/AzureDiagramStudio/actions/runs/38864999486) completed successfully at 07:09:33Z; [resume readback](../app/test-results/source-publication/20261016T070058473Z/resume-verifier/20261016T123607106Z-verification.json) confirms it without reruns. CI is not physical/human acceptance. Continue explicitly authorized row 10. |
| 10 | [DGM-113 current-guide ARM64 cell](specs/DGM-113.md#current-guide-windows-arm64-authorization---2026-10-16): AUTOMATED COMPLETE / parent screenshot review PASS | [Independent report](verification/DGM-113-windows-arm64-guide.md): source `52f6630`, 403,339,602-byte unsigned EXE, SHA256 `89eefd80ccfa78ef5ceb7fb366e980df05dd42d728d4476ae34db240023b9f8c`. Owner: 33 policy tests, 42 ASAR and 73 payload files pass. Actual ARM64 Electron 44: 10 general + 19 Help groups, 80 step/geometry cases and 3 live-resize checks; 6 sessions, 8 downloads, all 12 tracked processes exited; final protection PASS. Retained helper failures are resolved, not discarded. | Hand off the [exact local EXE](../app/test-results/platform/windows-arm64/20261016T130515040Z/candidate/app/release/Azure-Diagram-Studio-0.2.0-win-arm64-portable.exe) for DGM-113's human acceptance. Stop automated work; no rerun/rebuild without new evidence. Native desktop/short-window and 390px CDP coverage are distinguished in the report. Physical offline, policy, dialogs/IME/clipboard, Teams/Office and novice/device checks remain blocked. No publication/signing/commit/PR or other target inferred. |
| 11 | [DGM-118](specs/DGM-118.md): AUTOMATED COMPLETE / visual review PASS | [Integrated report](verification/DGM-118.md) records actual pointer/Enter/Space component deletion, incident-link cleanup and exact one-Undo, four preserved quick-add directions, desktop/mobile light/dark hit testing. Owner RED/GREEN and initial 40 focused/294 Editor checks remain retained. | Complete; source preview http://127.0.0.1:5224/ and the separately approved local DGM-121 package include the button. No additional rebuild or Git/publication inferred. |
| 12 | [DGM-119](specs/DGM-119.md): AUTOMATED COMPLETE / attempt 1, repair cycle 1 | [Independent report](verification/DGM-118.md) closes DGM119-VER-001/002/003 with exact physical Escape/release document/geometry/history recovery, active reconnection/library drag and next-gesture/Undo checks. [Final receipt](../app/test-results/editor-interactions/20261016T152504281Z/verifier-recheck-cycle1/final-verification.json): 167 selected tests, both typechecks, fresh isolated build, nine affected browser groups PASS. Original failures and passing menu/handle/tooltip checks retained with dated coverage boundaries. | Complete; no unchanged full-matrix rerun. Parent inspected post-cancel, active reconnect and context-menu screenshots. Human/native/touch/OS-zoom acceptance remains separate; prior package/release unchanged. |
| 13 | [DGM-120](specs/DGM-120.md): AUTOMATED COMPLETE / visual review PASS | [Integrated report](verification/DGM-118.md) records five-color freehand/Shift rectangle/Alt ellipse/Ctrl arrow pixels, local history/cancel, exact document/export invariants, pan/zoom, read-only, fullscreen and responsive controls. Owner full 417 checks predate capture-only repair; final 167 checks/rechecks are stated separately. | Complete in source and the separately approved local DGM-121 package; markup remains temporary. No extra feature, rebuild or publication follows automatically. |
| 14 | [DGM-121](specs/DGM-121.md): LOCAL PACKAGE ACCEPTED / NORMAL APP OPEN / FINAL SOURCE MILESTONE | Source merge `15a3438` is pushed; harness-only follow-up `9b99e9b` does not change packaged inputs. [Report](verification/DGM-121.md): exact 403,360,240-byte EXE SHA256 `94e6cf183dd36e4577b99ab55957b7f8a7c9b0fbb61021a6e0fc2bab22c2baeb`; 10 general groups (nine dated + one fresh), 10 fresh targeted groups, cycle-2 driver observation/cleanup PASS with original failures retained. New normal window PID30304 has the accepted ASAR and fresh persistent profile. | Deliver final documentation and annotated `source-v0.2.0-dgm120` directly, without PR; verify remote refs/clean tree and leave new PO app running. Thereafter stop approved work. Old PID31104 exit/unsaved state remains UNKNOWN; no old-profile access/reopen, binary upload, signing or human/platform acceptance claim. |
| 15 | [DGM-122](specs/DGM-122.md): AUTOMATED COMPLETE / visual review PASS | [Independent combined report](verification/DGM-122.md): 51 selected tests, both typechecks, isolated build, 25 description browser groups; 20,000-character inert Markdown source/native JSON/storage/history/guards pass, with exact SVG/PNG parity and legacy omission. Owner foundation evidence remains dated. | Complete; Document properties -> Architecture description (Markdown) in http://127.0.0.1:5224/. DGM-124 subsequently adds sanitized Preview and shared sidebar without changing the saved-field contract; no strict skill-format extension, migration or old-package update. |
| 16 | [DGM-123](specs/DGM-123.md): AUTOMATED COMPLETE / visual review PASS | [Independent report](verification/DGM-122.md): seven Learn adaptations plus original four, 72 starter/Blank selections across six viewport/theme cells, eleven previews, seven detailed exports, literal guides/references/fresh copies/keyboard and geometry pass. Owner 695/8-file test slice is dated, not repeated independently. Parent inspected all seven diagrams, mobile chooser and description. | Approved source queue complete; preview http://127.0.0.1:5224/. Manual and source limitations reconciled; detailed evidence/first failures retained. Existing normal app/profile, packages, tags and public releases unchanged. New commit/push/tag, native rebuild or publication needs separate authorization; human/platform cells remain separate. |
| 17 | [DGM-124](specs/DGM-124.md): AUTOMATED COMPLETE / parent visual review PASS | [Independent report](verification/DGM-124.md): 52 focused tests, both typechecks, one isolated build, 51 accepted browser groups across desktop/mobile/short light/dark; hostile/no-network preview, shared draft/Undo and selected context, pointer/keyboard resize/cancel/collapse/reopen, Present/fullscreen/ink/restoration and exact JSON/SVG/PNG checks pass. Owner 418+37 gates retained as dated evidence. Only marked18.1.0 with license/notice added; no old dependency drift/security-policy change. | Approved source queue complete; preview http://127.0.0.1:5224/. Parent inspected editing/Present/fullscreen/mobile/hostile screenshots and reconciled manual/specs. Preserve existing normal app/profile, packages and tags. New Git delivery, native rebuild or publication needs separate authorization; no platform/human acceptance implied. |
| 18 | DGM-122/123/124 authorized direct source delivery: DELIVERED SOURCE SNAPSHOT | Feature `97efbb8` and source merge `58448ff` contain the exact 33 accepted source/example/dependency/license inputs and seven accepted documents. Source merge and feature branch are pushed; source milestone [source-v0.2.0-dgm124](https://github.com/vespassassina/AzureDiagramStudio/tree/source-v0.2.0-dgm124) additionally identifies this documentation-only closeout. [Retained operation recorder](../app/test-results/source-publication/20261017T121719646Z/git.mjs) preserves first command outputs/input identity. | Verify final origin default and peeled annotated tag agree and worktree/index are clean, then stop approved work. Existing binaries and older tags/assets are unchanged. Native rebuild, public binary delivery, signing and human/platform qualification remain separate explicit tasks. No PR. |
| 19 | [DGM-125](specs/DGM-125.md): FINAL WINDOWS RELEASE PUBLISHED / PUBLIC DOWNLOAD VERIFICATION PASS | [Stable/latest release](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/windows-v0.2.0), ID416002142, is not draft/prerelease. Annotated tag peels to exact repair source `7783b384e5a46160bdd340112c924f019e0c7830`. Independent [public verification](../app/test-results/releases/windows-v0.2.0/20261017T125954543Z/repair-cycle1/public-verification/20261017T191118217Z/public-verification-final-handoff.json) fully downloaded all four assets (807,858,504 bytes), matching sealed SHA256; older releases/assets/refs unchanged. Both native/emulated runtime gates pass, cycle1 closed, historical failures retained. | Requested release delivered; do not rebuild, retag, republish or repeat passing gates. README/manual/report identify final assets and unsigned/native-ARM64/emulated-x64 limits. Seven retained local text files have unexplained modification-time drift with identical bytes/hashes; failed metadata check remains visible, not PASS, and timestamps are not restored. No artifact/source/remote integrity mismatch or new product blocker; human/other-platform qualification remains separate. |

### PO-Requested Source Follow-Ups - 2026-10-28

The PO requested these source changes while testing the local 0.4.0 app.
They do not change DGM-133's immutable source/artifacts or waive its blocker.
Shared files and terminal work remain serial.

**Current disposition (2026-10-28): DGM-137 STRICT-STACKING REPAIR AND
DGM-140/141 COMPLETE / INDEPENDENT SOURCE ACCEPTANCE PASS.** The PO-reported
staggering is repaired with real-ELK constraints/rerouting, exact root/nested
alignment and uniform root gaps. Earlier order-only acceptance remains bounded
history, not proof of the strict requirement.
Fresh independent evidence:
`app/test-results/dgm137-141-independent/20261028-1223`.
722 renderer/85 desktop tests, typecheck/build, 132 Help geometry records,
six authenticated HTTP layouts and 48 additional complex browser/Electron
arrangements pass; exact shared-axis drift is zero. Root/Favorites/MCP/export
regressions, physical off-stroke edge hits and 24 zero-difference SVG/PNG
comparisons pass. First verifier/precondition failures retained; no product
fixes by verifier. All 17 verifier-owned Electron PIDs exited.
Other source follow-ups remain accepted, not requeued.
Evidence: `app/test-results/dgm134-139-independent/20261028-01/`; 674 renderer
and 85 desktop tests, typecheck/build, six-cell browser/Electron checks, four
HTTP arrangements, three-lifetime persistence and 22 independently decoded ZIPs.
Supplemental actual-toggle checks cover dark theme restoration where the
original harness's attribute-only setup was insufficient. Six verifier-owned
Electron PIDs exited; source hashes unchanged. Native dialogs were mocked;
physical/external-client/release acceptance is not claimed.

The earlier corrected ordinary-source desktop preview was opened with
responding window PID14440. Fresh manual profile `.manual-menus-20261028134807`;
launch receipt inside that profile. Source:
`app/test-results/v141i/app/test-results/stack/source-app`.
Main/renderer hashes were checked against independent preview identities before
launch. Leave it open for the PO; never confuse it with the unchanged 0.4.0
portable. Earlier PID56200/profile `.manual-fixed-20261028111954` and user work
were not accessed or stopped by this correction/launch.
No commit/push/package/publication was performed. The PO approved saving the
inferred UI rule as repository design and global agent guidance:
[convention](ui-design.md), repository AGENTS.md and the existing user-global
agent instruction file are updated; [decision](decisions.md#2026-10-28-canonical-ui-placement-and-explicit-state)
records authority. Exact next action: PO inspects the corrected open preview
and supplies feedback. No automatic successor, release rebuild or publication;
DGM-133 remains separately blocked.

**Subsequent PO feedback: DGM-142 routing repair, now independently accepted.**
The PO accepts improved group alignment but rejects long rectangular connection
detours and crowded routes shown in the Fabric starter screenshot.
[DGM-142 investigation](verification/DGM-142.md) reproduces exact
`examples/fabric-onelake.json`: ELK track reserves and preallocated proxies
produce the long excursions; standard DOWN also has header-band crossings.
Three bounded existing-constraint candidates failed and were not promoted.
At that historical checkpoint production strict stacking was unchanged and
new quality tests were3 RED/1PASS,
while220 existing tests/typecheck/build pass. Four owned test PIDs exited.
**DGM-142 bounded source acceptance:** independent automated PASS, cycle2/3;
cycle3 unused. Subsequent PO screenshot rejects oversized group envelopes;
see the new DGM-143 active cursor below.
Final independent149tests/typecheck/build, unchanged12UI/12HTTP aggregate and
296route audit pass. Fresh native completion/error/cancel/15-second deadline
controls reach zero targets before browser attachment, while attached and after
disconnect. Pinned bundledELK executes inside one cancellable native jobworker;
bounded compatibility adapter independently reviewed. All296 routes and entity
geometry remain exact; no zero-worker waiver or old-target benign claim.
Earlier cycle1 lane/observer,454preservation/22desktop/sixcell evidence remains
historical, not a newly rerun broad suite. App failclosed policy unchanged.
Frozen group geometry remains intentional.
Corrected preview was **OPEN / RESPONDING**, PID7868, fresh profile
`.manual-routing-20261028174419`, exact independently tested source:
`app/test-results/dgm142-worker-cycle2-independent-20261028-1732/runtime/source-app`.
Main/renderer/worker hashes verified before launch; launch/readiness receipts
retained in that evidence root. Previous PID14440/profile/unsaved work untouched.
The detached PID7868 launch subsequently exited normally with code0; its
profile and receipts remain preserved, with no automatic relaunch.
No automatic successor, rebuild, commit/push or publication. DGM-133 remains
separately blocked; no additional diagnostic cycle is authorized here.

**Active cursor:** [DGM-143 content-sized groups](specs/DGM-143.md), PO-APPROVED
LAYOUT PREVIEW EXITED NORMALLY / FULL QUALIFICATION BLOCKED143-IV-01.
PO explicitly approves compacting groups and rerouting, changing
the earlier frozen-dimensions rule. Screenshot shows large empty top regions;
source still includes provisional ELK route points in stacked group envelopes.
Fit real child/header bounds and compact root gaps before canonical routing;
preserve exact stack axes, hierarchy, component sizes, explicit ports and
history/worker/error guards. Pre-GREEN Fabric margin/gap bounds are in the spec.
Owner75distinctfocusedtests/typecheck/build,12UI/12HTTP/296routes and native
completion/error/cancel/deadline zero-worker controls pass. Fabric measured
top/bottom margins42/24px; equal root gaps100px, before/after same-scale
images inspected. Discarded proxy routing no longer expands envelopes.
Independent75tests/typecheck/build, compactness/standard-preservation/source
review and nativecleanup pass. First fresh aggregate completes6UI/6HTTP cells
then complex RIGHT-stacked PNG export hits the existing4000ms MCP deadline,
immediately after a successful same-state PNG snapshot. No renderer errors or
live workers; focused3pair controls succeed but do not explain/erase timeout.
Later output cells and aggregate retry tail remain independently unqualified.
Retained296owner routes independently audited, not a fresh full-aggregate PASS.
Bounded owner timing/export/broker diagnosis concluded without reproducing
the original failure or identifying a justified repair; no source changes.
One nonfailing1033ms PNG callback wait was observed while heartbeats continued,
not proof of the original timeout's cause. All2452 original manifest entries
remain unchanged. No unchanged full rerun, oracle waiver, raised deadline or
assumed layout/environment cause.
PO explicitly selects opening the layout preview while PNG qualification
stays blocked. This overrides only preview sequencing, not technical acceptance.
Preview was opened/responding as PID42048, fresh `.manual-compact-20261028202422`,
tested ordinary source `app/test-results/dgm143-iv/runtime/source-app`;
main/renderer/worker/source identities verified before launch.
In this fresh preview only, actual New/Fabric and Horizontal groups stacked
vertically were chosen, then Fit diagram. Canvas image shows compact groups
and aligned stack at46%; earlier PO windows/profile/unsaved work untouched.
The detached launch subsequently completed with exit0; the preview is no longer
open. Its profile and receipts are preserved; no automatic relaunch.
Exact next action: await PO feedback or an explicit reopen/further diagnostic
request. Export failure/missing cells remain recorded; no automatic speculative
fix, retry or publication.

| Work / current state | Owner and next action | Exit |
| --- | --- | --- |
| [DGM-134 top-bar application controls](specs/DGM-134.md): COMPLETE / INDEPENDENT SOURCE PASS | [Report](verification/DGM-134.md): controls, guards, six viewport/theme cells and real-theme restoration accepted. | Shown in current-source preview; no package claim. |
| [DGM-136 diagram + Markdown exports](specs/DGM-136.md): COMPLETE / INDEPENDENT SOURCE PASS | [Report](verification/DGM-136.md): plain image exports, companion-Markdown ZIP and standalone embedded-PNG Markdown accepted with independent decoding. | UI and MCP share output helpers; no release change. |
| [DGM-137 sidebar and Auto-arrange](specs/DGM-137.md): COMPLETE / STRICT-STACKING INDEPENDENT PASS | [Report](verification/DGM-137.md): exact shared axes/gaps/nested direction, routes/ports/labels/containment/annotation and Undo accepted in six HTTP and48 additional complex arrangements. Original weaker oracle/failures retained. | Corrected preview open; no dependency/schema/release change. |
| [DGM-135 MCP snapshot/exports](specs/DGM-135.md): COMPLETE / INDEPENDENT SOURCE PASS | [Report](verification/DGM-135.md): create/arrange/inspect/edit/export HTTP flow, guarded tokens/IPC, PNG/SVG/native JSON/Markdown/ZIP bytes accepted without file dialogs/downloads. | No actual external-client interoperability or release claim. |
| [DGM-138 saved workspace root](specs/DGM-138.md): COMPLETE / INDEPENDENT SOURCE PASS | [Report](verification/DGM-138.md): root persistence/restart, stable default destinations and failure handling accepted with owned temp roots; MCP remains in-memory. | Native dialog selection mocked; no existing-data migration or human-native qualification. |
| [DGM-139 persistent Favorites category](specs/DGM-139.md): COMPLETE / INDEPENDENT SOURCE PASS | [Report](verification/DGM-139.md): category/search/empty state, persistence across reload/restart and storage failures accepted without diagram/history changes. | No shared-root sync or diagram-schema change. |
| [DGM-140 top File/View/Settings menus](specs/DGM-140.md): COMPLETE / INDEPENDENT SOURCE PASS | [Report](verification/DGM-140.md): actual menu/file/View/dialog workflows, bottom-only status and save errors, all11 Help steps and affected draft/focus/Present guards accepted across browser/Electron theme/viewport cells. | Corrected ordinary-source preview open; no release change. |
| [DGM-141 lines and paper workspace](specs/DGM-141.md): COMPLETE / INDEPENDENT SOURCE PASS | [Report](verification/DGM-141.md):2.1px normal connections, unchanged20px hit path, #faf8f3 unspecified light workspace accepted with actual hits/appearance and zero-difference SVGPNG comparisons; custom/export backgrounds/dark preserved. | No document migration or release change. |
| [DGM-142 compact connection routing](specs/DGM-142.md): COMPLETE / INDEPENDENT AUTOMATED PASS | [Report](verification/DGM-142.md): cycle2/3 accepted;149tests, unchanged12UI/12HTTP/296routes and native completion/error/cancel/deadline zero-target controls pass. Aligned geometry unchanged; cycle3 unused. | Exact verified source preview open for PO feedback; no release or other-platform claim. |
| [DGM-143 content-sized groups](specs/DGM-143.md): PREVIEW EXITED / QUALIFICATION BLOCKED143-IV-01 | [Report](verification/DGM-143.md): sizing/tests/nativecleanup pass; firstfresh MCP PNG timeout unclassified after bounded diagnosis, no justified patch. PO authorized preview only, not a PASS. | Await PO feedback. Missing native output cells/tail remain unqualified; no deadline/oracle waiver or automatic retry. |
| Show fixed app: COMPACT LAYOUT PREVIEW LAUNCHED / EXITED NORMALLY | Inspection-only source preview PID42048 subsequently exited0. Fresh `.manual-compact-20261028202422`, identities/launch/readiness and prepared Fabric state preserved; earlier user work untouched. | Do not relaunch unsolicited. PNG qualification and publication remain separately blocked. |

### Post-Release Acceptance Continuation - 2026-10-19

These rows are the next execution cursor after completed row 19. Historical
delivery instructions above are not a request to repeat source/release work.

| Order | Work / current state | Owner and next action | Exit / automatic successor |
| --- | --- | --- | --- |
| 20 | DGM-113/DGM-125 qualification-summary reconciliation: DOCUMENTATION COMPLETE | Orchestrator updated the readiness header/matrix and release-report current status to point to the final DGM-125 evidence; historical failures and timestamp-only warning retained. | Documentation only; no new runtime PASS. Continue independent ready cells below. |
| 21 | Formal participant trials: REMOVED BY PO; colleague feedback OPTIONAL / NOT A GATE | PO will share the existing release independently. No recruitment, timed novice session, scoring or observed Teams/Office trial is queued. Capture actionable feedback if supplied, following the [continuation](specs/DGM-113.md#acceptance-continuation---2026-10-19). | No waiting for participants or feedback required. Historical usability/Office acceptance remains unverified, not passed. |
| 22 | DGM-113 native Intel/AMD Windows x64: BLOCKED / NOT RUN | Platform owner supplies authorized native x64 device and named operator. Independent verifier uses the existing published x64 EXE/hash, fresh owned profiles and applicable AC113 cases; current evidence is emulated only. | Native evidence closes only this cell. No rebuild, Mac qualification or broader support claim inferred. |
| 23 | Next product outcome: PO PRIORITY PROVIDED (DGM-126/127) | PO explicitly requested About/current guidance, then unified New/template selection with empty default startup. Execute rows 24/25; optional colleague feedback may identify later defects. | No invented sprint. Feedback and native-x64 evidence remain separate from these approved source tasks. |
| 24 | [DGM-126 About and current guidance](specs/DGM-126.md): COMPLETE FOR APPROVED SOURCE SCOPE | About/current README/manual/ten-step Help delivered. Owner RED/GREEN and build evidence retained; independent [report](verification/DGM-126.md) records selected acceptance passing in six theme/viewport cells, with remaining guard/draft variants attributed to owner tests. Earlier denials remain history. | PO reviews completed local source. No existing-EXE About, packaging/signing/publication or Git delivery claim. |
| 25 | [DGM-127 unified New/startup picker](specs/DGM-127.md): COMPLETE FOR APPROVED SOURCE SCOPE | Fresh empty/default Blank and unified chooser implemented; saved work recovers unchanged. Recovery-fit RED1/GREEN511 editor/app checks, typecheck/lint/build and helper3/3 pass. Independent [report](verification/DGM-127.md) records six-cell selected browser PASS, narrow recovery without Fit and later camera preservation. Its closeout retained a baseline catalog failure, subsequently repaired/verified in row26. | Completed UI work is not requeued. Legacy standalone sample-start runners and native/signing limits remain distinct from the subsequently passing foundation command. No new delivery/package/release action inferred. |
| 26 | [DGM-128 catalog browser connection selection](specs/DGM-128.md): COMPLETE / INDEPENDENT SOURCE-HARNESS PASS | Real canvas deselection and supported hit-tested label/stroke selection retain exact route assertions. Independent [report](verification/DGM-128.md): regressions3/3 and complete unfiltered foundation exit0 on first invocations; 2,414 product/build/package files, 48 accepted-candidate entries and 405 historical evidence files preserved. Original failures retained. | Approved local queue complete; PO reviews local source/harness changes. No further ready approved item, source delivery, dependency, native package, signing or release change. |
| 27 | [DGM-129 commit/merge/push](specs/DGM-129.md): COMPLETE / SOURCE DELIVERED | All32 intended files committed as `1191dc4`; default merge `f752791` has the exact source tree `35ea7a9`. Atomic push and live remote readback passed; isolated merge worktree removed and main checkout untouched. This documentation closeout follows on both branches. | Final branch-tip/clean-tree/tag-preservation readback retained under `app/test-results/source-publication/dgm129-20261019/`. Approved delivery complete; no PR/tag/release/binary rebuild or CI-policy change. Normal branch CI and native/signing qualification remain separate. |
| 28 | [DGM-130 version 0.3.0 Windows release](specs/DGM-130.md): COMPLETE / STABLE PUBLIC RELEASE VERIFIED | [Release0.3.0](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/0.3.0) tag peels to exact pushed source96c3e3f. Both unsigned portables passed static and independent targeted/general runtime gates (nativeARM64/emulatedx64,14sessions16exports). Complete anonymous downloads matched; corrected sidecars independently passed cycle1, retaining original provenance-content failure and unchanged EXEs. Old tags/releases/assets/bodies preserved. [Report](verification/DGM-130.md). | Approved release complete. Final factual docs pushed on both branches after immutable tag, no product change. Use matching x64/ARM64 download and JSON backups; no extra build/tag/upload or invented next sprint. Signing/nativeIntelAMD/human-policy limits remain separate. |
| 29 | [DGM-131 always-on local MCP](specs/DGM-131.md): COMPLETE / INDEPENDENT SOURCE ACCEPTANCE PASS | [Independent report](verification/DGM-131.md): 603 tests, typecheck/build and 17 real source-Electron groups pass against 150 fingerprinted inputs. Nine tools include create/edit/arrange/Undo/Redo through the live canonical session; atomic history/autosave, stale-state/draft/lock protection, Settings copies, loopback fallback/second instance and delayed-confirmation expiry pass. Owner first failures retained. | Source implementation and docs complete; hand off local changes. No open source defect or further approved ready task. No dependency/client-config/service/release changes. Existing 0.3.0 downloads unchanged; actual Claude/Copilot/Scout interoperability and new packages are unclaimed separate work, not automatic successors. |
| 30 | [DGM-132 version 0.4.0 source delivery](specs/DGM-132.md): COMPLETE / REMOTE REFS VERIFIED | [Report](verification/DGM-132.md): 36 intended files committed, merge `d79c0aa` pushed atomically to both intended branches with annotated [0.4.0](https://github.com/vespassassina/AzureDiagramStudio/tree/0.4.0). Package/root lock version 0.4.0; 76 desktop/checksum + 3 Settings + 15 About tests, typecheck/build pass. Older tags unchanged; isolated merge worktree removed and main checkout untouched. | Final factual docs closeout follows on both branches without moving the tag/product. Approved source delivery complete; no binary release, signing, client registration or further automatic successor. Existing Windows downloads remain 0.3.0. |
| 31 | [DGM-133 Windows 0.4.0 downloads](specs/DGM-133.md): BUILT / PUBLICATION BLOCKED, 2026-10-28 | [Report](verification/DGM-133.md): exact tagged unsigned portables structurally pass; native ARM64 general (10 groups) and both packaged MCP targets (13 groups each) pass. Emulated-x64 general timed out awaiting startup Open JSON filechooser; cause unresolved. Three harness corrections plus PO-authorized fourth diagnostic cycle concluded. Both targeted chooser probes passed, but did not reproduce or explain the original failure; no corrective adapter or full x64 acceptance claimed. All failures/profiles retained, zero owned processes remain. | Further diagnostic authorization required for pre-render startup timeline/actionability capture under unchanged deadlines, then evidence-backed correction and independent x64-only general acceptance. Do not retry unchanged full tests for a favorable sample. Reuse passing cells and unchanged EXEs; no rebuild, relaxed criteria or publication while blocked. After acceptance: seal final provenance/checksums, draft then stable/latest publication, independent full anonymous downloads and factual docs delivery. Preserve old assets/profiles/tag; no native-IntelAMD/signing/client-registration claim. |

DGM-109 and DGM-111 already have independent reports; they are not new
implementation tasks. DGM-112's desk investigation is complete, not an invitation
to repeat it. DGM-116 is approved Sprint 4 work, not a new sprint by itself.
Historical packaged executables do not represent current source features.

### 2026-10-15 Consolidated Disposition

This source-queue handoff predates the subsequently authorized ARM64 execution
recorded below; its original no-packaging/no-native-result boundaries are historical.

- **Current final gate: PASS**, after the concrete picker-mount repair:
	5,488/5,488 tests, 36/36 files, zero failed/skipped, exit 0, 177.04s.
	Exactly one unfiltered post-repair `npm test -- --maxWorkers=1` ran in the
	validated snapshot from 13:09:23.295Z to 13:12:21.568Z.
	[Retained final run](../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/full-source-result.json).
	Independent typecheck/build and focused tests pass; production Edge passed
	1440x900 and 390x844, all 696 choices by keyboard/physical wheel, batch-boundary
	focus, cancel/reopen/search and four insertion/Undo cases per viewport.
	[Browser handoff](../app/test-results/sprint-4-verifier/integration/20261015T141049067Z/localtypingfix1-recheck/browser-oracle-v03/handoff.json).
	All 18,833 candidate inputs match before/after; original dist is unchanged.
	The repaired snapshot build has a separate recorded identity. No current
	native/platform, full DGM-110 browser or stress-performance result is inferred.
- **Initial failed gate (preserved):** one unfiltered
	`npm test -- --maxWorkers=1` in an isolated, hash-matched source/dependency
	copy. 5,485 passed / 1 timeout / 0 skipped, 35 passed / 1 failed files,
	exit 1, 418.69s. [Retained first run](../app/test-results/sprint-4-verifier/integration/20261015T092052957Z/execution-result.json).
	The original 18,858 inputs, 7,169 earlier evidence files and dist were
	unchanged. Fixed browser-test output paths required isolation; no tests were
	excluded or assertions changed.
- **S4-INTEGRATION-001, CLOSED, attempt 1 / cycle 1 / local typing fix 1:**
	two added RED/GREEN regressions protect bounded mounting, full-ranked
	navigation, scrolling and reset; the original 5,000ms timeout is unchanged.
	The following diagnostic record predates the repair: connected-picker
	Escape/reopen/APIM/Enter test times out at its unchanged 5,000ms limit.
	[First diagnosis](../app/test-results/sprint-4-owner/integration/20261015T111408513Z/diagnosis.json)
	found no standby events and rejected query-scoping as the dominant cause.
	[Stage diagnosis](../app/test-results/sprint-4-owner/integration/20261015T112855710Z/diagnosis.json)
	measured two 696-row opens as 62.3% of measured stages; instrumentation and
	unmeasured scheduling/GC prevent claiming root-cause closure. Unchanged
	diagnostic passes are not repaired GREEN or independent acceptance.
- **Reused, not freshly rerun:** DGM-109/111/110 scoped automated acceptance
	and DGM-116 asset evidence retain their dated coverage limits. Current
	implementation/dist and brand byte comparisons match. Sprint 3's full
	performance results remain historical, not a fresh Sprint 4 performance PASS.
- **Delivered:** independent Sprint 4 recap, factual manual corrections and
	the expanded existing DGM-113 readiness packet. The repair changes only
  `CatalogAccordion.tsx` and its colocated tests. Dependencies/config, security,
  release, user profiles and port 5207 are unchanged. No remote publication
  check, desktop packaging or commit was performed.
- **Combined external decisions:** PO adopts/narrows platform/browser/OS
	minima and delivery requirements; assigns native ARM64/x64/Mac devices,
	qualification owners, policies and Teams/Office/novice participants; approves
	a specific current candidate and any bounded packaging/runtime actions;
	decides whether signing/notarization is required/funded. These do not block
	an otherwise justified in-contract source repair. No platform, support or
	release acceptance follows from the local documentation delivery.

## Autonomous Defaults

### Publication And Exact Next Action

2026-10-16 source follow-up: DGM-117 is independently verified and its parent
visual review passed. The local source preview at http://127.0.0.1:5224/ includes
Help and the ten-step guide. This does not update the sealed published candidate,
its executable/source ZIP or its native test result. The historical 5,488-test
integration result predates DGM-117; current guide evidence is the focused and
production-browser coverage in its [report](verification/DGM-117.md).

Source delivery subsequently completed at merge `52f6630`, published as the
annotated source-only milestone [source-v0.2.0-dgm117](https://github.com/vespassassina/AzureDiagramStudio/tree/source-v0.2.0-dgm117).
The existing default branch is `feat/DGM-070-desktop-release`; no `main` branch
was introduced. The merge tree equals the accepted candidate tree. Independent
readback passed; no PR, existing-tag replacement or manual asset upload occurred.
This source tag contains the guide, unlike the older sealed ARM64 release ZIP.

The source merge's existing macOS build completed successfully on 2026-10-16
at 07:09:33Z, confirmed by one read-only resume check. This closes the earlier
"still running" observation; no workflow was rerun and no physical Mac,
Gatekeeper, human usability or new Windows package acceptance is inferred.

The PO's later publication request authorized the verified artifact's release,
not additional platform support or signing. With the PO unavailable for the
source-push/CI decision, the conservative route published an ARM64-only unsigned
prerelease at [arm64-v0.2.0](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/arm64-v0.2.0),
`2026-10-15T18:41:10Z`, without a branch commit/push or a `v*` tag push.
The tag anchors remote base `a835c23d30eb4b8bf4c9995ab165b3d1013709ef`,
not the verified local candidate. Exact candidate source is the attached ZIP,
with public per-file provenance and checksums. Automatic tag archives are not
equivalent. Post-publication local documentation is not part of that sealed ZIP.

Independent publication verification passed all four asset metadata/hash checks
and public HEAD checks; fresh source ZIP, provenance and checksum downloads
matched. No fresh EXE download or native retest was claimed. v0.1.0 remains
unchanged and latest stable. No candidate Actions run was observed through
18:45:27.414Z; this is a bounded observation, not a future CI guarantee.
Publisher envelope and draft-discovery repairs closed after two cycles; draft
and historical failures remain retained. [Full evidence](verification/release-0.2.0-arm64.md).

Exact next action: human/device owners supply physical offline and downloaded-file
SmartScreen/policy observations, actual dialogs/IME/clipboard, Teams/Office
recipient and novice trials, or assigned native x64/Mac hardware and browser
targets. Each blocked cell is specified in DGM-113. Do not substitute simulations,
redo passing automated gates or invent a feature sprint while those inputs are
missing. Source-branch publication and the separately approved current-guide
local Windows ARM64 package/native cell are complete. The exact local EXE and
checksum are in row 10 and the [manual](manual.md#local-current-guide-arm64-candidate).
Its guide is packaged and natively checked; the prior public release remains
unchanged. The next action is the named human/device acceptance, not another
automated rerun. Release publication, signing and broader support remain
explicit future decisions; a generic "resume" does not authorize them.

### Newly Authorized Windows ARM64 Work

PO disposition after the completed local queue: "approved, go" authorizes the
bounded Windows ARM64 package/native test recommended at handoff. It does not
authorize publication, signing, new support promises or other native targets.
The [cell contract](specs/DGM-113.md#windows-arm64-authorization---2026-10-15)
records the current uncommitted candidate, local native host and isolation rules.

| Work | Current owner/state | Exact next action / exit |
| --- | --- | --- |
| Windows ARM64 local artifact | OWNER PACKAGE GREEN; exact artifact independently verified | [Cell report](verification/DGM-113-windows-arm64.md) records 0.2.0 unsigned artifact, SHA256 `2ae7d752b5d8fd17766912521d3b74efe7393150d44a1ffd3a534a8f20a066df`, 403,328,830 bytes; all 42 ASAR files match staged inputs. Portable bootstrap is x86; embedded Electron is ARM64. Corrected harness has 12/12 shell and 33/33 policy checks. No rebuild, signing or publication followed the harness-only repair. |
| Windows ARM64 native verification | AUTOMATED PASS; protection audit PASS | Single corrected run 16:46:54.675Z to 16:48:42.599Z, exit 0: 10/10 check groups, 3 sessions, 8 downloads, all 8 tracked processes exited. Actual packaged Electron 44.0.0 ARM64, sandboxed local origin, assets/worker, exports and autosave/move/relaunch checks passed. [Run result](../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/run-result.json), [audit](../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/post-run-audit.json). `DGM113-ARM64-001` CLOSED at attempt 1 / cycle 1: Enter explicitly commits the title; Tab into New diagram correctly preserves a draft. First failed run and audit remain retained. No active qualification terminal or owned app process remains; do not repeat completed gates. |
| Human/platform remainder | BLOCKED per DGM-113 cell; bounded automated handoff delivered | Physical offline, downloaded-file SmartScreen/policy acceptance, human native dialogs/IME/clipboard, Teams/Office/novice, physical zoom/touch and native x64/Mac/separate browser cells need their named inputs. Current runtime offline evidence is CDP emulation only. Next action: PO/device owners supply those prerequisites or explicitly narrow scope; no support/publication claim follows from the local pass. |

- "Next", "continue" and "finish" resume the first runnable queue action. A status/question-only request is answered without starting unrelated work. Never ask whether to run the next already-required test, dispatch the verifier, fix an in-scope defect or update factual docs.
- The orchestrator owns task breakdown, missing task documents, evidence reconciliation and dispatch. It may clarify routine implementation details within the accepted behavior; changing a frozen behavior or public contract still needs approval. Implementers do not rewrite acceptance criteria.
- Keep implementation and independent verification separate. Dispatch available agents by explicit role and file allowlist; do not infer a model identity from its label. If preferred models are unavailable, use available agents with the same role boundaries. If no separate verifier can run, record that specific evidence gap without claiming self-verification is independent.
- Serialize shared files and terminal/browser gates. Parallel work is permitted only for disjoint ownership. Preserve unrelated dirty changes, historical evidence, existing user profiles and the server on port 5207.
- Routine defaults include fixture hit-testing, isolated test data, existing helpers, focused test selection, internal names, deterministic retries after a concrete repair, and documentation updates. Do not replace a failing oracle with one that merely passes or modify application hit-testing to manufacture reachability evidence.
- A verifier failure routes directly to the responsible implementer with the assertion, repro and contract; the repaired slice returns to the verifier automatically. Do not rerun unchanged failures hoping for green. Allow at most three repair-and-recheck cycles per defect. Persist the defect ID, attempt count, changes and result in the linked report; a handoff or new agent never resets the count. After the third failed cycle, mark the affected queue item BLOCKED with diagnostics and the precise unblock action, then continue independent rows. Reopening requires new evidence or an explicit PO direction, not another "next".
- A missing device, human participant, signing credential or approval blocks only the affected qualification/release cell. Record the blocker, owner, required input and unblock action once. Continue independent local work. Deferred or blocked is never PASS, and it must remain visible in the final handoff.

## Evidence and Resume Rules

For each gate, retain command, start/end time, exit code, totals, input/build
identity and artifact paths in a fresh timestamped directory under
`app/test-results/`. Preserve failures too. A timeout, partial progress display,
unretrievable terminal or stale report is not a pass. Never claim a historical
RED result that was not observed and retained.

Run one-shot gates synchronously to completion using the available tool's
completion handling. If execution must be handed back, record the exact active
terminal ID and log path; resume that run, not a duplicate. Do not poll or sleep.
Persist evidence from the first run so lost terminal output does not force
another multi-minute test solely to recover totals.

DGM-110's independent source gate, from `app`:
`./node_modules/.bin/vitest.cmd run --maxWorkers=1 src/editor/interactions.test.ts src/editor/Editor.test.tsx src/document/commands.test.ts src/app/session.test.ts`.
Then run `npm run typecheck`, `npm run build`, and `npm run test:browser` serially.
The browser runner uses `dist`: build after source/public changes, or prove the
existing build matches unchanged inputs. A runner-only change does not require
another identical production build. Preserve per-assertion coverage limits;
passing a generic browser scenario cannot prove all frozen DGM-110 cases.

DGM-116 uses `node --test scripts/generate-brand.test.mjs`, with current preview
assets and visual inspection. Reuse valid generator evidence; run
`npm run test:generators` when the asset slice changes. For local integration,
reuse unchanged gates and run the existing full source gate
`npm test -- --maxWorkers=1` once for the final candidate. Do not add repeated
full-suite runs merely for reassurance or claim this document edit ran tests.

Before yielding, each active queue row must have: state, owner, completed
evidence, exact next action and any blocker. Use READY, RUNNING, OWNER GREEN,
VERIFYING, AUTOMATED COMPLETE or BLOCKED. After success, update state and continue
in the same task. On resume, read the queue and linked report first; do not
reconstruct the plan from old chat status messages or old approval paragraphs.

## Genuine Approval Gates

Ask only when required to change product scope/frozen acceptance, public APIs or
schemas, add dependencies/major upgrades, affect security/auth/permissions,
migrate/delete user data, incur cost, change infrastructure/CI, or perform
irreversible/external actions. Current packaging/rebuilding, signing,
publication/deployment, branch/commit/push and platform support promises still
require explicit authorization. These are not authorized by "next" or by this
workflow revision. Escalate an affected slice, not the whole queue.

Human Teams/Office/novice tests, native zoom/touch, native x64/Mac qualification,
native download cancellation and current packaged GUI checks remain unresolved
where evidence is absent. They gate the corresponding acceptance/support/release
claims, not unrelated approved local implementation. The PO retains final
product/release acceptance.

## Historical Record

Everything below records the decisions and evidence available at its date.
Past "hard stop", "proposed" and "current" statements are historical, not the
live execution cursor. Use the queue above for routing; retain earlier reports
and technical contracts for their evidence and behavioral requirements.

2026-10-09 snapshot: V1 IMPLEMENTED; AUTOMATED VERIFICATION PASSED; PO/MANUAL REVIEW PENDING.

## Epic DGM-E01

Outcome: create/export a clear architecture diagram quickly in a local browser editor.
Source of truth: [DGM-MVP spec](specs/DGM-MVP.md). Architecture proposal: [RFD 001](rfd/001-editor-foundation.md). Research: [tool comparison](research/diagram-tools.md).

Success metrics: eight-component usability scenario <=5 minutes; fixture exports unclipped and self-contained; reliable local/JSON recovery; <=100ms p95 edits and <=2s layout on the agreed stress fixture. These are approved but unverified targets.

## Approval and sequencing

1. Product baseline/dependencies approved and DGM-000 spike completed; PO accepted the visible result and authorized V1 on 2026-10-09.
2. DGM-001 foundation accepted with frozen contracts, pinned stable tooling and 24 verified official assets.
3. DGM-010/020/030 implemented in parallel, DGM-040 integrated, and DGM-050 independently verified. Final Sprint 1 closure still requires PO/manual acceptance; no automatic continuation.

Sprint 0 goal: prove interactive layout/export compatibility and license feasibility.
Sprint 1 goal: complete one bounded add/connect/group/annotate/arrange/save/export workflow, with no backend.

Current outcome: production candidate under `app/` is live at http://127.0.0.1:5174/; unchanged spike remains on 5173. Independent gates: 257 tests, 13 integrated Edge checks, three foundation viewports, four editor cases, and production performance targets passed. [Verification](verification/DGM-050.md); [Sprint 1 review](verification/sprint-1-review.md). PowerPoint and novice-usability checks remain unverified.

PO-authorized refinement DGM-060 is implemented: seven icon-led groups, familiar first-four pins/alphabetical tails, Fabric under Azure, search-only long tail and source-dated retirement filtering without breaking old documents. Latest independent evidence supersedes numerical counts above: 4,899 tests, all 13 workflows and original performance gates pass. [Current catalog verification](verification/DGM-060.md). Prior V1 evidence remains historical; manual acceptance is still open.

## Work packages

| ID | Spec | Owner | Depends on | Exclusive implementation area | Verification responsibility |
| --- | --- | --- | --- | --- | --- |
| DGM-000 | [Spike](specs/DGM-MVP.md#dgm-000-browser-feasibility-spike) | Orchestrator, spike exception | PO approval | Isolated spike, not production modules | Go/no-go evidence and license/asset inventory |
| DGM-001 | [Foundation](specs/DGM-MVP.md#dgm-001-foundation-and-contract-freeze) | One Implementer | DGM-000 go decision | Root config, dependency lock, shared contracts, fixtures, icon manifest | Contract/schema and blank app smoke tests |
| DGM-010 | [Document](specs/DGM-MVP.md#dgm-010-document-history-and-persistence) | Implementer A | DGM-001 | Document/persistence modules and their tests | Domain, history, import, autosave and tab lock |
| DGM-020 | [Editor](specs/DGM-MVP.md#dgm-020-canvas-sidebar-and-inspector) | Implementer B | DGM-001 | Editor modules and scoped styles/tests | Canvas/sidebar/inspector and responsive behavior |
| DGM-030 | [Output](specs/DGM-MVP.md#dgm-030-layout-scene-and-output) | Implementer C | DGM-001 | Layout/render/export modules and their tests | Geometry/layout/export quality |
| DGM-040 | [Integration](specs/DGM-MVP.md#dgm-040-integration-and-mvp-completion) | One Implementer integrator | DGM-010/020/030 | App wiring, app-wide styles and end-to-end tests | Integrated production workflow |
| DGM-050 | [Verification](specs/DGM-MVP.md#dgm-050-independent-sprint-verification) | Independent Verifier | DGM-040 | Evidence/report/docs only | Every AC, visual checks, metrics and PO usability |

Individual task-spec files are created from these approved packages before dispatch. Each must retain context, interfaces, given/when/then cases, exclusions, risks and definition of done. Do not begin from an informal agent summary.

## Delegation protocol

- Orchestrator tier owns specs, RFDs, task contracts, routing, review and decisions; does not implement production code. Models/agents follow the PO's Opus/Sol orchestrator, Opus/Terra implementer and Luna/Haiku verifier policy. Availability must be checked; no model identity or specialist agent is assumed from a label.
- At most three implementers run concurrently: A document, B editor, C output. They start only after shared contracts and fixtures are frozen. They use deterministic fakes at module boundaries until counterparts are ready.
- In the shared worktree, ownership is disjoint. A second agent does not edit another owner's files, root config, shared contracts, icon manifest or app-wide CSS. Root changes go back to the foundation/integrator owner. No simultaneous package installation or lockfile edits.
- Each dispatch includes exact task-spec link, approved baseline, file allowlist, interfaces, AC responsibility, test command, forbidden scope and required report. Agent retries receive the same contract and a concrete defect, not an invitation to redesign.
- Implementers write a failing acceptance test, confirm the right failure, implement the simplest passing behavior and refactor under green tests. Tests use `should_<outcome>_when_<condition>` naming. Report red/green evidence; never delete/weaken tests to meet a gate.
- Cross-module contract changes, missing licenses, security/data-integrity concerns and unclear criteria are escalated to the orchestrator/PO. Agents stop that slice; unrelated approved work may continue.
- After a slice completes, the orchestrator reviews contract adherence and evidence. Integration starts only when all three slices are accepted. Repair tasks go to the owning implementer, not the verifier.
- Verifier runs tests, checks all criteria, updates docs to observed reality and reports defects. It never fixes code or approves deviations.
- No commits or branches are created by this planning turn. Implementation branch/worktree/commit operations require explicit authorization and must follow the PO's naming/Conventional Commit rules.

## Dispatch template

```text
Role/tier: [approved role and available agent/model]
Task: [ID and exact individual spec path]
Baseline: [PO-approved spec/RFD version]
Allowed files: [exclusive slice]
Inputs/outputs: [frozen contract names and fixtures]
Acceptance: [owned AC portions and given/when/then cases]
Procedure: confirm red test, implement, confirm green, refactor
Validation: [foundation-defined focused command]
Forbidden: spec/contract edits, dependencies, others' files, unrelated cleanup
Escalation: stop and report ambiguity/security/data integrity/license issues
Report: Status; Changes; Evidence; Docs updated; Open issues/decisions
```

Production dispatches follow the individual task contracts below. The orchestration agent handles specifications and review; implementers own code; the independent verifier reports results without fixing code.

Completed dispatches: one foundation implementer; three parallel feature implementers; one integrator; separate independent verifier. Verification found a nested-annotation layout guard mismatch and stale foundation oracle; owners repaired both with confirmed red regressions and the verifier rechecked them. No agent changed a failing acceptance threshold or installed an unapproved runtime dependency.

## Verification and review

Foundation defines the actual runnable scripts; expected gates are focused unit/component tests, typecheck, build and Playwright end-to-end tests. Do not report these as run during planning.

DGM-050 publishes an AC-01 through AC-13 matrix, command output, screenshots at the three specified viewports, actual exported artifacts, performance measurements and manual PowerPoint/usability observations. Manual checks require the PO; absent evidence means unverified, not passed.

Sprint review: recap outcome/evidence; identify root causes and workflow issues; annotate [lessons](lessons.md); adjust conventions/decisions; agree next priorities. Log changes in [decisions](decisions.md). Hard stop until PO closes review.

## Deferred backlog

Only after accepted MVP and a new scope decision: offline/PWA; AWS/GCP libraries; freehand; partial/pinned layouts; reusable templates; collaboration/cloud saving; AI generation. This is not an ordered or authorized next sprint.

## Proposed Next Work: DGM-E02

2026-10-10: the PO requested a UI/UX review and organized upgrade proposal for quick, low-effort diagramming and customer/Teams use. This authorizes review/planning, not implementation or closure of outstanding acceptance checks.

The [evidence-based review](research/ui-ux-review-2026-10-10.md) identifies a reproduced legacy-order defect, excessive long-header layout padding, limited meeting framing, search alias gaps and image-handoff/platform qualification needs. Four repeated sample layouts were stable; do not describe every repeated layout as still broken.

The [DGM-100 work plan](specs/DGM-100.md) organizes DGM-101 through DGM-115 with dependencies, owners, acceptance cases, exclusions, risk gates and proposed success measures:

- Sprint 2 proposal: predictable stacking, content-sized layout, readable workspace and guarded Present mode.
- Sprint 3 proposal: custom diagram backgrounds, configurable grid/snapping, meeting/slide image handoff, service search, contextual add/connect and direct editing. Review capacity and split before dispatch.
- Sprint 4 proposal: starter diagrams, local alignment, save/transfer clarity and platform qualification.
- Preflight decision: explicitly choose the supported desktop/browser/touch and offline delivery matrix before promising everywhere support.

2026-10-10: the PO approved execution of Sprint 2, DGM-101 through DGM-104. Task contracts are frozen under [DGM-101](specs/DGM-101.md), [DGM-102](specs/DGM-102.md), [DGM-103](specs/DGM-103.md) and [DGM-104](specs/DGM-104.md). Current status: IMPLEMENTED; INDEPENDENT AUTOMATED VERIFICATION PASSED; PO/MANUAL REVIEW PENDING. Sprints 3/4 remain PROPOSED. Existing manual acceptance checks remain unverified, not waived or passed. Existing MVP/catalog evidence above is historical and not a qualification of current unpublished changes or every desktop artifact.

Final [Sprint 2 review](verification/sprint-2-review.md): 5,221 source tests, 20 native generator checks and all 16 production-browser scenarios pass. Desktop policy checks retain their earlier 27/27 result, not a new packaged GUI run. The original 100-entity/150-connection production fixture passed edit p95 49.9ms and maximum layout 483ms. Boundary verification includes 132 real worker layouts. Five reported UI defects were repaired by owners and rechecked; failed-candidate evidence remains in the report. [Manual](manual.md) describes source-candidate controls, not a republished executable.

Hard stop: await PO-led sprint review. Actual Teams recipient readability, Office insertion, uncoached novice use, native Mac, native browser 200% zoom/physical touch and current packaged GUI remain unverified. No Sprint 3, release publication or desktop rebuilding was started.

2026-10-11: PO requested adding custom background colors and grid/snapping to the plan. [DGM-114](specs/DGM-100.md#dgm-114---custom-diagram-background) covers a saved solid background shared by editor, Present and opaque exports, with transparency remaining an output override. [DGM-115](specs/DGM-100.md#dgm-115---grid-and-snap-controls) adds independent grid/snap toggles, shared spacing/origin, dots/lines, and opt-in grid inclusion in Present/exports. These are accepted planning additions; implementation and the next sprint still await authorization. Sprint 2 evidence and its historical white-default behavior are unchanged.

Subsequent authorization, 2026-10-11: PO said "after this then implement next sprint". Plan amendment validated; Sprint 3 IN PROGRESS under DGM-114/115/106/107/105/108 task contracts. Shared-file implementation is sequential; catalog-only ranking may run in parallel. Existing manual checks remain unverified, not waived or passed. Stop at Sprint 3 review; no Sprint 4, release rebuild or publication is inferred.

2026-10-11 completion: Sprint 3 IMPLEMENTED; INDEPENDENT AUTOMATED VERIFICATION PASSED; PO REVIEW OPEN. [Sprint 3 review](verification/sprint-3-review.md) records 5,431 source tests across 36 files, typecheck/build, 20 generator checks and a fresh 51/51 production-browser matrix. Original 100-entity/150-edge performance passes unchanged gates: edit p95 51.7ms, maximum layout 734.2ms. Owners repaired camera readiness and scaled physical-target selection in test harnesses without weakening assertions; earlier failures and a confirmed standby-interrupted run remain evidence, not passes. [Manual](manual.md) now describes the actual background/grid, contextual insertion, inline editing, command menu and export controls. Hard stop for PO-led review: Teams/Office, uncoached novice timing, native Mac, physical 200% zoom/touch and current packaged GUI remain unverified. No Sprint 4, desktop rebuild, release, commit or publication was started.

2026-10-11 subsequent PO disposition: "approved go" permits bounded Sprint 4 continuation with all prior manual gates still unverified. Sprint 4 IN PROGRESS: [DGM-111](specs/DGM-111.md) copy-only save clarity, [DGM-109](specs/DGM-109.md) bundled starters and [DGM-110](specs/DGM-110.md) same-parent alignment execute sequentially; [DGM-112](specs/DGM-112.md) is desk investigation only. Approved contracts retain local storage and validation limits. Native download cancellation remains deferred, not claimed solved. DGM-113, platform support promises, desktop rebuilding, signing, CI, new dependencies, commits and publication are excluded. Independent verification and a new PO-review stop end Sprint 4.