# DGM-113 Windows ARM64 Current Independent Result

2026-10-15. **Status: bounded native ARM64 automated PASS / protection audit PASS;
overall platform qualification BLOCKED on manual gates.** Role: independent
PLATFORM VERIFIER; source/test/harness fixes: zero. The approved corrected gate
ran once in a fresh artifact-backed workspace, exit 0, from
`2026-10-15T16:46:54.675Z` to `2026-10-15T16:48:42.599Z`: 10 completed check
groups, exactly 3 sessions, 8 downloads and all 8 tracked processes exited.
No owned application process remains. `DGM113-ARM64-001` passes at attempt 1 /
repair cycle 1 of maximum 3; counters were not reset. The first native FAIL and
both owner sections below remain intact historical evidence, not current status.

[Independent closeout](#independent-native-recheck---2026-10-15),
[command/log identities](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/run-result.json),
[completed protection audit](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/post-run-audit.json)
and [observations/handoff](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/independent-observations.json).
No rebuild, source suite, new dependency, settings/security change, publication,
signing, commit or support promise was made. Physical offline, downloaded-file
policy and human native/Teams/Office checks are **BLOCKED**, not PASS.

---

# DGM-113 Windows ARM64 Owner Package

## Owner Handoff - 2026-10-15

**Status: OWNER PACKAGE GREEN / Runtime NOT RUN / independent verification pending.**
Role: IMPLEMENTER + LOCAL PACKAGING OWNER, not independent verifier.
Authority: [bounded ARM64 authorization](../specs/DGM-113.md#windows-arm64-authorization---2026-10-15).
Cell: `app/test-results/platform/windows-arm64/20261015T134635385Z/`.

Candidate identity is HEAD `a523a7e4feca5148d1a1a28fc34e97d28c82d1d6`
**plus** the retained uncommitted Catalog repair and the two separately recorded
harness changes, not HEAD alone. Host: Snapdragon X1E80100, Windows 11 Enterprise
`10.0.26300`, CIM processor architecture 12, environment/Node ARM64.
[Baseline and host](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/baseline.json).

### Harness Evidence

Only [runner](../../app/scripts/verify-desktop.mjs) and
[existing shell tests](../../app/electron/test/shell.test.mjs) changed in the
original app: package-derived artifact/report version and runtime-version check;
explicit Blank in all three New chooser paths; dialog-scoped export controls.
Actual accessible export names remain `Export SVG` / `Export PNG 1x`, despite
visible text `SVG` / `PNG 1x`. Geometry/history/security/download/asset assertions
and timeouts are unchanged. No source suites or packaged runtime were run.

| Gate | UTC start to end, 2026-10-15 | Exit / totals | Retained result |
| --- | --- | --- | --- |
| RED: `node --test electron/test/shell.test.mjs` | 13:48:23.576Z to 13:48:32.039Z | 1; 8 pass / 3 expected new failures / 0 skipped | [RED](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/red-shell-result.json) |
| GREEN: identical command | 13:49:08.641Z to 13:49:09.454Z | 0; 11/11 pass / 0 skipped | [GREEN](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/green-shell-result.json) |
| `npm run test:desktop` | 13:49:15.134Z to 13:49:19.010Z | 0; 32/32 pass / 0 skipped | [Policy](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/desktop-policy-result.json) |
| `node --check scripts/verify-desktop.mjs` | 13:49:25.046Z to 13:49:25.160Z | 0 | [Syntax](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/syntax-result.json) |

Each result records the full log path/hash. Harness repair: one RED/GREEN cycle;
no test weakening or retry. [Before/after hashes and protection audit](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/final-protection-audit.json).

### Candidate And Build

Fresh isolated candidate CWD:

```text
C:\Projects\Diagrammer\app\test-results\platform\windows-arm64\20261015T134635385Z\candidate\app
```

[Candidate manifest](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/candidate-source-manifest.json)
records 2,444 app inputs plus examples. [Reuse proof](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/dist-reuse-proof.json)
matches all 2,373 source files against the passing source authority and checks
public/assets/HTML/config/package against the full passing build-input authority.
Only the two harness files differ. Reused all 36 exact files from the verified
snapshot dist; no rebuild of the identical renderer. Main `index-UsLzYCtS.js`
SHA256: `d9c8581961561330c45a16ac946ca3a31fa8036e3095f2aef6c87696d3beb033`.
[Actual dependency-copy manifest](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/candidate-dependency-manifest.json):
16,350 stable files / 248,707,897 bytes, plus separately recorded generated caches;
no install or dependency change. No original release/dist/profile was copied.

Preparation attempts 1 and 2 stopped on evidence-mapping mistakes, retained as
[first failure](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/prepare-failure.json)
and [second failure](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/prepare-v02-failure.json).
The source-only authority excludes public; the historical dependency authority
omits 37 pre-existing Bluebird `js/release` files. All recorded entries and all
copied extras were verified, not silently excluded. [Attempt 3 passed](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/prepare-v03-result.json).

Commands from candidate CWD, serial, with complete retained logs:

```text
node scripts/stage-desktop.mjs
node node_modules/electron-builder/out/cli/cli.js --config electron-builder.config.cjs --win --arm64 --publish never
```

Stage: 14:01:49.609Z to 14:01:50.006Z, exit 0;
[stage log](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/stage.log).
Builder: 14:02:11.084Z to 14:05:53.017Z, exit 0;
[package log](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/package.log),
[command/times/exit](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/package-result.json).
Versions: Electron 44.0.0, electron-builder 26.15.3. Existing pinned Electron/NSIS
caches predate this build; the builder logged Electron download progress but no
URL, so no no-network claim is made. [Cache observations](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/build-cache-observations.json).

### Artifact Identity

[Portable artifact](../../app/test-results/platform/windows-arm64/20261015T134635385Z/candidate/app/release/Azure-Diagram-Studio-0.2.0-win-arm64-portable.exe):
403,328,830 bytes; version 0.2.0; Authenticode `NotSigned`.
SHA256: `2ae7d752b5d8fd17766912521d3b74efe7393150d44a1ffd3a534a8f20a066df`.

PE distinction: portable NSIS launcher is **x86 `0x014c`**; embedded Electron
executable is **ARM64 `0xaa64`**, 225,493,504 bytes, SHA256
`4d2ce87932df1f5dbe2e7f663d14f982a53b34fe389d195f111ad01d521cfb40`,
also `NotSigned`. Do not describe the launcher PE itself as ARM64.
[PE, signature and ASAR validation](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/asar-validation.json).

ASAR: 19,729,754 bytes; SHA256
`3b6264853ee79ef0b7a47a4c6e3416eae889ba9523c31a7a15b8cf39cc72cc33`.
All 42 staged files compare byte-for-byte, including embedded 0.2.0 metadata,
36 compiled dist files, four unchanged shell modules and DOMPurify license.
[Stage manifest](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/stage-input-manifest.json).
Read-only archive extraction compares all 73 portable payload files / 402,594,956
bytes against unpacked output, including the same executable/ASAR.
[Payload proof](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/portable-payload-validation.json).
The cached extraction utility itself is x86, despite its ARM64 directory name;
the first failed identity assertion is [retained](../../app/test-results/platform/windows-arm64/20261015T134635385Z/owner/inspection-list-failure.json).
7-Zip's embedded-archive tail warning is retained; list/extract both exit 0.
No portable/Electron runtime was launched for these byte checks.

### Boundary And Next Action

Child environment excluded signing/Apple credentials and GitHub/tokens/secrets;
`CSC_IDENTITY_AUTO_DISCOVERY=false` was child-only. No signing credentials,
certificate access, publication/upload/GitHub API/CI/auth operation, dependency
upgrade, security/config edit, policy bypass, x64/Mac package, commit or support
promise. Builder signing log labels did not produce signed artifacts.
Original 36 dist files, 160 release files and all non-harness app inputs remain
unchanged; existing dirty Catalog/docs, user profiles and servers 5207/5218 were
not modified. The automatically backgrounded audit was retained under terminal
`1705f890-db94-4749-8dff-66cfc12147e5` and completed at 14:17:12.096Z, exit 0.

Independent verifier next: from the candidate CWD above, run exactly:

```text
node scripts/verify-desktop.mjs arm64
```

Its fixed desktop outputs/profiles are fresh within this isolated cell.
Runtime remains NOT RUN here; static/package GREEN is not native/platform PASS.
Manual gaps remain: physical offline cold launch/relaunch; downloaded-file
SmartScreen and normal managed-device policy; native Open/Import/save dialogs,
cancel/denial/completion, keyboard/IME and clipboard; real Teams/Office recipient
handoff and novice trial; physical 200% zoom/touch. Native x64/Mac and browser
cells, adopted support minima and signing/notarization policy remain separate.

## Owner Title Repair - DGM113-ARM64-001

2026-10-15. **Status: OWNER REPAIR GREEN / fresh independent native recheck
pending.** Role: scoped IMPLEMENTER, not independent verifier. Attempt 1,
local fix cycle 1. Earlier package/version/Blank/export harness repairs are
the baseline, not additional cycles for this defect. This section supersedes
the earlier runtime NOT RUN / original-candidate next-action text, not its logs.

The first independent native run remains **FAIL**, exit 1, from
15:38:41.104Z to 15:39:31.706Z: two completed check groups, one packaged ARM64
session, four owned processes cleaned up, zero downloads. The persisted title
was `Commerce platform`, not `Desktop offline arm64`; the screenshot retained
the draft title and New diagram tooltip.
[First runtime report](../../app/test-results/platform/windows-arm64/20261015T134635385Z/candidate/app/test-results/desktop/desktop-report.json).
The completed [post-run audit](../../app/test-results/platform/windows-arm64/20261015T142041719Z/verifier/post-run-audit.json)
reports protection **PASS** at 15:56:19.997Z, with profiles not accessed and
ports 5207/5218 unchanged. Read only for this repair; no repeat bulk audit.

Root cause: `editTitle` filled the field and pressed Tab, focusing New diagram.
The frozen DGM-109 `DraftField` blur guard intentionally defers commit when
focus enters that chooser. Enter invokes the existing single-line blur/commit
path. Only [runner](../../app/scripts/verify-desktop.mjs) changes Tab to Enter;
one source-contract regression is added in the
[existing shell tests](../../app/electron/test/shell.test.mjs). The exact durable
IndexedDB title assertion, generic durable reads, timeouts and all product code
remain unchanged. No speculative persistence wait or new abstraction is added.

| Gate | UTC start to end, 2026-10-15 | Exit / totals | Evidence |
| --- | --- | --- | --- |
| RED: `node --test electron/test/shell.test.mjs` | 16:39:30.6995701Z to 16:39:42.7885410Z, command-wrapper times | 1; 11 pass / 1 expected title-commit failure / 0 skipped | [RED](../../app/test-results/platform/windows-arm64/20261015T163904692Z/owner-title-repair/red-shell-result.json) |
| GREEN: identical command | 16:40:22.299Z to 16:40:22.945Z | 0; 12/12 pass / 0 skipped | [GREEN](../../app/test-results/platform/windows-arm64/20261015T163904692Z/owner-title-repair/green-shell-result.json) |
| `node --test electron/test/*.test.mjs`, same complete policy set as `test:desktop` | 16:40:42.954Z to 16:40:44.561Z | 0; 33/33 pass / 0 skipped | [Policy](../../app/test-results/platform/windows-arm64/20261015T163904692Z/owner-title-repair/desktop-policy-result.json) |
| `node --check scripts/verify-desktop.mjs` | 16:40:44.566Z to 16:40:44.661Z | 0 | [Syntax](../../app/test-results/platform/windows-arm64/20261015T163904692Z/owner-title-repair/syntax-result.json) |

The first RED log was saved before its result recorder failed on a
PowerShell-altered Unicode regex marker. Result recovery used that same log
and PowerShell history times without rerunning RED. A prior evidence setup
failure on this untracked report's missing HEAD entry is also retained in the
[baseline](../../app/test-results/platform/windows-arm64/20261015T163904692Z/owner-title-repair/baseline.json).
All command logs, times, totals and hashes are retained. Editor diagnostics and
the scoped diff whitespace check pass; both source files retain CRLF.

[Owner handoff](../../app/test-results/platform/windows-arm64/20261015T163904692Z/owner-title-repair/owner-handoff.json)
records input hashes, the unchanged seven selected first-run evidence files
and the [repair-only patch](../../app/test-results/platform/windows-arm64/20261015T163904692Z/owner-title-repair/owner-title-repair.patch).
Runner SHA256: `5df4a38ae649d862f1327c592805798a01bd25c7edc4681a11e8911914ef4043`.
No original failed-candidate runner, report or profile was resynced/overwritten.
No runtime, full source suite, renderer build, code generation or packaging ran
for this repair. Existing dirty Catalog/docs and original dist/release remain
outside the edit scope.

Exact next action belongs to the parent and independent verifier: create a
**new isolated recheck candidate**, copy the corrected runner and
`desktop-driver.mjs` plus required package metadata/catalog/source and the exact
verified dist, and reuse the unchanged artifact-backed 73-file payload through
a mechanical copy or fresh overlay. Use a fresh `candidate/app/test-results/desktop`
and isolated profile; never run against the first candidate's fixed output path.
Keep Git identity available and preserve ports 5207/5218. Artifact remains the
same 403,328,830-byte 0.2.0 portable, SHA256
`2ae7d752b5d8fd17766912521d3b74efe7393150d44a1ffd3a534a8f20a066df`;
no rebuild or artifact recopy was performed by this repair owner. Execute the
unchanged native gate once from that fresh candidate and retain first failure
alongside the new result. This handoff does **not** claim native PASS,
platform qualification, publication or completion of the separate manual gates.

## Independent Native Recheck - 2026-10-15

**Status: DONE for the approved bounded automated cell; native PASS and audit
PASS. Overall platform support qualification remains BLOCKED.** This independent
verifier made no source, test or existing-harness fixes. The original first
native FAIL (15:38:41.104Z to 15:39:31.706Z, exit 1, two groups/one session) and
its completed protection PASS remain preserved. `DGM113-ARM64-001`, attempt 1 /
repair cycle 1, is resolved by the scoped owner's Tab-to-Enter repair and this
single fresh recheck; maximum three repair cycles remains the global limit.
There are no new observed automated defects and no unchanged runtime retry.

### Fresh Inputs And Exact Command

Fresh application CWD:

```text
C:\Projects\Diagrammer\app\test-results\platform\windows-arm64\20261015T164359366Z\recheck\candidate\app
```

[Preflight](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/preflight.json)
passed before runtime invocation and proved the fixed desktop output absent.
119 immutable inputs were mechanically copied and hash checked: corrected
runner, unchanged driver, package metadata, two registry catalogs, four shell
modules, all 36 exact verified dist files, the existing portable and all 73
artifact-backed unpacked payload files. No renderer rebuild or packaging ran.
The runner was compared to the retained failed runner: the only difference is
the owner's explicit Enter commit. Durable-title, geometry, history, security,
asset assertions and all default timeouts are unchanged.

The fresh dependency directory is a junction to the first candidate's actual
pinned installation, used read-only for imports; it is not ACL-enforced.
19 resolved package trees / 312 files match the retained full dependency
authority and their before/after hashes. No install, Vite, build or dependency
cache command ran. The completed first bulk audit is reused, not repeated.
Git ancestry remains HEAD `a523a7e4feca5148d1a1a28fc34e97d28c82d1d6` plus the
previously recorded uncommitted Catalog repair and corrected harness, not HEAD
alone. The current 5,488 passing source authority and dated owner 12/12 shell
and 33/33 complete policy results are reused, not rerun.

Exactly once, synchronously with no imposed command timeout:

```text
node scripts/verify-desktop.mjs arm64
```

UTC wrapper start `2026-10-15T16:46:54.675Z`, end
`2026-10-15T16:48:42.599Z`, exit 0; internal report interval
16:46:55.215Z to 16:48:42.576Z. Totals: **10/10 check groups, 3/3 sessions,
8/8 downloads, 8/8 tracked processes exited**, zero cleanup errors. Complete
stdout/stderr were written as emitted; stderr is empty. No output-recovery
relaunch was needed.
[Run result and log hashes](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/run-result.json),
[full first-run log](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/first-run.log),
[session diagnostics](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/session-diagnostics.json),
[runtime report](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/desktop-report.json).
Report SHA256 `a15117fef03d6d1cdeaf991e4ba708d67f9684aeb7c850505aa89b9c1ffa157b`.

### Artifact And Native Context

The exact existing 0.2.0 portable is 403,328,830 bytes, SHA256
`2ae7d752b5d8fd17766912521d3b74efe7393150d44a1ffd3a534a8f20a066df`.
ASAR is 19,729,754 bytes, SHA256
`3b6264853ee79ef0b7a47a4c6e3416eae889ba9523c31a7a15b8cf39cc72cc33`.
The x86 `0x014c` NSIS bootstrap launched native ARM64 `0xaa64` Electron
44.0.0 in all three sessions. Each extracted runtime executable also matches
SHA256 `4d2ce87932df1f5dbe2e7f663d14f982a53b34fe389d195f111ad01d521cfb40`.
Host: Snapdragon X1E80100, processor architecture 12, Windows 11 Enterprise
10.0.26300, ARM64 Node v26.7.0. Authenticode remains `NotSigned`.

All three launches assert packaged app/version, `ads://studio/`, sandbox and
context isolation enabled, Node integration disabled, web security enabled,
no renderer `process`/`require`/`Buffer`, local IBM Plex Sans, secure storage
origin and offline request emulation. Renderer external requests, failed
requests, page errors and console errors are zero in all three sessions.
This is **CDP/network emulation, not physical disconnection**; renderer request
observations do not qualify host/OS networking or downloaded-file policy.

One newly owned profile, `profile-arm64-q41gAy`, stays under the fresh desktop
output. Session 1 uses the fresh release portable (launcher/main PIDs
13668/3452; four tracked processes). Session 2 uses the moved portable
(25424/31512; two tracked processes) and retains the document/dark preference.
Session 3 returns to the release portable (37728/25092; two tracked processes)
and retains the document/light preference. Every recorded process exited;
the independent post-run OS scan finds no owned application process.

### Bounded Case Results

| Automated case | Result and boundary |
| --- | --- |
| ASAR/package resources | PASS: allowlist, four shell modules and all 36 compiled files match; worker/font/branding/license resources present. |
| Native launch/isolation | PASS in all 3 sessions: packaged ARM64 runtime, secure origin, fresh profile and retained security assertions. |
| Durable edit/connect/layout | PASS: explicit title commit, connect, bundled ELK arrangement and exact Undo. |
| DownloadItems/exports | PASS: eight completed JSON/SVG/PNG outputs, save-dialog options and output bytes read from DownloadItem save paths. Not human native-dialog appearance/cancel/denial qualification. |
| New/Open | PASS: explicit Blank chooser and JSON through the real file-input path. Not an unautomated OS picker usability check. |
| Custom image/clipboard | PASS: SVG/PNG/JPEG/GIF/WebP inputs, 512px normalization, red GIF first frame, atomic unsafe rejection, Undo and in-app cross-document clipboard. Not arbitrary OS/Teams/Office paste. |
| Mixed catalog/export | PASS: 17 vendor + 14 Microsoft + custom artwork, 32 pixel-positive slots in each SVG/PNG; all 16 named catalog searches. |
| Theme/notices | PASS: unchanged durable document and byte-identical light/dark exports; local feature/license notices. |
| Move/relaunch | PASS: unchanged durable document plus dark preference after moving portable. |
| Third session | PASS: light preference and durable document survive another close/relaunch. |

### Visual And Download Evidence

All six retained screenshots were opened and inspected, including
[committed title](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-packaged-offline.png),
[dark catalog](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-catalog-dark.png),
[light integrated](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-integrated-light.png),
[moved dark relaunch](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-moved-relaunched-dark.png)
and [light relaunch](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-relaunched-light.png).
Diagram, glyphs, text and controls are nonblank; the document canvas stays white
while chrome follows dark/light. Relaunch captures retain viewport cropping,
not a whole-document framing claim. Both actual PNG exports were inspected,
including all 32 mixed items and final custom artwork. The original SVG and PNG
each rasterize to 1028x729 with 22,095 ink pixels; mixed exports have 32/32
nonblank artwork slots each, minimum ink 84. Dark export bytes are identical.

All eight downloads were independently rehashed after runtime cleanup:

| Output | Bytes | SHA256 |
| --- | --- | --- |
| [Backup JSON](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-backup.json) | 3,486 | `8f2cc96dc1c31adce89739e5892326f35e576589c7213df555d58d246850ca7a` |
| [Diagram SVG](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-export.svg) | 735,519 | `7d047f9975f44814f0c591256faed72c8a611d958b84e668fc3a0bcc9cfc090f` |
| [Diagram PNG](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-export.png) | 74,650 | `84b81892f9bed22fa9d70edd99cd31df34193cd99c81bcc2d8912fe080bf87c7` |
| [Mixed JSON](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-mixed-backup.json) | 15,757 | `9383eb2f0aea028375ea350adc382097b5daad385d8b013622a4ddd40aefa1e3` |
| [Mixed SVG](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-mixed.svg) | 848,838 | `9783fa63534ef0c780c0a05eb2335bc8cf36b935ee5f6116027548a18d816a81` |
| [Mixed PNG](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-mixed.png) | 159,762 | `66c1f07174d8432e3dd6b16082f2f7553b44abf83f3512debbf736b71f079337` |
| [Mixed dark SVG](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-mixed-dark.svg) | 848,838 | `9783fa63534ef0c780c0a05eb2335bc8cf36b935ee5f6116027548a18d816a81` |
| [Mixed dark PNG](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/candidate/app/test-results/desktop/arm64-mixed-dark.png) | 159,762 | `66c1f07174d8432e3dd6b16082f2f7553b44abf83f3512debbf736b71f079337` |

### Protection And Handoff

[Post-run audit](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/post-run-audit.json)
completed at 16:49:12.520Z, exit 0, protection PASS. All 119 fresh immutable
inputs, 2,506 original tracked inputs, scoped 312 dependency files, 36 original
dist files and 13 selected historical evidence files retain exact hashes.
Original 160 release files and first-candidate release metadata are unchanged;
their earlier bulk hashes remain covered by the retained completed first audit,
not a new bulk-content claim. No failed output/profile or actual user profile
was accessed for mutation. Ports 5207/5218 are unchanged. Fresh profiles and
outputs remain as evidence; no owned app process remains. No original source,
test, harness, roadmap, manual or spec was edited by this verifier.

**Manual/platform remainder: BLOCKED**, not overall QUALIFIED. Still required:
physical offline cold launch/relaunch; downloaded-file MOTW/SmartScreen and
normal managed-device policy; human Open/Import/save dialogs including cancel,
denial and completion; native keyboard/IME and cross-app OS clipboard; real
Teams/Office recipient handoff and novice trial; physical 200% zoom/touch;
separate native x64/Mac/browser cells and adopted support minima. Local unsigned
launch, automated DownloadItem handling and in-app clipboard do not close them.

Parent next action: reconcile the queue from this completed independent result
without another native retry. The approved bounded automated artifact/native
work is complete; retain named manual/release blockers for the corresponding
devices/participants/policy inputs. No signing, publication or support promise
is inferred. [Machine-readable handoff](../../app/test-results/platform/windows-arm64/20261015T164359366Z/recheck/verifier/independent-observations.json).