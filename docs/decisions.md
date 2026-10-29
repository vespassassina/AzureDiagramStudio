# Decision Log

Append-only. A proposed decision is not implementation authority.

## 2026-10-09: Product direction for DGM-MVP

Context: the PO requested research, idea evaluation, a finished review-ready spec and a focused parallel-agent MVP plan based on the local architecture diagram skill.

Decision: PO selected a visual editor with explicit reversible Auto-arrange, generic software plus curated Azure components, structured connectors/boundaries/text/rectangles without freehand, and a local-first desktop SPA without login/backend. [Spec](specs/DGM-MVP.md).

Consequences: no automatic relayout on edits, no cloud-hosted data services, no whole-whiteboard feature set and no offline-loading commitment in this release. These selections inform the draft; detailed acceptance criteria still need approval.

Who: Product Owner via four scope choices; recorded by Orchestrator.

## 2026-10-09: Technical proposal awaiting PO review

Context: the skill is a Node/ELK/SVG renderer, not an interactive editor. Direct browser reuse of filesystem and headless Edge code is not viable.

Proposal, not decision: React/TypeScript/Vite + React Flow core + ELK worker + shared SVG scene, followed by a browser feasibility spike, frozen contracts, three parallel implementation slices, integration and independent verification. [RFD 001](rfd/001-editor-foundation.md); [plan](roadmap.md).

Consequences if approved: dependencies/assets require license/version review; the spike can reject the technical approach; implementation does not start until PO approval. Quantitative performance and usability gates remain proposed.

Who: Orchestrator recommendation; Product Owner decision pending.

## 2026-10-09: Baseline approved; visible feasibility spike authorized

Context: PO responded "approved, go" and requested something visible after the review package.

Decision: approve the product baseline and technical/dependency/asset envelope for [DGM-000](specs/DGM-000.md). Build a visible isolated browser spike, not the full production MVP. Actual asset terms and compatible versions remain verification obligations.

Consequences: DGM-000 may install approved packages and create an interactive demo. It must report nested grouping, boundary/cross-link geometry, reversible layout, escaped text, browser SVG/PNG output, licenses and an export-size limit. The production foundation and parallel implementers remain paused until PO closes the spike review.

Who: Product Owner authorization; Orchestrator records the bounded interpretation.

## 2026-10-09: Spike Complete, Technical Go Recommended

Context: visible DGM-000 spike, 15 focused tests, 12 browser checks, inspected screenshots and actual SVG/PNG downloads. [Evidence](verification/DGM-000.md).

Recommendation, not PO decision: retain React Flow/ELK/shared-SVG, using official workerFactory transport and edge-container coordinate translation discovered by the spike.

Consequences: code stays isolated; pause at Sprint 0 review. DGM-001 and parallel production slices still need PO authorization. No contract/scope expansion is implied.

Who: Orchestrator recommendation; Product Owner review pending.

## 2026-10-09: Spike Accepted; V1 Authorized

Context: PO reviewed the visible spike, expressed acceptance and requested continuing V1.

Decision: close Sprint 0 with a GO; execute DGM-001 through DGM-050 against the existing approved scope. Keep the spike untouched, adopt its proven visual/layout approach into a separate `app/` production workspace, freeze contracts before three parallel implementers, then integrate and independently verify.

Consequences: browser ownership/recovery, full structured editing, 24 Azure services and polished output are now implementation work. No backend, auth, AI, deployment, next-sprint work, branches or commits are authorized. Manual PowerPoint and novice-usability acceptance remain PO gates, not agent claims.

Who: Product Owner; Orchestrator records authorization and retains final review gate.

## 2026-10-09: V1 Candidate Implemented and Independently Verified

Context: foundation and three feature slices were implemented under disjoint ownership, integrated and independently verified. The verifier found two concrete issues; owners repaired them with red regressions and the verifier confirmed the fixes. [Evidence](verification/DGM-050.md).

Outcome: V1 is live on localhost 5174, with 257 unit/component tests and 13 integrated Edge checks passing. Production performance meets unchanged edit/layout gates. The original spike is preserved.

Decision: present the [Sprint 1 review](verification/sprint-1-review.md) to the PO. Technical automated gates are passed, but Office output and novice usability remain manual/unverified. No final acceptance, external distribution, deployment or next sprint is authorized.

Who: Orchestrator records verified implementation outcome; Independent Verifier supplies evidence; Product Owner owns acceptance.

## 2026-10-09: Full Published Azure/Fabric Catalog Authorized

Context: PO requested all Azure services/subservices, OneLake/Fabric components and collapsible menus after reviewing V1.

Decision: authorize [DGM-060](specs/DGM-060.md), replacing the curated 24-item limit with exhaustive coverage of the current official published collections and grouped browsing. Preserve original icon keys, document schema, accepted UI language and performance gates.

Consequences: catalog provenance and duplication mapping are verified; UI search exposes matching collapsed groups; Fabric gains its own catalog and component groups. No assertion of unpublished/future/SKU completeness, backend/AI/deployment or final V1 manual acceptance is implied.

Who: Product Owner scope request; Orchestrator records bounded implementation contract.

## 2026-10-09: Compact Top-Service Menus Replace Raw Archive Browsing

Context: PO requested icons/fewer groups, familiar first-four entries then alphabetical ordering, retired-product cleanup, top services only in menus, Fabric under Azure and long-tail access via search.

Decision: amend [DGM-060](specs/DGM-060.md#latest-po-refinement) with compact curated categories and lifecycle-aware canonical search. Keep raw official assets and existing saved keys intact; hide retired services from new creation rather than corrupting old diagrams. First-four ranking is a maintainable editorial default, not a claimed measured popularity statistic.

Consequences: the archive inventory remains exhaustive, but browsing no longer exposes all 2,223 glyph variants. Fabric is an Azure submenu. Official retirement research is recorded; future retirements are not prematurely removed. Revised non-overlapping mobile probe is authorized after the earlier verifier repair stop; all pixel/content assertions remain.

Who: Product Owner newest request; Orchestrator records the updated scope.

## 2026-10-09: Compact Catalog Refinement Completed

Context: the PO's updated menu request replaced raw archive browsing. Owners implemented presentation/lifecycle policy, icon-led menus and a scaled verified asset registry; independent verification found an edit-latency failure, repaired by measured UI/domain work without changing thresholds.

Outcome: seven Azure groups and 66 top choices, Fabric nested under Azure, four familiar pins then alphabetical tails, 665 canonical search/selection entries and 32 exclusions from new creation. All 2,235 raw keys and original 24 glyphs remain compatible. Retirement sources/limits are recorded; no universal current-service/SKU or statistical popularity claim is made.

Evidence: [DGM-060](verification/DGM-060.md) confirms 4,899 tests and 13 workflows passing; final independent edit p95 39.7ms and maximum layout 733.4ms meet unchanged gates. Production 5174 remains live and the spike is preserved. Office/novice checks and final PO acceptance are not implied.

Who: Orchestrator records verified completion of the PO-requested refinement; Independent Verifier supplies evidence.

## 2026-10-09: Azure Diagram Studio Desktop and Publication Authorized

Context: PO explicitly requested rename/icon/favicon, a self-contained Electron executable, examples/manual/README and creation/push of `vespassassina/AzureDiagramStudio`. User is unavailable and requested autonomous routine decisions.

Decision: execute [DGM-070](specs/DGM-070.md). Default the new repository to private, build Windows ARM64 and x64 portable artifacts, retain the original browser/spike and data, and upload binaries as release assets rather than committing them. Electron/electron-builder tooling and local feature-branch commits/push are authorized; no public disclosure, source-code license selection, signing certificate or CI/CD is inferred.

Consequences: original branding is distinct from Microsoft glyphs; desktop uses a secure bundled origin and persistent local profile, with JSON transfer from browser. Offline packaged execution and publication are verified before claiming completion. Missing GitHub authentication is a genuine blocker, never permission to expose credentials.

Who: Product Owner explicit scope; Orchestrator records conservative routine defaults and acceptance checks.

## 2026-10-09: Custom Images and Vendor Catalog Authorized

PO requested uploaded image icons and common third-party vendors while desktop publication remains in progress. PO delegated routine decisions when asked about SVG safety/rights. Authorize [DGM-080](specs/DGM-080.md): optional embedded PNG artwork per component, safe SVG normalization with pinned DOMPurify, still GIFs, and sourced vendor logos or original neutral named badges when rights are unclear. Preserve existing documents/security/caps and rebuild/verify desktop artifacts before release upload. This is not authority to claim unknown logo rights, relax desktop protection or publish an untested executable.

## 2026-10-09: Microsoft Apps, Themes and Existing Remote Authorized

PO requested SharePoint/Business Central/Dynamics/Microsoft 365/Copilot/Copilot Studio/Office/Teams icons and light/dark themes, and supplied the newly created `vespassassina/AzureDiagramStudio` Git remote. Authorize [DGM-090](specs/DGM-090.md): separately sourced Microsoft app registry, UI-only persisted theme, integration with custom/vendor artwork, and publication to the existing remote without overwriting history. Earlier desktop verification/release/doc requirements remain active. No final acceptance, force push, logo-redistribution assumptions or unsafe Electron bridge is implied.

## 2026-10-10: Sprint 2 Trust and Present Authorized

Context: the PO reviewed the evidence-based UX review and proposed DGM-100 backlog, then said "approved. execute the sprint".

Decision: execute DGM-101/102/103/104 only. Keep the local-first stack and existing dependencies. Freeze sibling stacking with atomic boundary subtrees, manual React Flow z-order and an explicit connection stratum shared with export. Preserve routes on stacking-only edits. Boundary layout uses deterministic intrinsic sizing, actual header wrapping and existing revision/annotation invariants. Workspace and Present state stay outside portable JSON.

Consequences: implementation delegates own scoped code and TDD; an independent verifier reports results without repairing code. Existing manual novice/Office checks remain open; actual Teams recipient testing needs a person and is not simulated as a pass. Sprints 3/4, platform expansion, packaging/publication, CI changes, dependencies, commits and branches are not authorized here. Stop at Sprint 2 review.

Who: Product Owner authorizes Sprint 2; Orchestrator records its bounded contracts.

## 2026-10-10: Connection Stratum and Group Stacking Clarified

Context: indivisible root subtrees can put connection lines over nested foreground tiles, conflicting with the legacy readable architecture appearance. The Orchestrator asked which rule should prevail; PO was unavailable and explicitly delegated autonomous judgment.

Decision: prioritize default foreground tiles over lines over containers. Maintain ordered sibling/subtree traversal within semantic render bands and parent-before-child visibility. Group ordering retains descendants' order within those bands; it does not move an entire heterogeneous subtree across the connection stratum. Legacy layer commands remain effective. Freeze this clarification in DGM-101 and verify identical editor/export policy.

Consequences: preserve existing diagram appearance rather than changing it on open. Four order actions affect applicable sibling stacking, not kinds/statuses. No version/dependency change. Whole-group cross-band stacking would require a future explicit product decision.

Who: PO delegates routine decision; Orchestrator chooses the recommended readable default.

## 2026-10-10: Sprint 2 Automated Candidate Ready for Review

Outcome: DGM-101 through DGM-104 are implemented and independently reverified. Owners repaired mobile target/reachability, long-header framing and drawer access defects; asset/native branding oracles were reconciled without relaxing integrity/fit assertions. The shell presentation callback closes pending file/layout mutation paths. A light diagram canvas in dark editor chrome preserves semantic-color annotation contrast without changing document/export colors.

Evidence: [Sprint 2 review](verification/sprint-2-review.md), 5,221 source tests, 20 generator checks, 16/16 production-browser scenarios, 132 worker layouts, build/typecheck and original production edit/layout gates pass (49.9ms p95, 483ms max layout). Desktop policy 27/27 is retained historical evidence, not a fresh GUI build.

Decision: present the review and stop. No PO acceptance, manual Teams/Office/novice/platform pass, new packaged release, commit, publication or next sprint is inferred. [Manual](manual.md) and [roadmap](roadmap.md) match the source candidate and state those limits.

Who: Independent Verifier supplies current evidence; Orchestrator prepares review; Product Owner owns closure.

## 2026-10-11: Custom Background and Grid Controls Added to the Plan

Context: PO requested custom background color (not only white), adding a grid and snapping to grid in the work plan. Existing editor dots and snapping are fixed and use different spacing.

Decision: add DGM-114/115 to the next proposed sprint in [DGM-100](specs/DGM-100.md). Plan a portable solid background with white fallback, color picker/hex input, shared editor/Present/export appearance and explicit transparent-output override. Plan independent grid visibility and snapping, dots/lines, common spacing/origin, free placement with snapping off, and optional grid inclusion in Present/exports. Preserve current document geometry when changing settings and verify nested coordinate behavior and contrast.

Consequences: white remains the default, not the only allowed choice. Theme does not overwrite diagram appearance. Exact optional schema/command/scene fields require a task contract freeze before code; no migration/dependency change is authorized. Reassess next-sprint capacity and coordinate output work. This request changes the plan only: no implementation, Sprint 2 acceptance, next-sprint start or release is inferred.

Who: Product Owner requests planning additions; Orchestrator records the proposed implementation contracts.

## 2026-10-11: Sprint 3 Authorized With Background and Grid

Context: after requesting background/grid additions, PO instructed "after this then implement next sprint". Amendment links were validated first.

Decision: execute six Sprint 3 tasks (114,115,106,107,105,108), retaining all requested features through sequential shared-file ownership. Freeze optional diagram background/grid fields with legacy fallbacks; no migration or new dependencies. Add a pure atomic add-and-connect command, scope-aware shared image exports, browser PNG clipboard with download fallback, curated local search and direct label/command editing. Use existing browser APIs without new Electron permissions/bridge or network destinations. Keep glyph bytes, saved colors, local data and Present guards intact.

Consequences: prior manual checks remain explicitly unverified; PO authorizes continued bounded implementation, not their certification. Preserve red/green logs for each task. Independently verify new controls/output/coordinates and retained performance. Stop at Sprint 3 review; no Sprint 4, CI, deployment, packaged release, commit or publication.

Who: Product Owner authorizes next sprint; Orchestrator freezes routine implementation contracts.

## 2026-10-11: Contextual Insertion Ancestor-Growth Clarification

Context: directional insertion above/left of a tightly fitted parent needs extra containment space. Existing expandAncestors already expands a boundary outward and compensates its children's local coordinates.

Decision: preserve that established behavior. Existing components/annotations and unrelated boundaries retain absolute positions; affected ancestor boundaries may change origin and dimensions solely to contain the new sibling. Exact undo restores all bounds/coordinates. DGM-107 is clarified accordingly; no implicit reparenting, clipping, global layout or movement of existing content is allowed.

Who: Orchestrator applies PO-delegated routine judgment, retaining existing geometry behavior.

## 2026-10-11: Sprint 3 Automated Candidate Ready for Review

Outcome: DGM-114/115/106/107/105/108 are implemented. Independent verification passes 5,431 source tests, typecheck/build, 20 generator checks and 51/51 fresh production-browser scenarios. The original 100-entity/150-edge fixture passes unchanged edit/layout gates (51.7ms p95 and 734.2ms maximum layout). Owners repaired test camera readiness and zoom-aware physical targeting; no acceptance assertion was weakened. Earlier failed and standby-interrupted candidates are retained in the [review](verification/sprint-3-review.md).

Decision: align the manual and roadmap with the source candidate, present the review and stop. PO closure and manual Teams/Office/novice/platform checks remain open. This is not a desktop rebuild, release publication, commit or authorization for Sprint 4.

Who: Independent Verifier supplies evidence; Orchestrator records the handoff; Product Owner owns acceptance.

## 2026-10-11: Bounded Sprint 4 Authorized

Context: after Sprint 3 automated verification and draft preparation, PO said "approved go" in response to the recommended next scope. Prior manual checks remain unavailable/unverified; continuation is not a fabricated manual acceptance result.

Decision: freeze DGM-111/109/110/112. Implement save-state copy only; explicitly defer unobservable native save cancellation and retain callback rejection checks. Accept the four-key synchronous boolean starter callback, fresh document identity, current Blank marker and dirty bundled-copy marker, non-mutating chooser cancel and existing replacement confirmation. Alignment uses five actions on same-parent selection roots, document-order anchor, equal edge gaps, exact fractional targets and atomic no-growth rejection through existing move commands. Approve a pure test-facing helper, not a new domain command. Platform work is local desk investigation only, with a candidate support matrix rather than qualification or commitments.

Consequences: shared implementation and terminal verification are sequential; investigation may research disjoint documentation in parallel. No dependencies, migrations, native adapter/security/CI changes, builds/releases, commits or platform expansion. Stop at Sprint 4 review with manual and native evidence gaps explicit.

Who: Product Owner authorizes scope; Orchestrator freezes contracts and dispatch boundaries.

## 2026-10-12: Original App Icon Refinement Requested

Context: PO asked for status and a nicer icon while Sprint 4's save-clarity slice
was independently verified and starters/alignment remained pending.

Decision: authorize [DGM-116](specs/DGM-116.md), a bounded original-brand refinement
using the existing teal/white/blue direction and generator. Preserve exact product
name, asset paths, official service glyphs and editor behavior. Retain three clear
connected nodes and simplify fine details for small-size legibility. Implementer
owns assets/tests; verifier checks generation and header fit without repairs.

Consequences: generated source/favicon/ICO assets change, not published binaries.
No dependency, packaging, release, signing, CI or commit. The approved Sprint 4
sequence resumes after this requested visual refinement; manual gates remain open.

Who: Product Owner requests icon improvement; Orchestrator freezes the asset scope.

## 2026-10-14: Autonomous Completion of Approved Local Work

Context: after explicitly asking to skip the review and continue, the PO reported
that agents were running in circles and requested a roadmap they could complete
without stopping for every minor decision or task. Historical approval stops,
stale statuses and lost execution output repeatedly displaced the real next step.

Decision: the [current roadmap](roadmap.md#current-execution-policy) is the live
execution policy for this repository. Execute its bounded queue continuously,
including automatic verifier-to-owner repair handoffs and orchestrator-authored
missing task paperwork. Reviews become asynchronous checkpoints, not repeated
permission prompts. Use available agents with separate responsibilities; retain
honest independence claims. Record this routing in repository instructions, not
by changing the PO's user-global preferences.

Consequences: reconcile DGM-110 and DGM-116 evidence, finish local Sprint 4
integration/docs, prepare the DGM-113 readiness contract, and deliver one
consolidated handoff. Missing hardware/manual evidence blocks its own cell, not
all local work. This does not accept an unverified feature or authorize fresh
packaging, support promises, dependencies, contracts/schema changes, security/CI,
cost, signing, publication or Git writes. These still need bounded approval.
Historical reports and decisions remain unchanged; no test pass is inferred
from this planning update.

Who: Product Owner delegates routine continuation; Orchestrator records the
repository-specific policy and bounded execution queue.

## 2026-10-10: macOS build on every push, ad-hoc unless Developer ID is supplied

Context: the macOS package built, but its signature was broken (Gatekeeper reports such apps as damaged, with no override), it used the default Electron icon, and the build ran only on manual dispatch. Packaging also hid a renderer crash: icons moved to PNG while `src/assets.ts` still accepted only SVG, so every desktop build opened an empty window.

Decision: sign ad-hoc by default, Developer ID with hardened runtime and notarization when repository secrets exist. Build and verify on every push, pull request and `v*` tag; attach the ZIP to the release on tags. The verifier launches the packaged app and waits for a rendered diagram. Accept PNG data URLs for bundled icons. [macOS build](macos-build.md).

Consequences: until a Developer ID certificate exists, users open the app once via Open Anyway. The two Windows-only unit test files (PowerShell, Edge) still fail on macOS and are not in the macOS gate.

Who: Diego requested; implemented by Claude.

## 2026-10-19: Replace Formal Participant Trials With Optional Colleague Feedback

Context: the post-release plan proposed recruiting participants for observed
Windows/Teams/Office use and an uncoached timed novice scenario. The PO directed:
"remove the participants trial. i will share this with my colleagues and see
where it goes".

Decision: remove formal participant recruitment, observed Teams/Office trials,
timed novice testing and PO scoring from the active continuation. The PO will
share the existing release independently; colleague feedback is optional and
does not gate release completion or other approved work.

Consequences: update the [queue](roadmap.md#post-release-acceptance-continuation---2026-10-19)
and [DGM-113 continuation](specs/DGM-113.md#acceptance-continuation---2026-10-19).
Preserve historical manual criteria/results as unverified, not passed; this is
a scope decision, not new test evidence. Native Intel/AMD and other technical
qualification/policy gaps remain separate. No messages, file sharing, rebuild,
release mutation or support expansion is authorized.

Who: Product Owner changes acceptance scope; Orchestrator records the decision.

## 2026-10-27: Always-On App-Local MCP With Settings Connection Details

Context: the PO requested a local MCP server and clarified: "local mcp server for
the app. that is always on by default. a button in settings to get the address."
This supersedes the earlier implementation assumption of opt-in startup.
The earlier client names did not identify a specific Scout product or authorize
editing global client settings without an understood connection mechanism.

Decision: [DGM-131](specs/DGM-131.md) implements a main-process, loopback-only MCP
Streamable HTTP endpoint automatically for the desktop instance's lifetime, not
an installed background service. Settings exposes status, actual address and
explicit address/token clipboard actions. Initial tools read the committed
document, catalog, templates and app information; document editing is not
advertised. Existing Electron sandbox, CSP and network denial remain in place.

Consequences: use narrow trusted IPC rather than opening renderer network access.
A random per-launch bearer token protects local data without adding persistent
credential storage; clients must update the token after a restart. An occupied
preferred port uses an actual displayed loopback fallback. No new dependency,
client config write, OS service, write tool, release mutation or broad filesystem
access is introduced. Existing 0.3.0 downloads remain unchanged. Actual protocol/
desktop verification is required; connection instructions do not establish tested
Claude/Scout/Copilot interoperability.

Who: Product Owner sets automatic-start and Settings requirements; Orchestrator
records the bounded read-only design and technical acceptance contract.

## 2026-10-27: MCP Creation And Editing Required

Context: following the initial read-only scaffold, the PO clarified "the mcp
should be able to create, edit, modify diagrams like a user would".

Decision: supersede DGM-131's initial read-only scope with creation, canonical
document-command editing, real Auto-arrange and Undo/Redo through the existing
live session. Keep authenticated loopback transport, narrow IPC and existing
renderer security. Update [the spec](specs/DGM-131.md) and acceptance, not merely
advertising unfinished editing as a later possibility.

Consequences: atomic batches validate fully before one history commit and normal
autosave. Mutations require an opaque current-state token changing even across
Undo/Redo/reload and fail on stale state, read-only/loading/busy/drafts/Present.
New diagram replacement retains normal confirmation/history semantics; no
silent discard or second main-process document store. Correlated bounded requests
must not execute after expiry. This does not authorize shell/arbitrary file
access, client registration, new dependencies or a release.

Who: Product Owner explicitly expands editing scope; Orchestrator freezes the
in-app mutation, concurrency and interaction acceptance contract.

## 2026-10-28: Canonical UI Placement And Explicit State

Context: the PO refined the desktop UI through DGM-134 through DGM-139, removing
duplicate controls and library sections, separating application controls from
diagram tools, grouping layout variants, requiring explicit panel open/close
and persisted preferences. After the verified source preview opened, the PO
approved the inferred rule with "save as repo design and as a global rule for
agents.md".

Decision: adopt [the UI design convention](ui-design.md), linked from repository
AGENTS.md. Generalize the principle in the existing user-global agent
instructions: one clear home per function, controls near their scope, space for
the work, related choices grouped, predictable explicit state and honest
persistence. Global guidance does not mandate Diagram Studio's exact placements.

Consequences: future UI tasks consult the convention and preserve accessibility,
responsive behavior, drafts/history and safety. This is not permission for
unrelated redesign or data migration. Existing global instructions remain
otherwise unchanged; no release, tag, version or commit is implied.

Who: Product Owner explicitly authorizes repository and global guidance;
Orchestrator records the approved rule and bounded application.

## 2026-10-28: Conventional Menus And Strict Group Stacking

Context: in the source preview the PO rejected staggered groups, requested
File/View/Settings menus with a focused top action bar and bottom-only save
status, then requested clearer lines, a paper-like workspace and updated Help.

Decision: [DGM-137](specs/DGM-137.md) grouped layouts require true shared-axis
stacking and consistent nested contents, not merely directional order.
[DGM-140](specs/DGM-140.md) places file operations under File, view/preferences
under View, and Settings/Help/About under Settings; only Undo/Redo/Export/Present
remain top action buttons. The PO explicitly retained canvas Auto-arrange and
Sidebar. [DGM-141](specs/DGM-141.md) uses shared 2.1px connection strokes and a
light-only #faf8f3 unspecified workspace surface, preserving explicit diagram
and export backgrounds. Help now describes the actual eleven-step workflow.

Consequences: earlier direct-top-button placements are superseded, not the
general canonical-home rule. Independent affected source acceptance and a new
fresh-profile preview follow; old user work and immutable release artifacts
remain untouched. No version, package, tag, publication or commit is implied.

Who: Product Owner explicitly directs the refinements and confirms canvas
control placement/background scope; Orchestrator records verified delivery.

## 2026-10-28: Separate Fixed-Geometry Connection Routing

Context: DGM-142 reproduces excessive route detours and header crossings in the
exact Fabric starter. Three bounded ELK constraint candidates failed while
strict placement stayed correct; no candidate was promoted.

Decision: the PO explicitly approves keeping real ELK node/group placement and
adding a dedicated obstacle-aware orthogonal routing stage without dependencies.
[RFD 002](rfd/002-fixed-geometry-routing.md) and
[DGM-142](specs/DGM-142.md) freeze the scope and acceptance.

Consequences: placement geometry, hierarchy, explicit ports, arrows/labels,
strict stack axes/gaps, worker/history guards and pre-GREEN quality bounds
remain mandatory. Own bounded deterministic route/clearance tests and real
visual/output acceptance. No data migration, version, package, release,
client-configuration or security-policy change is authorized.

Who: Product Owner chooses the routing architecture; Orchestrator records the
approved trade-off and delegates implementation/independent verification.

## 2026-10-28: Single Native Job Worker For Layout Ownership

Context: DGM-142 cycle1 corrected dense channels and observer scheduling but
native completed-worker targets persisted even without debugger attachment.
Nested parent/ELK teardown was not reliably clean; target execution liveness
versus Chromium bookkeeping remained unclassified.

Decision: within the approved cancellable-worker boundary, execute the existing
pinned bundled ELK and canonical routing inside one disposable native worker.
Retain the original zero-worker oracle and all geometry/route/history guards.
The construction-only version-specific environment adapter is restricted to
that isolated job, with exact descriptor/dispatcher restoration and explicit
failure tests; no dependency, CSP or public contract change.

Consequences: independent cycle2/3 accepts native completion/error/cancel/
deadline cleanup and exact296-route/entity parity. Revalidate the adapter and
native teardown before any future engine/runtime upgrade. Do not claim the
old native objects were benign or that automated acceptance qualifies a
release or external clients. Cycle3 unused.

Who: Orchestrator scopes the internal lifecycle repair under the PO-approved
continuation; separate implementer repairs and independent verifier accepts.

## 2026-10-28: Compact Group Envelopes Before Routing

Context: the PO's new Fabric screenshot shows excessive empty group interiors.
DGM-142 deliberately retained group dimensions, so route acceptance preserved
the old envelope inflation. Source includes provisional ELK routes in module
bounds even though final canonical routing discards those paths.

Decision: the PO explicitly selects compacting groups and rerouting.
[DGM-143](specs/DGM-143.md) permits content/header-fit group sizing, corrected
local child offsets and compact root gaps before the routing stage. It
supersedes the former geometry freeze for this explicit Auto-arrange action,
not strict alignment, semantic/port/history preservation or final routing's
immutable-input-geometry invariant.

Consequences: add pre-GREEN child-hull margin and intergroup-gap bounds, not
just route validity and old/new exact geometry. Preserve earlier evidence as
bounded history. Independent actual output and visual acceptance remain
mandatory; no release/dependency/schema/security change.

Who: Product Owner approves the contract change; Orchestrator specifies it;
separate implementation and verification retain their responsibilities.

## 2026-10-28: Show Compact Layout Without Waiving PNG Qualification

Context: DGM-143 compact Fabric sizing independently passes. The first fresh
aggregate encounters a4000ms MCP PNG export timeout after six complete UI/HTTP
cells. Bounded diagnostics do not reproduce or explain it, so there is no
justified product repair or complete output acceptance.

Decision: the PO selects "Open the layout preview; keep PNG qualification
blocked (Recommended)". Show the exact tested ordinary-source app in a fresh
manual profile, explicitly for layout inspection. Do not claim independent
full PASS, erase the original failure, raise deadlines or rerun unchanged
qualification for a favorable sample.

Consequences: preview sequencing is decoupled from full output qualification
for this PO inspection.143-IV-01 and missing cells remain blocked; speculative
repair, release/publication and changes to technical gates are not authorized.
Preserve earlier user windows and unsaved work.

Who: Product Owner chooses partial preview; Orchestrator records and opens
the provenance-checked candidate without changing code or acceptance results.

## 2026-10-29: Publish Windows 0.5.0 And Install For Current User

Context: current approved source changes include menus/Help, workspace root,
Favorites, MCP visual/Markdown exports, compact group sizing and routing.
Version0.4.0 remains an immutable source tag with unpublished blocked candidate;
published Windows downloads are still0.3.0.

Decision: the PO explicitly requests compiling/publishing0.5.0, then installing
it on this PC and reporting its location. [DGM-144](specs/DGM-144.md) authorizes
new version metadata, committed/pushed source, both existing Windows portable
targets, exact-artifact independent qualification and new stable/latest public
release. Retain the no-PR delivery policy and all old tags/releases.

Consequences: fresh0.5.0 packages need their own passing runtime and complete
public-download evidence. The unresolved historical MCP PNG deadline issue
remains disclosed, not fixed by relabeling or deadline changes. Install the
verified public ARM64 portable per user with a versioned Start menu shortcut;
record actual paths and byte identity. No administrator access, new installer,
dependency/security/CI change, signing or Mac publication is inferred.

Who: Product Owner authorizes publication and local installation; Orchestrator
owns source/sealing/publication/install, scoped owner builds, separate verifier
qualifies packages and anonymous public downloads.
