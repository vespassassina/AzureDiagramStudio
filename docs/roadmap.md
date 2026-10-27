# Diagrammer Roadmap and Delegation Plan

Updated: 2026-10-27. Status: DGM-131 ALWAYS-ON LOCAL MCP / SETTINGS COMPLETE, INDEPENDENT SOURCE ACCEPTANCE PASS; WINDOWS 0.3.0 STABLE RELEASE UNCHANGED; FORMAL PARTICIPANT TRIALS REMOVED; UNSIGNED/NATIVE-x64 LIMITS AND HISTORICAL TIMESTAMP WARNING RETAINED.

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
| 30 | [DGM-132 version 0.4.0 source delivery](specs/DGM-132.md): APPROVED / EXECUTING | PO requested merge, push and tag 0.4.0. Include all verified DGM-131 files and bump package/root lock version only. | Validate version consumers, commit, isolated merge and atomic push of both branches plus annotated tag; verify exact remote refs and clean feature tree. No binary release or older-tag changes. |

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