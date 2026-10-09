# DGM-070/080/090: Independent Release Verification

Date: 2026-10-09. Role: independent verifier. **Status: done for this verification; publication remains pending.**

This is internal evidence, not a public release announcement or acceptance waiver. It is not part of the selected public README/manual/images set. Contracts: [DGM-070](../specs/DGM-070.md), [DGM-080](../specs/DGM-080.md), [DGM-090](../specs/DGM-090.md). No source, executable, ASAR, existing report, dependency, Git state, or existing user profile was changed by this verifier. No build, staging, packaging, Git command, authentication access, upload, or subagent was used. The only authored workspace file is this report. Test-created temporary profiles and native downloads are separate from existing evidence and retained; cleanup terminated only owned, identity-checked test processes.

## Decision and Boundaries

- **PASS:** exact final binary/ASAR reconciliation, packaging privacy, PE architecture/branding, desktop units, independent ARM64 offline feature smoke, production-default no-listener probe, and canonical public example pictures.
- **Reviewed PASS, not independently rerun:** the current full desktop report exercises ARM64 natively and x64 through Windows emulation, each with 10 checks and 3 sessions. Its hashes, downloads and cleanup records were independently reconciled.
- **Not complete:** GitHub executable/checksum upload and read-back, final published source revision/branch verification, public release-document refresh, and manual acceptance. These remain with the release owner/PO. No critical executable/security/package defect was found in the scoped checks; one source-setup documentation defect is recorded below.
- x64 evidence is **emulation on ARM64**, not native Intel/AMD hardware certification. This verifier did not rerun x64 or the large full desktop suite.

## Exact Release Candidates

Only these two architecture-qualified portable files are approved by these checks:

| Target | Bytes | Modified UTC | SHA256 | Authenticode |
| --- | ---: | --- | --- | --- |
| [ARM64 portable](../../app/release/Azure-Diagram-Studio-0.1.0-win-arm64-portable.exe) | 403153753 | 2026-10-09T21:40:34.716Z | `efba77615bb19fbd1389112e01df4e35d590f367903887606ef1ce1c33b8bf6a` | NotSigned |
| [x64 portable](../../app/release/Azure-Diagram-Studio-0.1.0-win-x64-portable.exe) | 404006631 | 2026-10-09T21:40:47.861Z | `896c4863029c1cd6f6d10032289ce111d554fc63d47cf750c7aadca62edb1654` | NotSigned |

Independent SHA256, byte-count and modification-time recomputation matched both [the manifest](../../app/release/SHA256SUMS.json) and [the final desktop report](../../app/test-results/desktop/desktop-report.json). Both binaries were rehashed after runtime verification and remained unchanged. Authenticode was independently queried, not inferred from build configuration.

The final report started at `2026-10-09T21:43:42.603Z` and completed at `2026-10-09T21:46:25.974Z` (23:46:25 local, UTC+02:00), with overall `passed: true`. The manifest was generated at `2026-10-09T21:46:25.973Z`. This is the current evidence, not the older failure/cleanup attempts.

Size explanation: [the current builder configuration](../../app/electron-builder.config.cjs) specifies `compression: 'store'`, a portable target, and no publish/bootstrap/update service. The large approximately 403/404 MB files bundle the Electron/Chromium runtime and app. Actual launch/extraction and offline use were verified; these are not network bootstrappers. No compression experiment or rebuild was performed, and no hypothetical compressed size is claimed.

An older [architecture-unqualified portable](../../app/release/Azure-Diagram-Studio-0.1.0-win-portable.exe) also exists: 212027720 bytes, modified `2026-10-09T16:30:08.794Z`. It is absent from the final target manifest and is **not** a verified release candidate here. Do not confuse it with either final target; it was left untouched.

## Bundle, Source Correspondence and Privacy

Both architecture ASARs are identical: **19555700 bytes**, SHA256 `233945dc65cb6bee354ac237ec81b23ab56df3d865a37b93c39cd30c49590df2`. Independent enumeration found 49 entries / 42 files: compiled `dist`, exactly four Electron shell modules, and minimal package metadata. This matches [the staging allowlist](../../app/scripts/stage-desktop.mjs).

- All 36 current compiled dist files matched archive bytes, and all four current shell modules (`main`, `policy`, `protocol`, `security`) matched archive bytes for both architectures. Fresh ARM64 test and no-debug launches also matched their extracted ASAR to the same hash.
- All 29 files under the current public directory matched their packaged counterparts byte for byte. DOMPurify's additional staged license matched the installed pinned package license. Local vendor/Microsoft/DOMPurify notice fetches returned 200 in the packaged offline runtime.
- Bundled worker, IBM Plex font, original branding/favicon, React/React DOM/React Flow, ELK, Lucide, IBM Plex OFL, Azure/Entra/Microsoft application terms and vendor badge notices are retained. Electron's MIT license and Chromium license inventory are present beside the runtime, as checked by the full desktop report.
- No ASAR `src`, `node_modules`, tests, source maps, evidence, profiles, logs, environment files, Git files or memory files. A targeted text scan found no private Windows-user path, Copilot/test-profile path, private-key block or GitHub-token-shaped string. This is a scoped packaging/privacy check, not an exhaustive secret or legal-compliance audit.
- Archive package identity is `azure-diagram-studio`, version `0.1.0`, private package metadata, ESM entry `electron/main.mjs`; no npm dependency tree is shipped. Internal package `private: true` does not establish GitHub repository visibility.

The report attributes source commit `041f2c2794ffe3d093514279bb0d06edcb9d3518`. Its driver SHA256 `8553a2b7e0a24c8d3c978fef72d827d47730eb94bf88951f2b3d2ab27415e6b7` matches the current [driver](../../app/scripts/desktop-driver.mjs). Commit/remote/default-branch state was not inspected through Git. Dist/shell byte correspondence and packaged behavior are established; a fresh TypeScript-to-dist reproducible build is not claimed. The owner must bind publication to the finalized source revision.

## PE and Original Product Branding

Independent MZ/PE parsing and resource inspection:

| Target | Portable launcher machine | Inner Electron machine | Original ICO images matched |
| --- | --- | --- | --- |
| ARM64 | `0x014c` x86 NSIS stub | `0xaa64` ARM64 PE32+ | 16, 24, 32, 48, 64, 128, 256 px |
| x64 | `0x014c` x86 NSIS stub | `0x8664` x64 PE32+ | 16, 24, 32, 48, 64, 128, 256 px |

The x86 launcher stub is not evidence of a wrong inner architecture. Every size in [the original application ICO](../../app/public/branding/app-icon.ico) matched embedded PE icon-image bytes in **both** launchers and **both** unpacked runtimes; each had seven icon resources and one group resource. No Microsoft glyph is substituted for product branding. Native shell association/Explorer cache appearance was not manually certified.

## Security and Production Defaults

[Main](../../app/electron/main.mjs), [policy](../../app/electron/policy.mjs), [protocol](../../app/electron/protocol.mjs), and [window/session security](../../app/electron/security.mjs) were reviewed and byte-matched to the release bundles.

- Runtime: `app.isPackaged: true`, ARM64, Electron `44.0.0`, one `ads://studio/` window, window ID **1**; sandbox, context isolation and web security enabled. Renderer/worker Node integration disabled, no preload. Renderer `process`, `require` and `Buffer` were all `undefined`; secure context, IndexedDB, Web Locks and locally loaded IBM Plex were observed.
- The actual protocol response supplied CSP: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. Inline styles are explicit; no `unsafe-eval`, remote script origin or CSP bypass.
- Request allowlist is the exact studio origin, data URLs and studio-owned blobs. Permission/device requests, external navigation, popups and webviews are denied. Protocol handling restricts bundled paths/methods and rejects traversal, Windows aliases/streams, nested encodings and realpath escape. Export download MIME types are limited to JSON/SVG/PNG studio blobs. No renderer Node bridge, arbitrary filesystem API or test IPC handler was found in the four shell modules.
- The [driver](../../app/scripts/desktop-driver.mjs) deliberately supplies loopback `--inspect-brk` and `--remote-debugging-port` **only for tests**. It captures existing main-module imports through the inspector, checks ownership, propagates evaluation exceptions and performs identity-checked cleanup. This is test instrumentation outside source, not a production hook. Availability of opt-in Electron CLI inspection is not confused with an inspector enabled by default.

**Independent no-debug launch**, observed `2026-10-09T21:54:05.724Z`: final ARM64 portable, only `--user-data-dir=<fresh temporary verifier profile>`, isolated APPDATA/LOCALAPPDATA/TEMP/TMP, branded native window, launcher PID 38992 / main PID 48744. No inspector/debugging flag and **zero owned listening TCP endpoints**. Extracted ASAR matched the final hash. Owned cleanup passed; the real profile and other user/Node processes were untouched. This was a default-security launch with test-isolated storage, not a claim to have exercised the real user's profile.

## Independently Executed Checks

`npm --prefix app run test:desktop`: **27 tests, 27 passed, 0 failed, 0 skipped**, 548.2 ms total on native ARM64 host Node `v26.7.0`. These are policy/protocol/session/window/shell/packaging/driver units, not 27 native GUI sessions. The current total is 27, not the earlier supplied count of 26. Native packaged execution is evidenced separately below.

Fresh ARM64 portable smoke completed `2026-10-09T21:53:19.572Z`: **7 checks passed**, two actual portable sessions, isolated new OS-temporary profile, no dev server:

1. Actual final runtime/ASAR identity, one window, secure offline origin, sandbox/no Node/preload, font, IndexedDB/Web Locks and response CSP.
2. All four synthetic native examples opened through the packaged file chooser and exactly matched durable IndexedDB documents; component statuses remained Synthetic.
3. New diagram, 1024x512 custom SVG normalized to 512x256 embedded PNG, PNG replacement and exact undo, unsafe scripted SVG rejected without document mutation.
4. Offline bundled ELK worker Auto-arrange advanced the revision, retained custom artwork, and exact undo restored the prior document.
5. Native SVG/PNG DownloadItems, save-dialog options, embedded custom/font data, nonblank decoding; dark theme left the document and both export byte streams unchanged.
6. Oracle/AWS/Business Central/Copilot Studio/Teams searches loaded artwork offline; vendor/Microsoft/DOMPurify notices were readable.
7. Close/relaunch retained the exact custom document and dark theme; both sessions' owned cleanup passed.

First session: launcher 45248 / main 40000, test inspector/browser ports 57261/57262. Relaunch: launcher 11148 / main 28360, test ports 57320/57321. Renderer errors, failed requests and observed external HTTP(S)/WS requests: **none**. SVG and PNG each decoded to 260x239 with 2402 ink pixels. Light/dark SVG SHA256 `a20db695b843ffb2a0c2170a1940e0bdb9d39c451acef74e9726581f6d725def`; light/dark PNG SHA256 `4cd2a49c7a5bd301a0c5486496fd310d54cb49b2e0573ec001cbfb1bb2192a86`.

An additional screenshot was captured in memory only: 173552 bytes, SHA256 `c10b4651a12aa1c0bad6211f7077205944eb58985d314cd02245d5d556f9ce69`. It was not written over existing evidence or represented as a new persistent screenshot. Existing screenshot paths are listed below.

Offline means Electron-session network emulation before first navigation, driver request emulation before reload and explicit Chromium offline state after reload; `navigator.onLine` was false. This proves functioning under application/browser network unavailability, **not** a physically disconnected OS, packet-capture audit or OS firewall certification.

## Reviewed Full Handoff Evidence

[Current desktop report](../../app/test-results/desktop/desktop-report.json): ARM64 native and x64 emulated on ARM64, both passed, **10 checks / 3 sessions per target**. Each session has empty renderer-error/failed-request/console-error/external-request lists and successful cleanup records. All **16 recorded download files** were independently rehashed and matched their recorded byte counts and digests.

Its ten checks cover package allowlist/notices; actual portable/offline security; edit/connect/worker/undo; native JSON/SVG/PNG downloads; New/Open; five image formats including GIF first frame and unsafe rejection; 17 vendor + 14 Microsoft + custom artwork visible in both exports; light/dark document/export invariance; autosave after executable move/relaunch; and both theme preferences after relaunch. All 32 slots in each SVG/PNG have nonblank pixel measurements. JPEG/GIF/WebP, complete 32-slot checks, executable relocation and x64 are handoff evidence reviewed here, not newly rerun by this verifier.

Retained historical reports remain untouched: [attempt 1](../../app/test-results/desktop/desktop-report-attempt-1.json) and [attempt 2](../../app/test-results/desktop/desktop-report-attempt-2.json) failed; [pre-repack](../../app/test-results/desktop/desktop-report-pre-repack.json) failed; [pre-final](../../app/test-results/desktop/desktop-report-pre-final.json) passed a six-check x64 subset. None supersedes the 23:46:25 local final report or certifies a different binary by implication. Earlier size/cleanup failures remain history, not current failures.

Reviewed browser evidence, not new packaged stress measurements: [V1 report](../../app/test-results/v1/browser-report.json), modified `2026-10-09T21:17:54.007Z`, has **13/13 passing cases**, original stress-fixture digest `63abe1fe35e62379677892b30863cb2dc858ea8bbff9b9e5402f46edf14dd16f`, edit p95 **39.3 ms** and maximum of ten layouts **676.3 ms**. The unchanged 100 ms / 2 s gates pass. [Feature browser report](../../app/test-results/feature-icons/browser-report.json) has two passing cases and empty error/external-request arrays; [feature performance](../../app/test-results/feature-icons/performance.json) records p95 35.9 ms and max layout 690.5 ms. Prior failed latency samples are not current gates. Full source units, typecheck, build and broad browser suites were not rerun by this verifier; no new complete-source gate result is asserted.

## Public Examples, Notices and Documentation

All four native examples opened exactly in the independent packaged smoke. A separate offline ARM64 session completed `2026-10-09T21:55:49.479Z`: **all eight public SVG/PNG pictures exactly matched fresh downloads from the current compiled packaged renderer**, not a dev-source rendering or hand-maintained approximation. Cleanup passed.

| Example | SVG SHA256 | PNG SHA256 |
| --- | --- | --- |
| [Azure web/API](../../examples/azure-web-app.json) | `2b4a667c964a15b5b2be327b58f91a34ff42d5e4b32b39f4201d72a5606d04fc` | `3ff26831f34075325afbb62f480bb4a184079dc10e029efe5a7002425c2437c1` |
| [Fabric/OneLake](../../examples/fabric-onelake.json) | `7dc890a9846cb773d8ac501f7a4baad8a9477eb777509fa1cd722a672e52da0d` | `ecf25331fd1586a3355c51ee65b6607febec9fa9336f378b369de54ef688d5d8` |
| [Event-driven integration](../../examples/event-driven.json) | `1cda6ee898a649772d87f7e1f7fbaa21a9f3731f9a39abf174d55eb0766e381d` | `696c52c9ac4b3426338d8c5ba7a634d58053fa00105c70232e7d38854010add2` |
| [Microsoft/enterprise](../../examples/enterprise-integration.json) | `79dc56e2853cd41d6792259500b8ccc008f9273717155ebff3177bd77295f7d8` | `50a55d22dc36f624ed848bc5e8eedcbbee1638a9b1f7a73009a00f5e14e8f020` |

The [contact sheet](../images/examples-contact-sheet.png) was visually inspected: synthetic titles, boundaries, labelled solid/dashed flows, legends and artwork are visible; no obvious component/text crop or overlap at this review scale. Byte equality and visual review do not establish Office insertion fidelity.

Independent registry reconciliation confirmed **17 vendor named badges / 0 official vendor logos**, and **14 Microsoft entries: 5 official architecture icons / 9 original named badges**. All 31 local SVG files matched manifest SHA256 and decoded embedded-registry URI bytes. Required identities, HP versus HPE, Business Central versus Dynamics, and Microsoft 365 Copilot versus Copilot Studio are separately named. [Vendor](../../app/public/VENDOR-NOTICES.md) and [Microsoft application](../../app/public/MICROSOFT-APP-NOTICES.md) qualifications explicitly retain source gaps and permitted architecture/documentation/training restrictions; no unrestricted marketing/logo license, trademark clearance or legal opinion is asserted. Microsoft glyphs are not application branding.

[README](../../README.md) had 29 local references checked; [manual](../manual.md) had 12. All targets and referenced Markdown anchors exist. Both retain Release verification pending without invented `releases/download` links. The public documents passed the targeted private-machine-path/token-shaped-string scan, distinguish source availability from binary publication, explain separate desktop/browser storage and JSON backup, disclose badge/image semantics and unsigned SmartScreen risk, and do not instruct disabling protections.

Document snapshot SHA256: README `9de5c0d2febcd09cfbf044d66dba09562b07bee062cb9a4c3a0992553e49254d`; manual `c43dd593047193961bc3ee916489f166096dec6c4f6326ab10ccee7971314aa3`. These attest the reviewed bytes, not future owner edits. Source-repository availability/visibility is documented by the owner/user, not remotely reverified here.

**Documentation defect, owner repair required:** [README source setup](../../README.md#build-from-source) recommends `npm run preview`, but [package scripts](../../app/package.json) contain no `preview` entry. That documented command cannot run as written. No source/docs fix or acceptance waiver was made. Release-pending text is appropriate while upload/read-back is pending; statements that local packaged verification itself is pending should be refreshed by the documentation owner using this evidence when publishing.

## Screenshot Evidence and Remaining Gates

Reviewed persistent packaged evidence: [ARM64 integrated dark](../../app/test-results/desktop/arm64-integrated-dark.png) and [x64 integrated light](../../app/test-results/desktop/x64-integrated-light.png). The ARM64 dark capture is zoomed/cropped: it establishes dark chrome/artwork, not full-diagram fit or simultaneous visibility of every slot. The full slot-visibility evidence is in exported-picture pixel measurements. Other retained screenshots include [ARM64 offline window](../../app/test-results/desktop/arm64-packaged-offline.png), [ARM64 moved/relaunched dark](../../app/test-results/desktop/arm64-moved-relaunched-dark.png), and [x64 moved/relaunched dark](../../app/test-results/desktop/x64-moved-relaunched-dark.png). Public README images are browser screenshots, not substituted executable evidence.

Remaining gates, with no waiver:

- Release owner uploads only the two exact final architecture-qualified EXEs and matching SHA256 manifest; verify remote asset names, lengths and digests by read-back before advertising download URLs. Authentication/secrets were neither requested nor accessed by this verifier.
- Final source commit/branch/default-branch and remote publication review remains owner work. User-provided feature-branch/source handoff is not independent Git verification. No direct main commit or branch creation was performed.
- Owner repairs the missing-preview documentation command and refreshes README/manual release facts after verified publication. Keep this internal report, private operational evidence, profiles, logs and memories outside the selected public documentation/artifact set. Ignore patterns were read, not treated as proof of the remote Git tree.
- Both binaries are unsigned. Downloaded-file SmartScreen behavior and native save-dialog appearance remain **manually unverified**; automation validates dialog options and actual DownloadItems, not that UI experience. Do not disable SmartScreen/antivirus or imply a signature.
- Native x64 hardware validation remains unverified; current x64 runtime evidence is emulated on ARM64.
- PowerPoint insertion fidelity and uncoached novice usability remain **manually unverified**, distinct from artifact/security/offline checks. PO acceptance and sprint review remain required.

**Changes / docs updated:** this report only. **Open decisions:** owner publication/read-back and document refresh, manual acceptance and PO review. No runtime acceptance criteria or thresholds were weakened.