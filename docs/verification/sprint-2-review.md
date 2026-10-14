# Sprint 2 Independent Verification

Date: 2026-10-10. Role: INDEPENDENT VERIFIER. Current status: **AUTOMATED PASSED; MANUAL/PO REVIEW PENDING**.

## Final Verification After S2-V05 Owner Repair

Fresh independent verification of the owner's final candidate passed every required automated gate. No production code, source tests, specifications, runners, dependencies, commits or other project documents were changed by this verifier. Only this review and generated evidence were updated. The PO-led sprint review remains a hard stop; no next sprint is authorized.

### Definitive Final Gates

All commands ran sequentially in sync PowerShell `& { ... }` blocks, once per required gate. The complete browser runner used its own fresh port-0 production preview with `DGM_S2_CASE` unset; neither acceptance nor performance was filtered out or retried.

| Gate | Command From Workspace Root | Final Result |
| --- | --- | --- |
| Fresh all-source tests | `npm --prefix app test -- src --reporter=dot` | **5221/5221 PASS**, 33/33 files, exit 0, 43.02s; **three more tests** than the prior 5218-count run |
| Fresh production build | `npm --prefix app run build` | **PASS**, exit 0; TypeScript build plus 2092 modules, Vite 1.12s |
| Separate typecheck | `npm --prefix app run typecheck` | **PASS**, exit 0 |
| Native generators and fresh desktop/mobile branding | `npm --prefix app run test:generators` | **20/20 PASS**, exit 0, 5097.0331ms, no skips/cancellations |
| Unchanged complete Sprint 2 browser runner | `node app/scripts/verify-sprint2.mjs` | **16 PASS / 0 FAIL / 16 acceptance scenarios**, plus **3 CAPTURED diagnostics**, exit 0 |
| Original performance, invoked by the complete runner | Unchanged verify-v1 with original `Production stress` fixture and thresholds | **PASS**, exit 0; edit p95 **49.900000005960464ms <=100ms**, maximum layout **483ms <=2000ms** |
| Desktop policy/protocol/driver | Prior `npm --prefix app run test:desktop` result **retained, not rerun** | **27/27 PASS**, prior exit 0; explicitly retained as authorized because S2-V05 changed no desktop/policy/protocol/driver or dependency files |

Exact commands, counts, hashes, outcomes and cleanup: [final summary](../../app/test-results/sprint-2-s2-v05-final/summary.json). Fresh logs: [source](../../app/test-results/sprint-2-s2-v05-final/source-tests.log), [build](../../app/test-results/sprint-2-s2-v05-final/build.log), [typecheck](../../app/test-results/sprint-2-s2-v05-final/typecheck.log), [generators](../../app/test-results/sprint-2-s2-v05-final/generators.log), [browser](../../app/test-results/sprint-2-s2-v05-final/browser.log). The [complete browser report](../../app/test-results/sprint-2-s2-v05-final/browser/browser-report.json) lists every final outcome. The [retained desktop log](../../app/test-results/sprint-2-s2-v05-final/pre-run/app/test-results/sprint-2-followup/desktop.log) is historical evidence, not a fresh native GUI run.

All five workspace viewports (1440/1366/1280/390/720), F1/order/routes/SVG parity, actual overlap pixels, all three long-title Present fits, nested annotation layout/undo, Present mutation/fullscreen/restore and delayed file/icon/empty-document scenarios pass. Short and long isolated headers execute **66 real worker layouts each, 132 total**, retaining compact/3000 convergence, RIGHT/DOWN/RIGHT repetitions, native SVG text bounds and the original 18-32 gap assertions. [Performance metadata](../../app/test-results/sprint-2-s2-v05-final/browser/performance.json) retains **stress-v1, 100 entities/150 edges, 20 real keyboard edits, 10 accepted layouts/30 commits**, all raw timings and fixture SHA256 `63abe1fe35e62379677892b30863cb2dc858ea8bbff9b9e5402f46edf14dd16f`. No threshold or fixture changes, favorable-sample retry or extra acceptance gate was used.

### S2-V05 Resolved

The formerly failing **Workspace 390x844** scenario now passes the unchanged real-pointer sequence, including opening the library and activating selected **Open properties** without closing the library first. Selection/camera/navigation JSON and exact Present restore remain covered by the complete run. This resolves the previous **15 PASS / 1 FAIL** result, not an oracle change.

The owner's [both-theme exact pointer report](../../app/test-results/s2-v05-owner/both-theme-pointer.json) and [5/5 workspace report](../../app/test-results/s2-v05-owner/workspace-browser.json) were read and retained; their tested source hashes match this final tree. Both themes report PASS with real hit-tested clicks and exact selection/camera/tool/history/document preservation. Fresh final-candidate drawer frames independently show library **left 56, top 151, right 314, bottom 676**, leaving the owner's **132px bottom reservation**; navigation starts at y=685 and selected-properties remains **44x44, left 116, top 689, right 160, bottom 733**. The original obstruction point **(138,710)** now resolves to **Open properties** in both themes. [Screenshot geometry](../../app/test-results/sprint-2-s2-v05-final/requested-screenshots.json) records these measurements; this capture was not an extra acceptance rerun.

Final images for orchestrator/PO inspection: [1280px Present](../../app/test-results/sprint-2-s2-v05-final/browser/1280-present.png), [390px light drawer](../../app/test-results/sprint-2-s2-v05-final/390-light-drawer.png), [390px dark drawer](../../app/test-results/sprint-2-s2-v05-final/390-dark-drawer.png). The complete run freshly produced **62 PNG frames**, plus two requested drawer captures; fresh [branding geometry](../../app/test-results/sprint-2-s2-v05-final/branding/header-report.json) checks complete text/image bytes, containment, overlap and overflow. Visual inspection does not substitute for human readability acceptance.

### Final Identity And Integrity

Tested entry **index-BWWCq_6d.js**, SHA256 `C00D710C90BB61ECDF61F459241A5B941E6DE6E1D2422D0C87DCC48555DECE0A`; stylesheet **index-D7zZzsbi.css**, SHA256 `50C831B7989589A0ABC6594E562238FC4A3B846EEE886726BBE07537019695EA`; built index SHA256 `972BDA5667F31651BA1E5363DA7CF97FE39C80DA4135993C6F896D8A4252F807`. Exact [build identity](../../app/test-results/sprint-2-s2-v05-final/build-identity.json) also pins source assets and mobile CSS. Known large-chunk and ineffective-ELK-dynamic-import warnings remain, with no compile failure.

Before review editing, **2477 protected file hashes matched**, with no source/test/spec/dependency/other-document mutation. Sprint 2 runner SHA256 remains `CA894EB18D3F98AA668FBC56556D000900C51CDF11772032DF0CE785DE8A56C8`, identical to the preceding independent final inventory. Original performance runner SHA256 remains `279224FC1E3BA8434CD8A535E313F26D0551CB1DEA0603125AD763BD62230A32`. [Baseline](../../app/test-results/sprint-2-s2-v05-final/baseline.json) preserves these identities and the prior review/report hashes.

Runtime remains Node v26.7.0, headless Edge 155.0.4283.45, Playwright 1.63.0, Windows ARM64/Snapdragon X. Final matrix and requested captures each record **zero page errors and zero external requests**. Owned browsers/contexts/previews closed; OS checks found **zero listeners** on final origins `http://127.0.0.1:51235/` and `http://127.0.0.1:59575/`. User ports **5174/PID42664 and 5186/PID39568 remain listening, unchanged**. Native generator previews also closed in their test cleanup.

Prior failed measurements and outcomes remain unchanged below. The immediately preceding complete **15/1 failed candidate** and its screenshots were archived before running the final matrix: [prior browser report](../../app/test-results/sprint-2-s2-v05-final/pre-run-sprint-2/browser-report.json), [byte-preserved prior review](../../app/test-results/sprint-2-s2-v05-final/pre-run/docs/verification/sprint-2-review.md). Older initial failures remain in their original archives. Historical headings/statuses below do not describe final readiness.

### Remaining Manual / PO Gates

**MANUAL/UNVERIFIED:** actual Teams recipient readability; PowerPoint/Office SVG and PNG insertion fidelity; uncoached novice recreation; native macOS ARM64; native browser-chrome Ctrl+200% zoom; physical touchscreen use; packaged desktop GUI and native fullscreen Escape. Coarse-pointer/CSS-DPR/headless event evidence does not complete these checks. Historical owner RED evidence still requires PO review; S2-V05's supplied owner RED log is not blanket proof for all Sprint 2 work.

Status: **done with independent automated verification; MANUAL/PO REVIEW PENDING**. Changes/docs updated: this review only, plus generated evidence. Evidence: 5221 source, 20 generators, build/typecheck, 16/16 browser, 132 worker layouts and original performance PASS; desktop 27 retained. Open decisions: manual acceptance and PO-led sprint review. The main orchestrator owns subsequent roadmap/manual/decisions/lessons updates.

## Prior Follow-Up After Owner Repairs (Historical)

The three initially confirmed UI defects and the two asset/native-brand oracle failures are repaired and independently rechecked against a fresh production build. The full browser run now reaches a previously masked **real mobile panel-access failure**. Automated readiness is **not all green**. No production code, source tests, specifications, dependencies, commits, security or release configuration were changed by this verifier. Manual acceptance and the PO-led sprint review remain hard stops.

### S2-V05: Open Library Obstructs Selected Properties On Mobile

Owner: DGM-103 editor owner. **Confirmed product failure**, not an oracle adjustment.

Repro: fresh production origin, Edge 390x844, coarse-pointer emulation, Commerce sample, either light or dark theme. Fit diagram, select platform, open/close properties, Fit selection, choose Pan, drag a hit-tested blank pane 25x25px, then open the component library. Click **Open properties** to swap panels while preserving the selected frame.

The enabled 44x44 Open properties control occupies **left 116, top 688, right 160, bottom 732**. The library occupies **left 56, top 151, right 314, bottom 808**. `elementFromPoint(138, 710)` resolves to the library's **Add text** button, not Open properties. Real Playwright clicks time out because that library subtree intercepts pointer events. Library remains open and inspector remains closed. The complete matrix reproduces this, and a second isolated reproduction confirms identical rectangles in both themes.

The approved [DGM-103 contract](../specs/DGM-103.md) requires usable commands and constrained-panel swapping without overlapping controls. The rail's Document properties action is **not equivalent**: it clears entity/edge selection before opening the inspector. Closing the library first, forced clicks, synthetic dispatch, keyboard-only activation or substituting Document properties would bypass this pointer workflow, not verify it. No such workaround was applied to the acceptance scenario.

Owning surfaces: [canvas mobile controls](../../app/src/editor/EditorSurface.tsx#L630), [library stacking](../../app/src/editor/editor.css#L35), [narrow overlay layout](../../app/src/editor/editor.css#L312). Required owner outcome: the selected-properties toggle remains pointer-reachable when the mobile library is open; one activation swaps to the inspector without losing selection or moving the camera. No implementation is prescribed or attempted here.

Evidence: [independent both-theme hit tests and click failures](../../app/test-results/sprint-2-followup/mobile-independent-repro.json), [light obstruction](../../app/test-results/sprint-2-followup/mobile-light-panel-obstruction.png), [dark obstruction](../../app/test-results/sprint-2-followup/mobile-dark-panel-obstruction.png), [full matrix failure screenshot](../../app/test-results/sprint-2-s2-v05-final/pre-run-sprint-2/failure-Workspace-390x844.png).

### Definitive Fresh Gates

Commands ran sequentially in sync PowerShell `& { ... }` blocks. No parallel gate commands and no modification/restart of source servers.

| Gate | Command From Workspace Root | Current Result |
| --- | --- | --- |
| Fresh production build, before tests | `npm --prefix app run build` | **PASS**, exit 0, 2092 modules, Vite 1.33s |
| Independent all-source tests | `npm --prefix app test -- src --reporter=dot` | **5218/5218 PASS**, 33/33 files, exit 0, 37.03s |
| Separate native generators | `npm --prefix app run test:generators` | **20/20 PASS**, exit 0, no skipped/cancelled tests |
| Separate native desktop | `npm --prefix app run test:desktop` | **27/27 PASS**, exit 0, no skipped/cancelled tests; policy/protocol/driver only |
| Typecheck | `npm --prefix app run typecheck` | **PASS**, exit 0 |
| Complete production browser runner | `node app/scripts/verify-sprint2.mjs` | **15 PASS / 1 FAIL / 16 acceptance scenarios**, plus **3 CAPTURED diagnostics**, exit 1 due to S2-V05 |
| Original production performance runner | Unchanged verify-v1, `DGM_V1_CASE='Production stress'`, URL set to ephemeral production origin by the parent runner | **PASS**, exit 0; edit p95 **50.1ms <=100ms**, maximum layout **394.5ms <=2000ms** |

Logs and exact metadata: [summary](../../app/test-results/sprint-2-followup/summary.json), [build](../../app/test-results/sprint-2-followup/build.log), [source](../../app/test-results/sprint-2-followup/source-tests.log), [generators](../../app/test-results/sprint-2-followup/generators.log), [desktop](../../app/test-results/sprint-2-followup/desktop.log), [typecheck](../../app/test-results/sprint-2-followup/typecheck.log), [final browser log](../../app/test-results/sprint-2-followup/final-browser.log), [final complete report](../../app/test-results/sprint-2-s2-v05-final/pre-run-sprint-2/browser-report.json), [immutable final-run archive](../../app/test-results/sprint-2-final-followup/browser-report.json).

The current source count is 5218, not the historical 5214. These are independent runs of the owner's current tests; no tests were added or edited by the verifier. The build retains the known large-chunk and ineffective-ELK-dynamic-import warnings, with no compile failure.

### Coverage And Repaired Findings

- **S2-V01 resolved:** Present is 44px high at 390x844, and applicable primary controls meet 44x44. Both themes have target/focus evidence.
- **S2-V02 resolved:** all **11** rail commands are individually scroll-reachable at 720x450/DPR2. Enabled commands retain actual focus and an action description; each reached rectangle fits the rail and page without overflow. Disabled Paste is explicitly recorded as disabled and scroll-reachable, not falsely claimed keyboard-focusable. The complete 720px workspace scenario passes.
- **S2-V03 resolved:** settled long-title/subtitle Present framing passes at 1440, 390 and 720px after 20 animation frames. Included content clears the header and bottom chrome.
- **S2-V04 observation resolved for the tested canvas:** both themes now retain the light editing canvas with dark chrome in dark mode. Measured annotation contrast is **5.48:1 in both**, not the previous dark-canvas 3.07:1. This records the owner's design outcome; no new numeric spec criterion was invented.
- **Asset/brand gates resolved:** the owner tests still pin descriptor MIME, exact registered URI, canonical base64 payload, decoded SHA256 and PNG signature/SVG parse as applicable. Brand checks retain complete text, image bytes, line containment, no overlap and no page overflow. The repaired tests pass in the independent broad/native runs.
- **DGM-101:** exact F1 no-op/history, numeric scopes/routes/undo remain covered by all-source tests; production shared SVG markup and node/edge strata agree. Actual overlap pixels remain `[255,255,255,255]` over both boundary fills through selection/deselection.
- **DGM-102:** both short/long header fixtures execute **66 real worker layouts each, 132 total**. Compact/3000 convergence, ten repeats RIGHT/DOWN/RIGHT, native SVG text bounds, 18-32 unit gap and exact annotation absolute-position/undo checks pass.
- **DGM-103:** desktop 1440/1366/1280 and 720/DPR2 workspace scenarios pass; the mobile workspace scenario remains FAIL at panel access. The hit-tested mobile pan itself independently passes in light/dark, with an actual camera change and exact JSON, undo/redo and selection preservation. This supplementary evidence does not replace the failed workspace scenario.
- **DGM-104:** complete draft rejection/commit, mutation/drop/hidden-input/drag guards, delayed file and icon invalidation through exit, empty Present, read-only exit, fullscreen API denial/event path and exact camera/panel/pin/tool/selection/focus/export restore pass. Supplemental mobile light/dark Present/pointer/restore also passes after explicitly closing the obstructing library; this is not a workaround counted as workspace acceptance.

### Verification Artifact Rationale

Only [verify-sprint2.mjs](../../app/scripts/verify-sprint2.mjs) was edited, after actual failures were inspected. Product criteria were not relaxed.

1. The **unchanged fresh-build runner** produced **14 PASS / 2 FAIL / 16**, plus 3 diagnostics. The 720px oracle asserted every scrollable rail command must occupy the viewport simultaneously, which conflicts with individual command reachability in the approved contract. The replacement scrolls/focuses every command and asserts reached bounds, enabled focus/description, no page overflow and coarse-pointer target sizes. Non-rail bounds and overlap assertions remain.
2. The original mobile `.7,.7` drag point hit the **selection toolbar**, not the pane. The replacement checks every point of the five-step drag with `elementFromPoint` for a blank `.react-flow__pane`, then requires real camera movement and exact navigation JSON/history invariance. The gesture was not omitted.
3. Present's all-node framing oracle was changed to the **seven selected platform descendants**, as required by DGM-104's selected-content entry contract. The check asserts all expected IDs are present, so filtering cannot pass vacuously. Fit diagram separately still verifies **all nodes** and overlay clearance. Unselected users/note are not falsely included in selected framing.
4. Once the rail oracle permitted 720px to proceed, a real selection click failed because the fixed **15px** offset hit child application at the scaled zoom. The replacement finds a real hit-tested point belonging to platform and performs a normal pointer click. It does not force/dispatch the real-click path or change selection semantics. The immediate focused 720px rerun passed.

The first local exploratory probe also exposed disabled-Paste focus semantics; its corrected observations are retained. A later probe's fixed selection offset timed out, motivating item 4, not a production edit. The initial focused matrix then exposed S2-V05; that failure remains in the final complete run.

Retained artifacts: [initial unchanged runner failures](../../app/test-results/sprint-2-pre-oracle/browser-report.json), [pre-oracle log](../../app/test-results/sprint-2-followup/pre-oracle-browser.log), [first corrected workspace failures](../../app/test-results/sprint-2-followup/initial-focused-workspace.json), [local probe](../../app/test-results/sprint-2-followup/oracle-probes.json), [focused 720px pass](../../app/test-results/sprint-2-s2-v05-final/pre-run-sprint-2/focused-Workspace-720.json), [owner repair report](../../app/test-results/sprint-2-editor-repair/browser-report.json). Old diagnostic names/text containing "blocked" are retained artifact labels, not current 720px failure claims; current status is the explicit roll-up above.

Performance ran twice because the first full matrix preceded oracle edits and the required final complete matrix followed them. **Both measured runs passed**: preliminary p95 50.2ms/max layout 596.4ms; final p95 50.1ms/max layout 394.5ms. No favorable-sample retries, stress-fixture edits or threshold changes. Both use **stress-v1, 100 entities/150 edges, 20 real keyboard edits and 10 accepted layouts/30 commits**. Fixture SHA256 remains `63abe1fe35e62379677892b30863cb2dc858ea8bbff9b9e5402f46edf14dd16f`.

### Build Identity And Evidence Integrity

Tested entry: **index-CSwdA2ba.js**, SHA256 **C00D710C90BB61ECDF61F459241A5B941E6DE6E1D2422D0C87DCC48555DECE0A**. Built index SHA256: `195EA3917151E68461D16AAC99EB9C72FD52438709F929F86A2520746A5B4890`. Asset-source SHA256: `0A47464AF905C0CC783C5A81EA231C80BEC04A91C1DB92F1445E5678EFDB55C8`. Unchanged performance-runner SHA256: `279224FC1E3BA8434CD8A535E313F26D0551CB1DEA0603125AD763BD62230A32`.

The initial browser report and owner report were hash-checked against pre-run baselines. Initial report SHA256: `B87D5A5938BD6CCEFD1FB5672E5B0930369E11036F055280F7B5359CBF4CCF5F`; owner report SHA256: `A16F54398979E921817E7BBAD6983CE5728475E52728FCCA5E492FCDAB90968E`. The entire original evidence directory and a byte-preserved original review are retained under [pre-followup evidence](../../app/test-results/sprint-2-pre-followup). Their failures are historical, not erased or retroactively passed.

The final full run freshly wrote **61 PNG frames**, including desktop/mobile/light/dark/720-DPR2-equivalent layouts, focus, long headers, overlap and Present. Six supplementary mobile light/dark pan/obstruction/Present frames add focused evidence. Representative dark desktop, dark 720px equivalent, long-title Present and mobile obstruction frames were visually inspected. No human readability acceptance is implied.

Runtime: Node **v26.7.0**, installed headless Edge **155.0.4283.45**, Playwright **1.63.0**, Windows ARM64, Snapdragon X X1E80100, 12 logical CPUs, 31.57 GiB RAM. Fresh isolated contexts used local port-0 production previews. Full matrix and supplementary repro each record **zero page errors and zero external requests**. All contexts/browsers/owned previews closed in `finally`; OS listener checks found **zero listeners** on the five recorded verifier origins. Existing source/preview servers **5174 and 5186 remain listening, untouched**. Hash comparison before report editing found no tracked production/source-test/spec/dependency/performance-runner changes.

### Current Handoff

**Blocked:** return S2-V05 to the DGM-103 owner, then rerun the full mobile/workspace matrix against the new bundle. Do not accept 15/16 as all-green. No next sprint, production fix or commit is authorized by this verifier.

Still **MANUAL/UNVERIFIED**: actual Teams recipient readability, Office/PowerPoint insertion fidelity, uncoached novice recreation, native macOS ARM64, native browser-chrome 200% zoom, physical touchscreen use and packaged desktop GUI. CSS viewport/DPR equivalence is not native browser zoom. Historical mandatory owner RED proof remains unavailable to this independent run; owners must supply it for PO review.

Status: **blocked**. Changes: verification runner oracle corrections and this review only, plus generated evidence. Evidence: 5218 source, 20 native generator, 27 desktop tests/typecheck/build pass; 15/16 browser acceptance, 3 diagnostics; 132 worker layouts and unchanged performance pass. Docs updated: this review. Open issue: S2-V05 and explicitly unverified manual/PO gates.

## Initial Review (Retained Historical Record)

Everything below records the earlier candidate, not the current readiness result. Original evidence is preserved in the pre-followup directory linked above. Resolved findings retain their original failed measurements; current disposition is exclusively in the follow-up section.

Original date: 2026-10-10. Original role: INDEPENDENT VERIFIER. Original status: **BLOCKED**.
Scope: approved [DGM-101](../specs/DGM-101.md), [DGM-102](../specs/DGM-102.md), [DGM-103](../specs/DGM-103.md), [DGM-104](../specs/DGM-104.md), including current rendering/session clarifications. [Lessons](../lessons.md) read before verification.

The integrated candidate is uncommitted. No production/test code, specifications, dependencies, release configuration or user servers were changed by this verifier. Only [the permitted browser verification artifact](../../app/scripts/verify-sprint2.mjs) and this report were added. This is not PO acceptance; the sprint review hard stop remains in force.

## Findings Requiring Owner Action

### S2-V01: Primary Present Touch Target Is Too Short

Owner: DGM-103/104 editor owner. Confirmed production acceptance defect.

Repro: fresh production origin, Edge viewport 390x844, `hasTouch: true`, default Commerce sample, light theme. Inspect/click the topbar Present control. Its rect is left 289.45, top 98, right 378, bottom 134: **88.55x36**, below the approved 44x44 primary-touch contract.

[CSS location](../../app/src/editor/editor.css#L332): `.present-button` has `min-height: 36px`; the earlier coarse-pointer target list does not include this topbar command. Presentation Exit controls have their own 44px override, so this finding concerns entry, not Exit.

Evidence: [failed mobile screenshot](../../app/test-results/sprint-2-pre-followup/failure-Workspace-390x844.png), [original browser report](../../app/test-results/sprint-2-pre-followup/browser-report.json). Check stopped on its first failing target; mobile acceptance is not claimed.

### S2-V02: Editing Commands Are Clipped At 200%-Equivalent Layout

Owner: DGM-103 editor owner. Confirmed production CSS-layout defect.

Repro: fresh production origin, CSS viewport **720x450, DPR2**, equivalent to a 1440x900 physical viewport at 200% layout scaling. Default sample and light theme. The Add rectangle rail control has top 439, bottom **475**, height 36, outside the 450px viewport. More lower rail controls are inaccessible. The fixed shell clips the rail rather than exposing all commands.

Evidence: [failed zoom-equivalent screenshot](../../app/test-results/sprint-2-pre-followup/failure-Workspace-720x450.png), [diagnostic focus frame](../../app/test-results/sprint-2-pre-followup/720-light-blocked-focus.png). This is a CSS viewport/DPR emulation, **not a claim that native browser-chrome Ctrl+zoom was exercised**. Actual native 200% zoom remains unverified.

### S2-V03: Long Present Header Obscures Content At Zoom-Equivalent Size

Owner: DGM-104 editor/fit owner. Confirmed production fit defect.

Repro: CSS viewport 720x450, DPR2; set document title to `'Long title '.repeat(10)` and subtitle to `'Long subtitle '.repeat(14)`, committing each. Close panels, Fit diagram, then Present. After **20 animation frames**, the heading rect is left 24, top 24, right 500, bottom **203.53**. The platform boundary starts at y=**176.75**, overlapping the heading by **26.78 CSS pixels**. This is settled geometry, not an initial screenshot race. The same long-title scenario passed at 1440x900 and 390x844.

Evidence: [settled screenshot](../../app/test-results/sprint-2-pre-followup/720-long-title-settled-present.png), [exact rectangles/failure](../../app/test-results/sprint-2-pre-followup/focused-Long-title-Present-fit.json). Owning entry/fit path: [EditorSurface](../../app/src/editor/EditorSurface.tsx#L515). No fix attempted.

### S2-V04: Dark Canvas Annotation Readability Risk

Owner: editor/scene/theme owners and PO. Measured observation requiring a decision, not an invented spec threshold.

The unchanged Commerce note uses `#62696c`. After theme application and 20 settled frames, its contrast is **5.48:1** on light `rgb(251,253,253)` and **3.07:1** on dark `rgb(24,28,28)`. Normal small text generally needs 4.5:1 under WCAG guidance. Heading contrast is 11.44:1 light / 14.24:1 dark. The approved contract says meaningful contrast but does not specify a numeric threshold. Flag the dark annotation rather than silently redefining acceptance or changing the shared renderer.

Evidence: [measured ratios](../../app/test-results/sprint-2-pre-followup/focused-Diagnostic-measured.json), [dark production screenshot](../../app/test-results/sprint-2-pre-followup/1440-dark-workspace.png). Present deliberately uses its white canvas in both themes; this observation concerns the editing canvas.

### Failed Source/Native Oracles

The broad source gate is **not green**. Both failures must be reconciled by their owners; no tests were weakened:

- [scene.feature-icons.test.ts](../../app/src/scene.feature-icons.test.ts#L36), `should_allow_all_new_static_keys_without_removing_legacy_keys_when_registries_join`: expects `/^data:image\/svg\+xml/`; receives a `data:image/png;base64,...` registered asset.
- [microsoft-icons/artwork.test.tsx](../../app/src/microsoft-icons/artwork.test.tsx#L26), `should_render_a_self_contained_svg_export_with_all_microsoft_components`: expects all image hrefs to start `data:image/svg+xml;base64,`; receives PNG.
- [generate-brand.test.mjs](../../app/scripts/generate-brand.test.mjs#L42), `should_fit_complete_accessible_brand_when_desktop_and_mobile_headers_render`: on the freshly rebuilt bundle, mobile wordmark slot **177 != frozen 128px**. This is stale fixed-width oracle drift after responsive layout changes, not evidence of brand clipping. The full native generator run before the rebuild had timed out waiting for `.wordmark`; its result is retained, not called a pass.

The source failures are SVG-only oracle/runtime-format mismatches. A self-contained SVG can embed PNG, but the verifier does not authorize the uncommitted [asset change](../../app/src/assets.ts) or resolve its owner contract. Treat them as failed gates until owner clarification/repair and rerun.

The old [editor browser script](../../app/src/editor/verify-browser.mjs) was inspected, not modified or claimed as passed. Its old commands/panel expectations include `Send to background`, whereas the approved UI now exposes four numeric order actions. Its failure would not by itself prove a production defect. The dedicated production artifact uses the latest approved assertions; the original performance gate and thresholds were not changed.

## Automated Gates

All commands were executed sequentially using PowerShell sync `& { ... }` blocks. No parallel builds or test commands. Vitest internally uses its configured workers.

| Gate | Command From Workspace Root | Definitive Result |
| --- | --- | --- |
| Focused Sprint 2 | `npm --prefix app test -- src/document/commands.test.ts src/document/validation.test.ts src/scene.test.ts src/layout.test.ts src/editor/Editor.test.tsx src/editor/interactions.test.ts src/app/session.test.ts src/app/App.test.tsx --reporter=default` | **381/381 passed, 8/8 files, exit 0**, 31.56s |
| All source Vitest | `npm --prefix app test -- src --reporter=dot` | **5212 passed, 2 failed / 5214, 31 passed + 2 failed files / 33, exit 1**, 35.06s |
| Separate native generators | `npm --prefix app run test:generators` | **19 passed, 1 failed / 20, exit 1**; initial pre-build branding timeout |
| Separate native desktop | `npm --prefix app run test:desktop` | **27/27 passed, exit 0**; policies/protocol/driver, not a packaged native GUI claim |
| Fresh-build branding follow-up | From app: `node --test scripts/generate-brand.test.mjs` | **1 passed, 1 failed / 2, exit 1**, exact 177-vs-128 mismatch |
| Typecheck | `npm --prefix app run typecheck` | **exit 0** |
| Production build | `npm --prefix app run build` | **exit 0**, 2092 modules, 1.82s |

Build warnings: large chunks and an ineffective ELK dynamic import due to a static import. No compile failure. The initial focused dot output was truncated; its pass was not inferred. The complete focused default-reporter follow-up supplies the 381/381 result above.

## Task Coverage

| Task | Verified Behavior | Remaining |
| --- | --- | --- |
| DGM-101 | F1 exact no-op including revision/history; contiguous/noncontiguous four-action sibling scopes; selected parent/child roots; band preservation; legacy commands after numeric ranks; finite numeric import/paste; valid-route restamp and stale-route preservation; exact undo; distinct controls/read-only. Production SVG/canvas markup and actual node/edge ranks agree; overlap pixels show tiles remain above both boundary fills during selection/deselection. | No functional ordering defect found. Historical pre-edit RED proof was not independently available. |
| DGM-102 | Compact/3000 copies, Commerce/long Commerce and isolated short/long fixtures; ten RIGHT/DOWN repeats and RIGHT-DOWN-RIGHT; shrinking after removal; native SVG header fit; isolated 18-32 gap; explicit ports, worker/injected-engine bounds, route-container translations, immutable input and stale result guards. Production nested annotations preserve complete-parent-chain absolute coordinates, size/content/membership with exact apply-layout undo. | No functional layout defect found. Historical pre-edit RED proof not independently available. |
| DGM-103 | Initial library/no inspector at desktop; constrained swaps and pin intent; resize no camera jump; selection fit includes boundary descendants; diagram fit clears overlays in passing desktop views; fit/pan leave JSON/history unchanged; pending text and focus tests; focused light/dark frames. | S2-V01/V02; S2-V04 readability decision; native 200% zoom and actual touchscreen use unverified. |
| DGM-104 | Valid draft commit / invalid hex and parent rejection; entry chrome/grid/handles/outlines removed; title/status/legend retained; keyboard, gesture/resize, connect/reconnect, drop, hidden file inputs and stale callbacks guarded. Pending file/icon requests invalidated through exit; shell layout/file tokens and pre-existing autosave queue protected. Pointer/pan/zoom do not change canonical content or markup. Exact camera/panel/pin/tool/selection/focus restore in focused tests and production restore scenarios; exact SVG before/after. Real browser fullscreen entry + fullscreenchange exit and denial fallback pass; read-only tab exit stays locked; cross-document invalidation and lock-reacquisition covered by session/App tests; empty/nested/reduced-motion covered. | S2-V03; Teams readability manual; native fullscreen Escape key outside the headless browser not claimed (event path exercised). |

Focused suite counts: commands 105, validation 23, scene 46, layout 24, Editor 145, interactions 6, session 25, App 7. These are a subset of all-source counts, not additional tests to sum twice. Callback/session tests use controlled doubles; production browser results additionally exercise the real app shell, Web Locks, IndexedDB and workers.

## Production Browser Evidence

Runtime: **Node v26.7.0**, local headless **Microsoft Edge 155.0.4283.45** via installed `@playwright/test` 1.63.0, Windows ARM64 / Snapdragon X X1E80100 / 12 logical CPUs / 31.57 GiB RAM. No new packages installed.

Fresh Vite `preview({ port: 0 })` origins and fresh browser contexts isolated storage and locks. Existing previews/source servers **5174 and 5186 were untouched**. No generic network/upload destinations; **zero page errors and zero external requests** in dedicated runs. Simulated uploads went only to local file inputs. Every dedicated browser and preview closed in `finally`; no verifier background session remains.

**Final unique acceptance scenario roll-up: 13 PASS / 3 FAIL / 16**, plus **3 diagnostic-only captures**, not acceptance passes. The raw initial full report has 6 PASS/6 FAIL; four initial failures were verifier fixture/hook/subprocess errors superseded by focused results, not production fixes. Three later long-title scenarios add two passes/one failure, and the overlap scenario adds one pass.

- [Initial production matrix](../../app/test-results/sprint-2-pre-followup/browser-report.json): 1440x900, 1366x768, 1280x720 desktop pass; 390x844 and 720x450 fail as above; F1/order/routes, annotations and mutation/restore pass.
- [Overlap actual pixels/ranks](../../app/test-results/sprint-2-pre-followup/focused-Overlapping.json): real Edge screenshots, per-edge enclosing SVG z-index, shared exported markup, parent/child visibility and selection/deselection.
- [Corrected layout runs](../../app/test-results/sprint-2-pre-followup/focused-Layout.json): **66 real worker layouts per short/long fixture, 132 total**; exact compact/oversized convergence and ten repeats for RIGHT, DOWN, RIGHT on each input. Native SVG text boxes fit the parent and clear the child; self-contained exports retained.
- [Delayed requests + empty Present](../../app/test-results/sprint-2-pre-followup/focused-Present-delayed.json): pending file completion during Present and image completion after exit stay stale; empty document non-mutation.
- [Long title settled fit](../../app/test-results/sprint-2-pre-followup/focused-Long-title-Present-fit.json): 1440 and 390 pass; 720 fails.
- [Diagnostic mobile/zoom frames](../../app/test-results/sprint-2-pre-followup/focused-Diagnostic.json): remaining light/dark focus and Present frames and long titles; explicitly CAPTURED, not PASS.
- [Settled contrast](../../app/test-results/sprint-2-pre-followup/focused-Diagnostic-measured.json): measured ratios and colors.

There are **59 PNG screenshots** in [the evidence directory](../../app/test-results/sprint-2-pre-followup), plus JSON/SVG downloads. All required 1440/1366/1280/390 light/dark views have production frames; mobile/200%-equivalent frames are diagnostic evidence of the blocked candidate, not all-view acceptance. Screenshots were visually inspected for dark/mobile views, long headers and Present. Present remains white in dark theme by current design.

Verification-artifact corrections retained honestly: explicit legacy layer defaults in local fixtures; SVG imports pause `HTMLImageElement.decode`, not the raster `createImageBitmap` path; an asynchronous child launch keeps the in-process preview event loop responsive; actual edge z-index is on the enclosing SVG, not the `.react-flow__edges` div; theme contrast waits for paint. No assertions were removed to excuse product failures.

## Performance

The existing [verify-v1.mjs](../../app/scripts/verify-v1.mjs#L670) was run **unchanged**, filtered to `DGM_V1_CASE='Production stress'`, with `DGM_V1_URL` pointing to the ephemeral production origin. Same `stress-v1` fixture: **100 entities / 150 connections**, 20 real keyboard edits and 10 accepted worker layouts; final revision proves **30 commits**. No favorable-sample retry: the first attempt could not navigate because the verifier's synchronous child blocked its own server and produced no timing data. After correcting that artifact, one measured run passed.

**Edit p95 50.4ms <=100ms; maximum layout 394.7ms <=2000ms; exit 0.**

Evidence: [performance run](../../app/test-results/sprint-2-pre-followup/focused-Performance.json), [full performance metadata](../../app/test-results/sprint-2-pre-followup/performance.json), [runner log](../../app/test-results/sprint-2-pre-followup/performance-run.log). Fixture-source SHA256: `63abe1fe35e62379677892b30863cb2dc858ea8bbff9b9e5402f46edf14dd16f`.

Tested build entry: `index-DJ9gUtrV.js`, SHA256 `183D0E5039FF047A88383025A97E93859EF9D658A2C2B92017EB103F964D930C`. Built index SHA256 `5B29933BEC302B2B5A216557645DF037012C3840EC1C73FACE30F1F524BE05DD`. Uncommitted asset-source SHA256 `0A47464AF905C0CC783C5A81EA231C80BEC04A91C1DB92F1445E5678EFDB55C8`. Later owner edits require re-verification of affected gates.

## Manual / Unverified

- Actual Teams recipient readability: **MANUAL/UNVERIFIED**, no human recipient participated.
- PowerPoint SVG/PNG insertion and Office fidelity: **MANUAL/UNVERIFIED**.
- Uncoached novice five-minute recreation: **MANUAL/UNVERIFIED**.
- Native macOS ARM64 execution: **UNVERIFIED**, unavailable on this Windows host.
- Native browser-chrome 200% zoom and physical touch use: **UNVERIFIED**; CSS/DPR and coarse-pointer emulation are described exactly above.
- Historical mandatory pre-edit RED/Green evidence: cannot be reconstructed independently from an uncommitted integrated tree. Owners must provide retained RED logs for the PO review.
- Packaged desktop GUI, signing and GitHub release: not attempted; native policy tests alone do not establish them.

## Handoff

Orchestrator should dispatch S2-V01/V02/V03 to their existing owners without changing the approved contracts, obtain a S2-V04 readability decision, and reconcile the two SVG-only source oracles plus the stale native brand-width oracle. Then rerun affected focused/broad/native gates and production scenarios. Preserve this failed-candidate evidence. Stop at PO-led sprint review; no next sprint is authorized by this report.

Status: **blocked**. Changes: verification script/report only. Evidence: counts, repros, browser metrics and paths above. Docs updated: this report only. Open issues: three confirmed production defects, one measured readability decision, failed source/native oracles, missing historical RED proof and manual checks.