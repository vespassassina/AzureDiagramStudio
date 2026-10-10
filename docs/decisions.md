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

## 2026-10-10: macOS build on every push, ad-hoc unless Developer ID is supplied

Context: the macOS package built, but its signature was broken (Gatekeeper reports such apps as damaged, with no override), it used the default Electron icon, and the build ran only on manual dispatch. Packaging also hid a renderer crash: icons moved to PNG while `src/assets.ts` still accepted only SVG, so every desktop build opened an empty window.

Decision: sign ad-hoc by default, Developer ID with hardened runtime and notarization when repository secrets exist. Build and verify on every push, pull request and `v*` tag; attach the ZIP to the release on tags. The verifier launches the packaged app and waits for a rendered diagram. Accept PNG data URLs for bundled icons. [macOS build](macos-build.md).

Consequences: until a Developer ID certificate exists, users open the app once via Open Anyway. The two Windows-only unit test files (PowerShell, Edge) still fail on macOS and are not in the macOS gate.

Who: Diego requested; implemented by Claude.

