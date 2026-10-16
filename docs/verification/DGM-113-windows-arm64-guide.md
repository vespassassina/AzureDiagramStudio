# DGM-113 Current-Guide Windows ARM64 Package Owner Report

Updated: 2026-10-16. Role: IMPLEMENTER / PACKAGING OWNER only.
Status: **OWNER PACKAGE GREEN; INDEPENDENT NATIVE AND HUMAN ACCEPTANCE PENDING**.
Contract: [frozen current-guide authorization](../specs/DGM-113.md#current-guide-windows-arm64-authorization---2026-10-16).
This report records packaging and static inspection, not native execution or a
platform/support/publication claim. The owner did not launch either executable.

## Candidate And Artifact

- Source HEAD: `52f66306e09798b79d907e97f52c03ddada2e1ad`;
  source milestone `source-v0.2.0-dgm117`; version unchanged at `0.2.0`.
- Cell: [retained owner evidence](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/).
- EXE: [new isolated portable](../../app/test-results/platform/windows-arm64/20261016T130515040Z/candidate/app/release/Azure-Diagram-Studio-0.2.0-win-arm64-portable.exe).
- SHA256: `89eefd80ccfa78ef5ceb7fb366e980df05dd42d728d4476ae34db240023b9f8c`.
- Size: **403,339,602 bytes**. Bootstrap PE: **x86 `0x014c`**, NotSigned.
- Embedded Electron 44.0.0: **ARM64 `0xaa64`**, NotSigned, product version `0.2.0.0`;
  executable SHA256 `73ef72294dc2de5eda8548bfd76f58637b907d54ce5f2ca33654e0a6d070b2d0`.
- ASAR SHA256: `bc8977742c8d8d434f619ca67a1079e2ab95309248680a9cab2c6482754dc4bd`;
  19,740,526 bytes; **42/42 files match staged bytes** with no extra files.
- Extracted portable payload: **73 files / 402,605,728 bytes**, every file
  byte-identical to the builder's unpacked ARM64 runtime tree.
- Packaging cwd: `C:/Projects/Diagrammer/app/test-results/platform/windows-arm64/20261016T130515040Z/candidate/app`.
  Owner terminal cwd at handoff: `C:/Projects/Diagrammer`.

Full observations: [ASAR, PE and signatures](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-asar-validation.json),
[payload identities](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-portable-payload-validation.json),
[owner handoff](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-owner-handoff.json).

## Source And Build Provenance

The current source/public/scripts/electron/root package/config inputs match
the accepted [guide verifier baseline](../../app/test-results/first-use-guide/20261016T062635388Z/verifier/baseline.json).
The [parent closeout](../../app/test-results/first-use-guide/20261016T062635388Z/parent/closeout.json)
supersedes its older document hashes. Later intentional roadmap and DGM-113
authorization edits are excluded from that old document comparison, but remain
byte-protected by this cell's own baseline and were not edited by the owner.

The independently accepted **36-file dist** was copied exactly, without a
redundant renderer rebuild. Main bundle SHA256:
`27ee4d4e5f90e3d42a1258757f6e5d159f6c2cdeca9f9f9d74c66745d59583b4`.
The [reuse proof](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-dist-reuse-proof.json)
retains the original typecheck/build exits, 18 focused passing tests with 242
nonselected tests skipped, 16 browser groups and 60 geometry combinations.
Those are reused source results, not fresh full-suite or packaged Help results.

The candidate contains **2,435 tracked input files**, six examples and
**16,350 stable raw dependency files / 248,707,897 bytes**. All 37 installed
Bluebird `js/release` files are included. The 11 ignored browser-evidence files
under the source evidence directory were byte-inventoried in the original
baseline and explicitly omitted from the candidate copy only. No original
dependency junction, historical test-results tree or generated dependency cache
was copied. No dependency installation command was run. Complete manifests:
[source](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-candidate-source-manifest.json),
[dependencies and exclusions](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-candidate-dependency-manifest.json),
[stage](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-stage-manifest.json).

## Executed Gates

All one-shot commands ran serially and synchronously; exit 0 for each completed
phase. The helper never launches the application. Commands below used only the
isolated candidate cwd:

```text
node --test --test-reporter=tap electron/test/*.test.mjs
node scripts/stage-desktop.mjs
node node_modules/electron-builder/out/cli/cli.js --config electron-builder.config.cjs --win --arm64 --publish never
```

- Policy: **33 tests passed, 0 failed/cancelled/skipped/todo**, 547.8452ms.
  [TAP log](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-policy.log).
- Package: **13:37:42.467Z to 13:38:24.798Z**, exit 0.
  [Full builder log](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-package.log).
  Credentials/signing/Apple/GitHub variables were removed from child environments
  and `CSC_IDENTITY_AUTO_DISCOVERY=false` was child-only. Builder download,
  native-dependency and signing-step messages are retained; the measured result
  is NotSigned and unchanged candidate dependency bytes, not a signed/offline claim.
- Static Help bundle strings `Help`, `Next`, `Back`, `Finish`, `guide` present.
  Their presence is not behavioral Help acceptance.
- Existing cached 7-Zip was identified as x86 despite its ARM64 directory label.
  Static extraction exited 0, reporting trailing-data warning and "Everything is
  Ok"; all 73 extracted files match the unpacked tree. No nested extraction was
  necessary and neither portable nor embedded runtime was executed.
- [Postbuild audit](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-postbuild-protection.json)
  completed at **13:40:14Z** with zero scope differences. Candidate source,
  dependencies, examples, dist, stage, payload and artifact identities match.
  HEAD, intentional Git diff and existing listeners on 5207/5218/5224 remain
  unchanged. [Process observation](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-owned-process-observation.json)
  found no other cell process. Owner native launches: **0**.

## Recovery And Protection Limits

**DGM113-GUIDE-OWNER-001 resolved at attempt 1 / cycle 1.** The single initial
recovery read found no completed baseline and PID 40892 still hashing historical
duplicates. Original start 13:09:15Z, parent 12104 and exact command/creation time
were verified before stopping only that PID at 13:29:52Z. The original terminal
UUID `317c88a4-eb7c-4a1a-b676-75ed14e7e1a4` was unavailable; original exit code
is unknown. Original baseline is **STOPPED / INCOMPLETE, NOT PASS**. Preparation,
policy, stage, package, inspection, payload and audit had not run in that helper.
The separate original inspection repair count remains one and was not reset.

The original helper, start/context, inspection failure and recovery remain
untouched. [Stop snapshot](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/baseline-v01-stop-snapshot.json)
preserves command/PID/creation time, CPU and I/O counters; the
[interruption receipt](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/baseline-v01-interruption.json)
records cleanup and incomplete phases. New
[v02 helper](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/package-guide-v02.mjs)
passed syntax and focused checks, then completed a new corrected baseline and
all remaining phases with new receipt stems. No completed baseline was restarted.

[Exact scope](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-scope.json)
and [baseline manifest](../../app/test-results/platform/windows-arm64/20261016T130515040Z/owner/v02-baseline-protection.json)
record byte protection for 2,446 original executable/input files, 16,350 stable
raw dependencies, 36 original dist files, 160 original release files, 42 original
stage files, 67 existing docs, root files, workflows, examples and 761 relevant
authority/artifact files. These include accepted guide authorities, the old
published EXE and publication/native provenance. The old 403,328,830-byte EXE
retains SHA256 `2ae7d752b5d8fd17766912521d3b74efe7393150d44a1ffd3a534a8f20a066df`.
Existing app profile data (54 files in the existing Roaming app profile) remain
byte-identical; six named app-profile locations were checked, with five absent.

Historical test-results protection is deliberately **metadata-only** for
**17,491 path/size/mtime entries**, with **three explicitly recorded subtree
boundaries** for expensive nested dependencies/Git metadata. The own cell is
excluded. Generated dependency `.tmp`, `.vite`, `.vite-temp` caches have a
separate metadata inventory and are excluded from stable dependency copying.
Relevant historical authorities/artifacts are separately byte-hashed. This is
**not full historical byte proof** or an all-history-unchanged-byte claim.

Writes were confined to this fresh cell and this new owner report. Production,
tests, harness, dependencies/config/security, existing docs, Git refs/index,
published assets, profiles and other targets were not modified. No elevation,
credential/certificate access, signing, publication or CI operation was performed.

## Independent Verifier Next Action

1. Create a fresh verifier workspace/profile beneath this same authorized cell.
   Retain the owner candidate and all first-run evidence. Bind the run to the
   exact EXE SHA256/size above, actual runtime architecture and input manifests.
   Copy exact bytes; do not rebuild or launch an old version-matched EXE.
2. Execute the actual portable EXE, not merely unpacked Electron. Run the current
   desktop checks in the artifact-backed workspace, preserving stdout/stderr,
   UTC/exit/totals, screenshots, downloads and process identities. Check assets,
   worker/layout, local origin/sandbox, storage/relaunch/lock and JSON/SVG/PNG.
3. In that packaged ARM64 runtime, independently exercise all ten ordered Help
   steps, spotlight/card geometry, keyboard navigation/trap/Escape/replay,
   panel restoration and pending-edit preservation. Include desktop and
   narrow/short windows and inspect their screenshots. The existing desktop
   runner alone does not cover this current-guide acceptance.
4. Audit protected scopes and cleanup all owned verifier processes without
   disturbing existing profiles or ports 5207/5218/5224. Preserve any failure
   and route confirmed defects to their scoped owner; never weaken assertions.

Native automation remains **PENDING**, owned by the separate verifier. Physical
offline, downloaded-file SmartScreen/policy, human dialogs/IME/clipboard,
Teams/Office, novice trials, physical zoom/touch and other devices remain
BLOCKED / NOT RUN. No native or human PASS is claimed by this report.

## Independent Native Verification - 2026-10-16

**Status: DONE for the authorized automated subset; native general + packaged
Help PASS; final protection/cleanup PASS. Human and other-platform acceptance
remain BLOCKED / NOT RUN.** Role: INDEPENDENT NATIVE VERIFIER. This appended
section supersedes the owner's native-PENDING handoff only; all preceding owner
history, first failures and the resolved owner defect remain unchanged.

[Final independent closeout](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/independent-closeout.json)
binds the result to the exact 403,339,602-byte portable EXE, SHA256
`89eefd80ccfa78ef5ceb7fb366e980df05dd42d728d4476ae34db240023b9f8c`,
HEAD `52f66306e09798b79d907e97f52c03ddada2e1ad`, source milestone
`source-v0.2.0-dgm117`, version 0.2.0. The actual portable was launched, not
unpacked Electron or a source preview. Native host: Snapdragon X1E80100,
CIM architecture 12 / ARM64, Windows 11 Enterprise 10.0.26300.

Actual packaged runtime: **ARM64 Electron 44.0.0**, local `ads://studio/`,
sandbox/contextIsolation/webSecurity true, nodeIntegration false. The live
extracted runtime EXE SHA256 is
`73ef72294dc2de5eda8548bfd76f58637b907d54ce5f2ca33654e0a6d070b2d0`;
live ASAR SHA256 is
`bc8977742c8d8d434f619ca67a1079e2ab95309248680a9cab2c6482754dc4bd`.
Independent PE inspection confirms x86 `0x014c` bootstrap versus ARM64 `0xaa64`
payload. Portable signature observation remains NotSigned; embedded NotSigned
is the retained owner observation, not a new signing or policy acceptance.

### Bounded Provenance And Workspace

The [first bounded baseline](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/baseline-command-result.json)
ran 13:46:36.270Z to 13:47:32.036Z, exit 0. It checked original source/public/
scripts/electron/package/config, stable raw dependencies, dist/stage/release,
relevant historical authorities and old published EXE, and existing app-profile
bytes against the owner's bounded manifest. Current roadmap/spec bytes were
recorded separately as intentional parent documentation changes. The owner's
new report and this authorized cell are expected writable outputs.

Historical archives remain **metadata-only**: 17,491 path/size/mtime entries,
three retained node_modules/.git subtree boundaries, current cell excluded.
No multi-GB historical byte traversal or original incomplete scan was reopened.
`DGM113-GUIDE-OWNER-001` remains attempt 1 / cycle 1 RESOLVED, not reset.

[Candidate provenance](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/baseline-candidate.json)
matches 2,435 source inputs, 16,350 stable dependency files, 36 accepted dist
files, 42 staged files and the owner release manifest. All 42 ASAR files match
stage bytes. [Fresh workspace manifest](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/workspace-manifest.json)
proves exact copies under verifier/workspace/app. No source build, package
rebuild, dependency installation, junction or original cache write was used.
Child credential/signing/Node-injection variables were excluded, and APPDATA,
LOCALAPPDATA, USERPROFILE, HOME, TEMP and TMP were redirected beneath verifier/.
Profile hashing was read-only, not interactive use of existing profiles.

Source acceptance remains **reused, not freshly rerun**: 18 focused tests,
typecheck/build, 16 browser groups and 60 source geometry combinations. The
owner's 33 policy tests and 73-file portable extraction proof are retained
owner evidence. Neither is substituted for the new native execution below.

### Commands And Results

All commands were serial/synchronous. First logs, process IDs, UTC and exits
were retained before local assertions. CWD for native checks:
`app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/workspace/app`.
`guide-native.mjs` below is the new verifier-local helper one level above
workspace/, not an original harness edit. Exact absolute commands and log hashes
are in the linked receipts.

| Command / receipt | UTC start to end | Exit / result |
| --- | --- | --- |
| `node scripts/verify-desktop.mjs arm64`; [receipt](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/native-attempt1-cycle0-result.json) | 13:50:23.037Z to 13:52:09.941Z | 0; **10 groups / 3 sessions / 8 downloads**; first run PASS |
| `node guide-native.mjs`; [first failure](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/guide-attempt1-cycle0-result.json) | 13:54:49.355Z to 13:54:49.501Z | 1; verifier ESM import failed before native launch |
| `node guide-native.mjs 1`; [retained run](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/guide-attempt1-cycle1-result.json) | 13:55:25.475Z to 13:56:26.312Z | 1; **13 groups PASS / 5 verifier setup failures**, one portable session |
| `node guide-native.mjs 2`; [scoped recheck](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/guide-attempt1-cycle2-result.json) | 13:57:24.672Z to 13:58:02.997Z | 0; **5/5 previously uncovered groups PASS**, one fresh portable session |
| `node guide-native.mjs 2 tail`; [focused follow-up](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/guide-contract-tail-result.json) | 14:02:12.402Z to 14:02:34.229Z | 0; pointer Back + resize-while-open PASS, one fresh portable session |

Aggregate accepted coverage: **29 groups** = 10 general + 19 Help; **6 portable
sessions**, plus one same-session native read-only sibling window; **8 native
DownloadItems**, **108 PNGs retained** (including five first-failure PNGs),
**80 ten-step geometry combinations + 3 live-resize geometry checks**.
The cycle-1 counter's 41 geometryCases included a scalar read-only step count;
the aggregate counts only actual step arrays, yielding 40 + 40 = 80.

### Actual Acceptance Coverage

| Frozen criterion | Observed result / boundary |
| --- | --- |
| AC113-1 provenance/native identity | Exact candidate, portable, runtime, ASAR, stage/dist/dependency identities independently matched; no version-only or old-artifact substitution. |
| AC113-3 local-first general checks | Bundled glyph/font/ELK worker, layout + exact Undo, local origin/security, normalized custom SVG/PNG/JPEG/GIF/WebP, atomic unsafe rejection, internal cross-document clipboard, JSON/SVG/PNG downloads and nonblank/icon pixels, theme parity, autosave/move/relaunch PASS. Offline is CDP/session emulation before renderer navigation, not physical disconnection. |
| AC113-4 automated input/output | Actual portable keyboard/pointer, JSON file-input adapter and DownloadItems/save-dialog options PASS. Human physical chooser/save/cancel/denial, native IME and clipboard remain unverified. |
| Packaged Help order/geometry | All ten titles and n/10 progress, actual spotlight target/card containment, contrast, 44px navigation and hit testing PASS across light/no-preference and dark/reduced-motion variations. Native content 1440x900 and 720x450; exact 390x844 and 720x450 CDP viewports separately labelled emulation. Missing target remains covered by reused component tests; no DOM deletion used. |
| Help navigation/isolation | Physical pointer Next/Back/Close/Finish; Enter/Space Next/Back/Close; Help Enter/Space, Finish Enter/Space; Tab/Shift+Tab trap including content region; Escape/replay/focus return PASS. Background shortcuts and pointer blocked with nonempty Undo/Redo and internal clipboard. |
| Pending edits/history | Active title, inspector and inline drafts preserved across hit-tested physical Help, with no preceding download/commit. Exact canonical storage/local preferences, selection, settled camera, tools, panels and Undo/Redo preserved; explicit commit then one Undo restores exact document. No Next/tutorial document mutation, including Blank. |
| Panel/modal/read-only guards | Closed/library/inspector intent restored at narrow CDP viewport; open-guide resize 1440 -> 390 -> 720 -> 1440 PASS. New/Commands/Export stacking guards PASS. A real same-session native sibling receives Web Locks read-only denial; ten forward/nine backward steps and Finish Space preserve state with editing disabled. Sibling uses the same packaged session/origin and secure preferences, not a second portable instance. |
| Composition boundary | Synthetic compositionstart/end and composing Escape guards PASS for title/inspector/inline. Native human IME NOT verified. |
| AC113-2/5/6 separation | This automated Windows ARM64 subset only; no other browser/device/platform, physical/manual or general release/support acceptance inferred. |

Native minimum was **not changed**: 640x480 outer-window minimum. A requested
390px native content width was clamped to **626px**; successful 390x844 checks
use an attached CDP CSS viewport override, not a physical narrow native claim.
Dark mode used the actual app toggle; reduced motion used Chromium media
emulation, not an OS policy/settings change. Fonts and camera were settled over
stable frames before exact nonmutation snapshots; no camera tolerance was relaxed.

### Retained Failures And Repairs

- [DGM113-GUIDE-VERIFIER-001](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/DGM113-GUIDE-VERIFIER-001.json): new harness Windows absolute-path ESM import, before native launch. RESOLVED at verifier repair cycle 1 using a file URL. Original helper bytes and first log retained.
- [DGM113-GUIDE-VERIFIER-002](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/DGM113-GUIDE-VERIFIER-002.json): five retained raw DGM113-GUIDE-NATIVE-001 through -005 failures occurred before guide assertions: detached CDP override reverted 390px to native 626px; two short-window theme clicks lacked natural scrolling. RESOLVED at verifier repair cycle 2 with an attached CDP session and scroll-into-view before unchanged hit testing. Only those five groups were rechecked; the 13 passing groups were reused. No existing runner/product change, weakened timeout or acceptance assertion, or confirmed product defect.

### Visual Evidence And Cleanup

Inspected with view_image: [desktop dark step 6](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/guide-attempt1-cycle1/1440x900-native-actual-dark-reduce-step-06.png),
[390px CDP step 6](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/guide-attempt1-cycle2/390x844-CDP-light-no-preference-step-06.png),
and [short CDP step 8](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/guide-attempt1-cycle2/720x450-CDP-light-no-preference-step-08.png).
Readable contained text, separated/anchored spotlight, complete navigation and
nonblank application artwork were observed. Image hashes are in the closeout.
Screenshot pixels include device scaling; CSS viewport dimensions above are
measured separately and are not physical zoom/touch evidence.

[Final bounded audit](../../app/test-results/platform/windows-arm64/20261016T130515040Z/verifier/audit-final-result.json)
completed **14:03:47.184Z, PASS**, zero protected-scope differences. All **12
tracked launcher/runtime process records exited**, with identity-checked cleanup;
no owned native process remains. Preview **5224 / PID 23936** is unchanged;
5207/5218 listener state remains unchanged. Owner evidence, candidate source/
dependencies/dist/stage/release, old artifacts, existing profiles and historical
metadata remain protected. Initial audit evidence is retained separately.

The owner report's original **11,043-byte prefix**, SHA256
`3518898b82c393eda10880966712f90b27aeb4b5627579543eab073c8f93918c`,
was copied into verifier evidence before this append. The final append-only
validation records the whole report's before/after hash; no owner history was
edited. Writes are confined to verifier/ and this appended independent section.
No source/tests/original-harness/spec/roadmap/manual changes, Git mutation,
network write, installation, signing/elevation/policy change or publication.

**Remaining BLOCKED / NOT RUN:** physical offline, downloaded-file SmartScreen/
managed-device policy, human native dialogs/IME/clipboard, Teams/Office recipient
handoff, novice usability, physical zoom/touch and other platforms/devices.
No unresolved automated verification failure remains. Parent owns queue/manual
reconciliation and the human handoff of this exact local EXE and checksum;
publication, support scope and release acceptance are not authorized here.

## Parent Visual Review And Human Handoff - 2026-10-16

PASS for the inspected current-package visual examples. The parent opened the
retained native desktop dark Properties, 390px CDP Properties and short CDP Save
screenshots linked above. Text and navigation controls are contained/readable,
targets are clearly highlighted and not occluded by their callouts. This
supplements the independent geometry matrix, not human novice acceptance.

The queue, cell contract and manual now distinguish this exact local EXE from
the unchanged public 0.2.0 release. The next action is human physical offline,
normal downloaded-file/SmartScreen policy, native dialogs/IME/clipboard and
Teams/Office/novice acceptance on assigned targets. No further automated rerun,
rebuild, signing or publication is implied by that handoff.

The parent [delivery validator](../../app/test-results/platform/windows-arm64/20261016T130515040Z/parent/finish.mjs)
records final document links/hashes, the artifact checksum and the unchanged
original owner-report prefix. No source/config/harness or Git/release state
was changed by this documentation reconciliation.