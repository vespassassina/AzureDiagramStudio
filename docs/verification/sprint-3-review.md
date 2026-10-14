# Sprint 3 Review

Date: 2026-10-11. Role: Independent VERIFIER. **Automated candidate: PASS. PO review: OPEN.**

Scope: approved [DGM-114](../specs/DGM-114.md), [DGM-115](../specs/DGM-115.md), [DGM-106](../specs/DGM-106.md), [DGM-107](../specs/DGM-107.md), [DGM-105](../specs/DGM-105.md), [DGM-108](../specs/DGM-108.md). [Lessons](../lessons.md) read before verification. This is a source-candidate review, not release approval or proof of the current packaged GUI. No Sprint 4, rebuild, publication, branch or commit is authorized by this result.

## Current Gates

The independent rerun executed `node scripts/verify-sprint3.mjs` exactly once, serially in sync PowerShell without a timeout. Process environment `DGM_S3_CASE`, `DGM_V1_CASE` and `DGM_V1_URL` was cleared for the invocation and restored afterward. The stress child intentionally selects its original V1 stress case. No source, test, configuration, specification, dependency or desktop files were edited. Only this review document was authored.

| Gate | Result | Timing | Evidence |
| --- | --- | --- | --- |
| Fresh FULL production browser, after pointer helper repair | **51 PASS / 0 FAIL / 51; exit 0** | 822.825s wall; 11:43:48.9929390Z to 11:57:31.8207260Z | [New timestamped log](../../app/test-results/sprint-3-verifier/20261011T114346538Z-full-post-pointer-repair.log), [51-case report](../../app/test-results/sprint-3-verifier/browser-report.json) |
| Latest predecessor independent `npm test -- --maxWorkers=1` | **5,431 PASS / 36 files; exit 0** | Vitest 278.88s; wall 284.676756s | [Source log](../../app/test-results/sprint-3-verifier-fresh-20261011T112013953Z-full-tests.log) |
| Latest predecessor independent `npm run typecheck` | **PASS; exit 0** | 10.0869735s wall | [Typecheck log](../../app/test-results/sprint-3-verifier-fresh-20261011T112504968Z-typecheck.log) |
| Latest predecessor independent `npm run build` | **PASS; exit 0** | 9.9378589s wall | [Build log](../../app/test-results/sprint-3-verifier-fresh-20261011T112520187Z-build.log) |
| Latest predecessor independent `npm run test:generators` | **20 PASS / 0 FAIL; exit 0** | 4418.3744ms runner; 5.0964369s wall | [Generator log](../../app/test-results/sprint-3-verifier-fresh-20261011T112535426Z-generators.log) |

The four source gates were inspected, not rerun: production is unchanged since those latest green logs; the subsequent repair changed only the verification pointer helper. Build warnings about chunks over 500kB and ineffective dynamic ELK import remain warnings, not repaired or suppressed.

Fresh report date: `2026-10-11T11:43:49.619Z`. Headless Microsoft Edge `155.0.4283.45`, Windows ARM64, existing production `dist` preview at `http://127.0.0.1:57416/` during the run only. **2,410 protected files; protectedChanges=[], errors=[], resources=[], remoteRequests=[]**. The harness ignores ResizeObserver-loop page errors by its existing policy; empty errors is not a claim that this policy was removed. Owned browser and preview both closed; existing ports 5174, 5186 and 5198 were left untouched. No persistent server was started. The child log's "server remains running" describes the borrowed parent preview before the parent closed it.

| Existing bundle | SHA-256 captured by the fresh runner |
| --- | --- |
| `index-4UcH5c1m.js` | `655cb7fff75c9195616b9dca54b50b4226ac7c678621a3e88def5103cbbb9854` |
| `index-DW7osfRk.css` | `7f0f0b0accf3bb244dade465d3f63646fd3f3c620c0809acf41f80487d203d5e` |
| `elk-worker.min-r_yRvuMO.js` | `e4f5c51c6f2fd564bb64e52e81c4a85a316ef2f24f8b90e1db5eb886c765b030` |

## Fresh Case Matrix

Each of the six viewport categories ran at 1440x900, 1280x720, 390x844 and 720x450, each in light and dark themes. The 390 viewport sets `hasTouch`; 720 uses deviceScaleFactor 2. These are automation settings, not physical touch or actual 200% browser zoom qualification.

| Case category | Fresh PASS / total | Contract coverage |
| --- | --- | --- |
| Background | 8 / 8 | DGM-114 appearance, pixels, reload, undo, contrast |
| Grid | 8 / 8 | DGM-115 combinations, pointer drag/drop/resize, nudge, paste, Present |
| Search and quick-add | 8 / 8 | DGM-106 aliases/session choices; DGM-107 atomic adjacent flow |
| Direct editing | 8 / 8 | DGM-108 real doubleclick, F2, input/IME/history/menu/lifecycle |
| Export clipboard | 8 / 8 | DGM-105 selection/framing, actual clipboard PNG, denied fallback |
| Readonly | 8 / 8 | Actual origin lock; settings/direct-edit/command/Present guards |
| Grid PNG pixels zero-origin negative-crop 1x 2x | 1 / 1 | Eight dots/lines x 1x/2x x transparent/opaque subcombinations |
| Background native hex reset one-undo | 1 / 1 | Two native drafts, one commit; invalid URL; omission reset |
| Production stress original unchanged 100 entities 150 edges | 1 / 1 | Original V1 stress fixture and thresholds, 20 edits and 10 layouts |
| **Total** | **51 / 51** | No case filter; no failed case |

## Acceptance Findings

The groupings below summarize the six approved contracts; they do not replace or amend their acceptance criteria. "Automated PASS" combines the latest full source/generator gates with the fresh production browser slice. Human/platform gates remain separate and unverified.

| Contract / AC grouping | Finding | Evidence and limits |
| --- | --- | --- |
| DGM-114 optional background, validation, legacy omission, one transaction, route preservation | Automated PASS | Latest source covers #RGB/#RRGGBB-only validation, omitted fallback, command/serialization/layout compatibility and revision restamping. Fresh native control makes two drafts into one commit, rejects URL input, resets by removing the field and undoes exactly. Settings never move fixture entities/connections. |
| DGM-114 canvas / Present / SVG / PNG, contrast and nonmutation | Automated PASS | Three backgrounds (#101010, #ff0000, #ffff00) in eight viewport/theme cases: 24 output sets, matching opaque RGB, 2x transparent alpha, reload and exact undo. Boundary/annotation markup parity and composited text contrast >=4.5 asserted. Component white tiles and saved colors/icons retained. Native outputs are self-contained. Transparent destination contrast cannot be guaranteed; destination background is unknown. |
| DGM-115 settings/defaults, independent controls and portable history | Automated PASS | Source validates complete optional grid and integer spacing 4..128, preserves omission and routes. Actual controls are Show grid, Snap to grid, Dots/Lines buttons, Grid spacing, Show grid in Present and Include grid in exports; Off is Show grid off, not a third style. Fresh eight style/visible/snap combinations per viewport/theme, invalid 15.5 spacing, reload and unchanged geometry. |
| DGM-115 absolute-origin snap, parent conversion and group/paste/resize policy | Automated PASS | Real palette drop, child drag, outer-subtree drag, boundary resize, nudge and nested paste with snap on/off and exact undo in all eight cases. Descendant offsets are not individually rounded. Snap-on plain arrow uses spacing, Shift four spacings; snap-off retains 8/64 baseline, as current source controls do. Minima/containment and nonquantized Auto-arrange are source-covered, not a claim of arbitrary exact grid minima. |
| DGM-115 Present/export grid and pixels | Automated PASS | Settled editor/Present zero-origin phase, default hidden Present, explicit inclusion independent of editor visibility. Native userSpaceOnUse pattern x=y=0, spacing 8, negative crop [-20,-20]; all eight pixel subcombinations assert grid ink and transparent alpha zero between marks. Grid is below artwork; no dense element expansion. |
| DGM-106 aliases/ranking/inventory and keyboard selection | Automated PASS | APIM->azure-api, AAD/Entra ID->azure-entra, ACA->azure-container-apps first in all eight browser cases. Source checks exact label/alias before prefix/substring, deterministic ties, AKS and lifecycle/inventory compatibility. Arrow/Enter/Escape focus, cancellation and normal click-to-place are asserted, including selected edge with no implicit split. |
| DGM-106 session favorites/recents and writable guard | Automated PASS; human timing UNVERIFIED | Source bounds favorites at 12 and recents at 8; editor-owned session state, no new JSON/profile retention. Browser proves only successful insertion records a recent, clear controls, favorite cancellation nonmutation, and reload clears choices. Readonly insertion guarded; favorites can remain nonmutating session choices. Automation is not an uncoached timed search trial. |
| DGM-107 atomic addConnected and containment/limits | Automated PASS | Source covers IDs, invalid source/target, depth/limits, whole-command rejection and one undo. Fresh source-component sibling and boundary-child placement with grid, all four directions, source/target sides, one node+edge, exact undo and unchanged existing absolute content. Ancestors may grow and shift origins with compensated children, as approved; no global layout or implicit reparent. |
| DGM-107 contextual UI, cancel/stale and timed flow | Automated PASS; M2 UNVERIFIED | Eight viewport/theme cases x four directions = 32 automated timings, alternating pointer and Enter, >=44px trigger targets, cancel/stale-document cancellation. Existing edge insertion is explicit. Timings include automation/search/screenshot/save/JSON steps, not five representative users adding, connecting and renaming within 20 seconds. |
| DGM-105 scope/framing/background/grid and source invariance | Automated PASS | Selection includes five entities (outer/inner/child/target/nested-note) and the internal connection, excludes external connection/service/outside note. Native content and 16:9 groups have identical transforms/markup; bounds expand, not stretch. Title/subtitle/synthetic and scoped legend retained. Diagram/White/Transparent and Include grid are export-only session presets; JSON/history unchanged. Source covers cap/stale/selection error paths. |
| DGM-105 clipboard/fallback/preview and guards | Automated PASS; native handoff UNVERIFIED | Eight real browser PNG write/read successes, denied clipboard-write policy yields actual PNG download and "not copied" status. Embedded font/icons, no external references; compact actual shared-scene preview and 13 >=44px visible controls. Source covers async/reentry/error/cancel guards. No Electron bridge, grant/security or API addition. Teams/Office paste is not established by browser clipboard read. |
| DGM-108 direct labels, keyboard/IME/blur/history | Automated PASS | All eight production cases edit component, connection and multiline note via F2 and physical doubleclick; Escape, Enter/Ctrl+Enter, composition, Delete isolation, blur one commit and exact undo. Source covers invalid limits. Multiline fixture grows from 60 to the established 61-unit minimum; positions/other geometry stay unchanged. This is existing text sizing, not a new auto-layout claim. |
| DGM-108 command menu/focus/disabled/lifecycle | Automated PASS; human rename UNVERIFIED | Actual Commands / Ctrl+K, filtered Pan/Grid/Export/Present dispatch, focus return, input shortcut isolation, readonly disabled options and Present blocks; stale replacement cancels drafts. State stays outside JSON. Source covers remaining mirrored callbacks and guards. No native Mac shortcut/IME or novice 20-second trial claimed. |

## Exact Performance

Fresh original runner: [performance JSON](../../app/test-results/sprint-3-verifier/Production-stress-performance.json), [child report](../../app/test-results/sprint-3-verifier/focused-Production-stress.json), [stdout](../../app/test-results/sprint-3-verifier/original-stress.stdout.log), [stderr/lifecycle](../../app/test-results/sprint-3-verifier/original-stress.stderr.log), [stress screenshot](../../app/test-results/sprint-3-verifier/stress-production.png).

Unchanged `verify-v1.mjs`, fixture `stress-v1`, **100 entities / 150 edges**, fixture-source SHA-256 `63abe1fe35e62379677892b30863cb2dc858ea8bbff9b9e5402f46edf14dd16f`. Windows 10.0.26200 ARM64, Snapdragon X 12-core X1E80100 @3.40GHz, 12 logical CPUs, 31.567352294921875GiB memory; Edge 155.0.4283.45; 1440x900 production viewport. Method: DOM keyboard dispatch to two requestAnimationFrame callbacks; worker-layout click to enabled button plus two frames. 30 accepted commits (20 edits, 10 layouts). Thresholds unchanged: edit p95 <=100ms; **each** of ten layouts <=2000ms. No retry or substituted fixture.

**Fresh edit p95: 51.69999998807907ms; maximum layout: 734.1999999880791ms. Both gates PASS.** Raw milliseconds, in recorded order:

```json
{
  "editMilliseconds": [41.900000005960464, 48, 34.80000001192093, 31, 32.5, 33.5, 33.29999998211861, 51.69999998807907, 31.5, 33.400000005960464, 52.599999994039536, 33.19999998807907, 30.80000001192093, 33.5, 33.30000001192093, 33.39999997615814, 33.30000001192093, 33.19999998807907, 33.5, 34.60000002384186],
  "layoutMilliseconds": [594.3999999761581, 683.7000000178814, 582.9000000059605, 565.9000000059605, 734.1999999880791, 484.2000000178814, 566, 582.9000000059605, 566.2999999821186, 599.5]
}
```

All **32 fresh quick-add timings** below are raw ms from the report. Left/top use pointer; right/bottom use Enter. Minimum **966.0426999999909ms**, maximum **1394.753800000064ms**. No new quick-add performance threshold was invented; these do not pass M2's combined human creation/rename trial.

| Viewport / theme | Left | Right | Top | Bottom |
| --- | --- | --- | --- | --- |
| 1440 light | 1326.1045000000013 | 1131.3801000000021 | 1158.8562999999995 | 1096.481799999994 |
| 1440 dark | 1273.307799999995 | 966.0426999999909 | 1023.5861999999906 | 1019.1223000000173 |
| 1280 light | 1274.459600000002 | 1151.9201999999932 | 1205.3763000000035 | 1180.5527000000002 |
| 1280 dark | 1146.983200000017 | 990.7560999999987 | 1122.886599999969 | 1065.8411999999662 |
| 390 light | 1256.1352000000188 | 1142.4170000000158 | 1084.8355999999912 | 1092.2872999999672 |
| 390 dark | 1172.9139999999898 | 1152.7874999999767 | 1074.4549000000115 | 1098.5687000000034 |
| 720 light | 1301.0589999999502 | 1068.3636000000406 | 1005.7251999999862 | 1165.6503000000375 |
| 720 dark | 1394.753800000064 | 1075.348100000061 | 1056.0281999999424 | 1060.4518999999855 |

## Screenshots and Exports

Fresh screenshots/exports are in [the 51-case report](../../app/test-results/sprint-3-verifier/browser-report.json); numbered downloads below belong to this full run. Old failure images may still exist in the output directory and are not fresh failures: use the report and timestamped log to determine current results.

| Inspection surface | Actual evidence |
| --- | --- |
| Grid 720 helper-repair result and exact geometry | [720 light resize](../../app/test-results/sprint-3-verifier/720-light-grid-on-resize.png), [720 dark resize](../../app/test-results/sprint-3-verifier/720-dark-grid-on-resize.png), [720 dark Present grid](../../app/test-results/sprint-3-verifier/720-dark-grid-present.png) |
| Dark/saturated background parity | [1440 dark canvas](../../app/test-results/sprint-3-verifier/1440-dark-101010-canvas.png), [1440 dark Present](../../app/test-results/sprint-3-verifier/1440-dark-101010-present.png), [390 red canvas](../../app/test-results/sprint-3-verifier/390-light-ff0000-canvas.png), [390 yellow Present](../../app/test-results/sprint-3-verifier/390-light-ffff00-present.png) |
| Adjacent search and unchanged-graph undo | [1440 left picker](../../app/test-results/sprint-3-verifier/1440-light-left-picker.png), [1440 left added](../../app/test-results/sprint-3-verifier/1440-light-left-added.png), [added JSON](../../app/test-results/sprint-3-verifier/15-1440-light-left-added-Independent-Sprint-3.json), [exact undo JSON](../../app/test-results/sprint-3-verifier/16-1440-light-left-undo-Independent-Sprint-3.json) |
| Inline direct editing | [390 component](../../app/test-results/sprint-3-verifier/390-light-inline-component.png), [390 connection](../../app/test-results/sprint-3-verifier/390-light-inline-connection.png), [720 dark note](../../app/test-results/sprint-3-verifier/720-dark-inline-note.png) |
| Export controls and actual clipboard output | [390 light preview](../../app/test-results/sprint-3-verifier/390-light-export-preview.png), [720 dark preview](../../app/test-results/sprint-3-verifier/720-dark-export-preview.png), [actual clipboard PNG](../../app/test-results/sprint-3-verifier/1440-light-clipboard-real.png) |
| Native scoped vector / raster files | [content SVG](../../app/test-results/sprint-3-verifier/181-1440-light-selection-content-Independent-Sprint-3.svg), [16:9 SVG](../../app/test-results/sprint-3-verifier/182-1440-light-selection-wide-Independent-Sprint-3.svg), [white grid 2x PNG](../../app/test-results/sprint-3-verifier/183-1440-light-white-grid-2x-Independent-Sprint-3.png), [transparent grid 1x PNG](../../app/test-results/sprint-3-verifier/184-1440-light-transparent-grid-1x-Independent-Sprint-3.png), [transparent grid SVG](../../app/test-results/sprint-3-verifier/185-1440-light-transparent-grid-vector-Independent-Sprint-3.svg) |
| Denied browser clipboard and exact invariants | [fallback PNG](../../app/test-results/sprint-3-verifier/187-1440-light-clipboard-denied-fallback-Independent-Sprint-3.png), [export invariant JSON](../../app/test-results/sprint-3-verifier/186-1440-light-export-invariant-Independent-Sprint-3.json), [fallback invariant JSON](../../app/test-results/sprint-3-verifier/188-1440-light-fallback-invariant-Independent-Sprint-3.json) |
| Actual read-only origin / Present | [720 dark readonly Present](../../app/test-results/sprint-3-verifier/720-dark-readonly-present.png) |

Directly inspected: 720 dark snap-on resize, 390 light export preview, 1440 light clipboard PNG. All are nonblank; the mobile export controls are unclipped and the selected clipboard picture excludes editor chrome. The Grid 720 fit-all screenshot has very small artwork: it demonstrates real pointer targeting and geometry, **not** meeting-label readability or a Teams recipient result.

Raw 1440-light export measurements: content viewBox `-101.25 -64.5 820 664`; 16:9 viewBox `-283.25 -65.5 1184 666`; five unchanged entity groups. Clipboard PNG 1184x666, corner [16,16,16,255], alpha pixels 788544, ink 394046. White/grid 2x PNG 2368x1332, corner [255,255,255,255], alpha 3154176, ink 1446397. Transparent/grid 1x PNG 1184x666, corner [0,0,0,0], alpha 400343, ink 400314. Denied clipboard fallback 820x664, corner [0,0,0,0], alpha 394052, ink 393934.

## Retained History and Repairs

1. Earlier parallel/default-worker attempts included an import-observation timeout (`Commerce platform` instead of `Direct editing`), while a historical run also passed 5,431 tests. Retained [independent failure summary](../../app/test-results/sprint-3-verifier-prior-20261011T112601272Z/20261011T084703Z-verification-summary.json) and [failed source log](../../app/test-results/sprint-3-verifier-prior-20261011T112601272Z/20261011T084703Z-01-full-tests.log) do **not** establish concurrency or production causality. Green elsewhere did not erase the failure.
2. A serialized run still failed the mobile inline-input camera target: 5,430 PASS / 1 FAIL, 35 PASS files / 1 FAIL, 222.37s, exit 1 ([log](../../app/test-results/sprint-3-verifier-prior-20261011T112601272Z/20261011T085645682Z-serialized-full-tests.log)). Owner repaired **test readiness**, awaiting fonts and 18 stable viewport-transform frames before target use, not production camera behavior. [Current readiness test](../../app/src/editor/direct-edit.browser.test.ts) and fresh eight production direct-edit cases plus the latest 5,431 source PASS establish green. The retained [owner camera full-test log](../../app/test-results/sprint-3-owner/108/20261011T090237491Z-camera-full-tests.log) contains a failed intermediate attempt and is not relabelled PASS.
3. Windows Modern Standby was confirmed by the owner using System Kernel-Power events 506/507 for **10:53:13-13:17:41 local time on 2026-10-11**. The [interrupted full-run log](../../app/test-results/sprint-3-owner/108/20261011T090237491Z-camera-full-tests.log) reported an approximately 7,995-second grid test while the machine was suspended; the owner canceled only that run's process tree. It is **interrupted, not PASS**, and is not a reproducible grid product defect. This verifier did not collect a separate Windows event export.
4. The predecessor's completed fresh full gate was **49 PASS / 2 FAIL / 51, exit 1, 785.2798572s** ([timestamped log](../../app/test-results/sprint-3-verifier-fresh-20261011T112601272Z-browser.log), [preserved report](../../app/test-results/sprint-3-verifier/20261011T114346538Z-pre-run-candidate/browser-report.json)). Exact failed cases: `Grid 720 light`, `Grid 720 dark`; both `locator.evaluate: Error: No unobstructed physical target for child`, stack through `pointerPoint` -> `drag` -> Grid check. A fixed 12px inset missed a roughly 7.91px-high fitted node. This was a **harness target-selection failure**, not a document/geometry acceptance failure. Its original stress still passed: p95 **43.79999998211861ms**, max layout **1665.5999999940395ms**; prior 32 quick-add timings were approximately 962.28-1379.16ms, not substituted for fresh samples above.
5. Owner minimally repaired **only the script helper** to proportionally scan the actual rendered rect/header, require real `elementFromPoint` ownership by the exact node, and exclude connection/resize handles. No synthetic click, geometry/history assertion relaxation or production change. Focused `DGM_S3_CASE='Grid 720'` then passed **2 / 2, exit 0**, date `2026-10-11T11:41:15.898Z`, protectedChanges=[] ([focused log](../../app/test-results/sprint-3-owner/115/20261011T114112741Z-pointer-target-repair/focused-Grid-720.log), [focused report](../../app/test-results/sprint-3-owner/115/20261011T114112741Z-pointer-target-repair/focused-Grid-720-browser-report.json)). Focused success alone was not full acceptance.
6. This verifier archived the existing output under `app/test-results/sprint-3-verifier/20261011T114346538Z-pre-run-candidate/` before overwriting fixed artifact names. The owner archive under `app/test-results/sprint-3-owner/115/20261011T114112741Z-pointer-target-repair/pre-repair-verifier/` and historical/prior candidate directories were preserved. The **single fresh unfiltered full rerun is now 51 / 51**, with no protected production/test/config/spec changes. Both repairs above belong to owners; this verifier made no repairs.

## Manual Gates and PO Stop

**UNVERIFIED**, not waived or automatically passed:

- Actual Teams recipient sharing/readability: second recipient correctly identifies named labels/connections and verifies presenter return. Automation and fit-all screenshots do not meet that criterion.
- Native Teams/PowerPoint/Office paste and existing Office SVG/PNG insertion fidelity; browser clipboard read/download is not native application paste, and images are not editable Office shapes.
- Uncoached novice task / existing AC-13 and the five-user M2 trial, including add/connect plus rename within 20 seconds (at least four successful without help). No human timing was collected.
- Native macOS behavior, platform shortcuts/IME, OS policy, cold offline/current packaged GUI and supported-build qualification. Existing historical packages do not contain verified evidence for this source candidate.
- Physical 200% browser zoom and physical touch/tablet behavior. DeviceScaleFactor/viewport/hasTouch simulation is only automated reachability evidence.

No automatic Sprint 4 and no release/rebuild. After verification, the owner reconciled the roadmap, manual, lessons and decision log with this source candidate; the verifier made no production repairs. Frozen task contracts remain unchanged.

**Status:** done for requested independent automated verification; PO review and manual acceptance remain open.

**Changes:** timestamped full-run evidence and preserved pre-run candidate artifacts; this review document only. Production/test/config/spec/dependency/desktop files unchanged by the verifier.

**Evidence:** fresh 51/51 and unchanged performance thresholds; latest predecessor 5,431 source tests / 36 files, typecheck/build and 20 generators carried forward with their actual logs; six-contract AC matrix, screenshots and native export bytes above.

**Docs updated:** this review only.

**Open issues / decisions needed:** PO-led closure/disposition of manual gates. Owner manual/roadmap/lessons reconciliation is complete. No new automated defect in the fresh report and no release recommendation implied.