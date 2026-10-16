# 0.2.0 Windows ARM64 Publication Verification

2026-10-15. **Status: independent publication PASS.** This is a published,
unsigned, Windows ARM64-only prerelease, not general platform or manual
qualification. Role: independent POST-PUBLICATION VERIFIER. No production,
publisher, dependency, security, release-state or existing-document edits.

## Public Release

- [Published prerelease](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/arm64-v0.2.0),
  release ID `414118554`, name `Azure Diagram Studio 0.2.0 ARM64 candidate`.
- Published `2026-10-15T18:41:10Z`; updated at the same time. Fresh public API
  readback confirms `draft=false`, `prerelease=true`, exactly four uploaded assets.
- Verification start `2026-10-15T18:45:11.582Z`; completed, including local
  evidence-recorder recovery, `2026-10-15T18:46:49.215Z`.
- Tag `arm64-v0.2.0` resolves directly to remote base commit
  `a835c23d30eb4b8bf4c9995ab165b3d1013709ef`; the target matches the sealed plan.
- Full public body equals the sealed body byte-for-byte as UTF-8 text, SHA256
  `14f3dbce7092cd9b129635f2ee95e995dfd4dec7cc253776ff3707b80abb91fd`.
  ARM64-only, unsigned, source and qualification warnings are intact.
- Plan SHA256:
  `6b64cdc0ea2aa95fe2f8bb3da4a5740b5a1bb3f8f73b1656dd0964d4f9e8f238`.
  Its initial `draft=true` is the planned creation state, not current public state.

The [publisher completion journal](../../app/test-results/publication/windows-arm64/20261015T170000000Z/journal-20261015T1841149152559Z-21-completion.json)
explicitly records `published=true`, old-release protection and no observed
candidate Actions run. The console string `PASS Publish; release=draft` describes
the initial discovered draft and does not override the final public readback.

## Four Uploaded Assets

All names, IDs, sizes, SHA256 digests and public URLs agree with the sealed plan,
completion journal and fresh GitHub API response. GitHub's automatic source
archives are not among these four uploaded assets.

| Public Asset | Asset ID | Bytes | Full SHA256 |
| --- | --- | --- | --- |
| [Azure-Diagram-Studio-0.2.0-win-arm64-portable.exe](https://github.com/vespassassina/AzureDiagramStudio/releases/download/arm64-v0.2.0/Azure-Diagram-Studio-0.2.0-win-arm64-portable.exe) | 644803002 | 403328830 | `2ae7d752b5d8fd17766912521d3b74efe7393150d44a1ffd3a534a8f20a066df` |
| [Azure-Diagram-Studio-0.2.0-source-candidate.zip](https://github.com/vespassassina/AzureDiagramStudio/releases/download/arm64-v0.2.0/Azure-Diagram-Studio-0.2.0-source-candidate.zip) | 644806302 | 15685190 | `65b05f26926dc0292010784c3a7103d8038e45d8e3a11d954109ffa1fc0fe991` |
| [SOURCE-PROVENANCE.json](https://github.com/vespassassina/AzureDiagramStudio/releases/download/arm64-v0.2.0/SOURCE-PROVENANCE.json) | 644806488 | 510601 | `acee71c7b56fd70a668b16d936b7169a197403615471e0b5b856988f9cc845c9` |
| [SHA256SUMS.txt](https://github.com/vespassassina/AzureDiagramStudio/releases/download/arm64-v0.2.0/SHA256SUMS.txt) | 644806537 | 319 | `c8ada252a6cf672ea8785c93df58caf4aa45a5b03d7ee1e59785f418d9b444b7` |

## Public Download Scope

All four unauthenticated public HEAD requests returned GitHub HTTPS `302` to
`release-assets.githubusercontent.com` HTTPS `200`, with expected content lengths.
No Authorization header, cached credential, cookie jar or signed-URL query was
retained or forwarded. The HTTP observation window was
`2026-10-15T18:45:25.745Z` to `2026-10-15T18:45:31.111Z`.
Individual receipts retain exact per-request UTC times and sanitized redirects.

- GET Azure-Diagram-Studio-0.2.0-source-candidate.zip: PASS. Fresh complete
  15,685,190-byte download hashed to the sealed ZIP digest; not extracted or
  executed. Prior ZIP per-entry verification is reused, not freshly repeated.
- GET SOURCE-PROVENANCE.json: PASS. Fresh complete 510,601-byte download matched
  its SHA256 and the complete sealed JSON, including source inventory and limits.
- GET SHA256SUMS.txt: PASS. Fresh complete 319-byte download matched SHA256 and
  exactly three lines, in EXE/source ZIP/provenance order; no self-checksum line.
- No EXE download or runtime execution occurred in this verification. The
  403,328,830-byte EXE is bound by fresh local SHA256, GitHub server-side size and
  SHA256 readback, and public HEAD reachability. This does not establish fresh
  downloaded-binary execution, MOTW, SmartScreen or managed-device acceptance.

No public GET availability gap was observed. The tool-loading capability
`tool_search` was absent in this verifier; deferred GitHub MCP could not be
loaded. Fresh unauthenticated read-only GitHub API requests were used instead.
No authenticated public-download fallback or unchanged HTTP retry was needed.

## Source Provenance

**The attached source ZIP is authoritative.** The tag anchors remote base
`a835c23d30eb4b8bf4c9995ab165b3d1013709ef` ONLY. GitHub automatic source archives
do not include this working-tree candidate. Local base HEAD is
`a523a7e4feca5148d1a1a28fc34e97d28c82d1d6` plus retained uncommitted changes;
it is not a build from the tag commit. Local commits beyond the remote base were
not published as source commits. No source branch was pushed, and this verifier
made no commit, branch, tag, push or remote write.

The public provenance records 2,508 source files, 2,510 ZIP entries including
candidate README and inventory, and prior complete per-entry byte verification.
Pinned source inputs and lockfile do not imply bit-for-bit reproducible builds.
Post-publication documentation is not retroactively part of the sealed ZIP.

## Reused Qualification

No build, test suite, renderer rebuild, native check or downloaded code was run
for this report. The unchanged payload reuses the following dated evidence:

- [Sprint 4 source closeout](sprint-4-review.md): 2026-10-15
  `13:09:23.295Z` to `13:12:21.568Z`, 5,488/5,488 tests across 36/36 files,
  zero failed/skipped, exit 0. This is source-scope evidence, not 5,488 packaged
  native checks. Historical stress/performance scope remains historical.
- [ARM64 native report](DGM-113-windows-arm64.md): 2026-10-15
  `16:46:54.675Z` to `16:48:42.599Z`, 10 check groups, three sessions, eight
  downloads, exit 0; all eight tracked processes exited and protection passed.
  `DGM113-ARM64-001` is closed at attempt 1 / repair cycle 1; its first failure
  remains retained. Shell/policy evidence separately passed 33/33 at
  `16:40:42.954Z` to `16:40:44.561Z`.
- Exact verified renderer was reused without rebuilding the payload for later
  runner-only repairs. Electron 44.0.0 is ARM64; the NSIS portable bootstrap is
  x86. Authenticode is `NotSigned`, not signed or notarized. The host was Windows
  11 Enterprise `10.0.26300` / Snapdragon X; no native Intel/AMD or Mac claim.

## Protection And CI

The scoped [before audit](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/protection-before.json)
and [completed after audit](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/protection-after-recovery.json)
match the sealed baseline: 2,506 tracked file hashes, two existing extra report
hashes, 2,508 source-inventory hashes, 36 original dist hashes, four old release-key
hashes and all 160 original release path/size/mtime entries. Worktree changes and
HEAD are unchanged. All eight packet seals and retained proof hashes match.
The four local asset hashes were checked once; their size/mtime/ctime identities
are unchanged afterward. No 14 GB historical-log or old payload rehash occurred.

Fresh public API checks preserve v0.1.0 release ID `408382753`, body, publication
and update times, and all three asset IDs/names/sizes/digests/URLs against the
retained prepublication fingerprint. Body SHA256:
`6c60442f7b875115a6a78672e474367bd8e472d04fb04b21f5d17210d0c8ea2a`.
`releases/latest` still returns this non-prerelease v0.1.0, not the new candidate.

The remote macOS workflow at the anchored base has the expected Git blob
`248dd898b4ec5a5537b09f02376b513595ce7512`, content SHA256
`4b84a2df5350bf2dd7171670e06dbc28e3b57f139e44235f6b0d798934214efe`.
Its push-tag filter is `v*`; `arm64-v0.2.0` does not match. Fresh Actions readback
at `2026-10-15T18:45:27.414Z` shows the same ten runs as the publisher's
`18:41:14.9129358Z` after journal, all predating the publication window beginning
`18:39:05Z`. Zero new runs were observed. This is a bounded read-only window,
not a guarantee against future delayed CI; no workflow was triggered here.

## Retained History

The first partial-draft stop, envelope-mismatch repair 1 and authenticated
draft-discovery repair 2 remain preserved. The
[first actual blocked journal](../../app/test-results/publication/windows-arm64/20261015T170000000Z/journal-20261015T1807522603278Z-9-blocked.json)
is historical, not current public status. Repair 1's
[71 passing checks](../../app/test-results/publication/windows-arm64/20261015T170000000Z/publisher-repair-1/independent/tests-result.json)
were reused unchanged; repair 2's
[independent seal and handoff](../../app/test-results/publication/windows-arm64/20261015T170000000Z/publisher-repair-2/independent/handoff.json)
records 50/50 HTTP checks, including 32 discovery checks. Publisher repair counter
remains 2 of maximum 3, not reset; no third publisher cycle or publisher edit.
Both defects are resolved, with no outstanding publication error.

This verifier's first closing audit failed on a nested asset-identity lookup,
after all public checks succeeded. Its
[original result](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/verification-result.json)
is retained. One evidence-recorder-only correction completed the local audit and
rechecked saved responses, with zero repeated network requests. The
[reconciled result](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/verification-reconciled.json)
is the current independent PASS, not a new publisher or product repair.

## Remaining Cells

Publication does not close these blocked qualification cells. Named device,
policy and human owners must supply the inputs in [DGM-113](../specs/DGM-113.md):
physical offline cold launch/relaunch; downloaded-file MOTW/SmartScreen and
managed-device policy; human native dialogs/cancel/denial/IME/clipboard;
Teams/Office recipient fidelity and novice usability; physical 200% zoom/touch;
native Intel/AMD x64, macOS and separate browser/platform cells. Signing policy
and any support promises remain PO decisions. No bypass is recommended.

Parent-owned factual follow-up, not edited by this verifier: update the download
and version guidance in [README.md](../../README.md),
[app/README.md](../../app/README.md) and [manual](../manual.md) to distinguish this
ARM64-only prerelease from unchanged latest stable v0.1.0; reconcile the current
status/queue and next action in [roadmap](../roadmap.md#execution-queue) and the
publication disposition in [DGM-113](../specs/DGM-113.md). Preserve the source ZIP
warning, unsigned/manual limits, historical failures and platform blockers.
Do not overwrite old v0.1 release metadata or infer a new runnable source task.

## Evidence

New verifier evidence is under
`app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/`:
[read-only verifier](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/verify-publication.mjs),
[raw public release response](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/public-release.response),
[EXE HEAD](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/download-exe.json),
[source ZIP GET](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/download-source-zip.json),
[checksum GET](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/download-checksums.json),
[provenance GET](../../app/test-results/publication/windows-arm64/20261015T184335022Z/verifier/download-provenance.json)
and per-request metadata/response bytes. Redirect query strings are intentionally
omitted. All verification commands ran synchronously; no active verifier terminal
or owned application process remains.