# DGM-MVP: Diagrammer

Date: 2026-10-09. Status: V1 IMPLEMENTED; AUTOMATED GATES PASSED; PO/MANUAL ACCEPTANCE PENDING.
Owner: Product Owner. Authoring tier: Orchestrator.

## Outcome

A local-first SPA for architects and developers to create clear, presentation-quality software and Azure architecture diagrams quickly, without a Visio-sized learning curve.

Core workflow: insert components, connect them, place them inside boundaries, annotate, optionally Auto-arrange, and export. The editor is the first screen, not a landing page. The existing `azure-arch-diagrams` skill is the visual/layout foundation, not a complete interaction engine.

## PO selections

Confirmed through discussion on 2026-10-09:

- Visual editing with explicit Auto-arrange; ordinary edits preserve manual placement.
- Generic software types plus a curated Azure icon set.
- Connectors, boundaries, text and rectangles; no freehand pen.
- Local-first, desktop-focused SPA; no accounts or backend. Offline app loading/install is deferred.

The PO approved this baseline and dependency/asset envelope, accepted the visible DGM-000 spike, and authorized V1 on 2026-10-09. Sprint 1 covers DGM-001 through DGM-050. Exact versions, contracts and assets are frozen by foundation before parallel dispatch; final sprint acceptance still requires PO review.

## Essential scope

| Area | MVP behavior |
| --- | --- |
| Canvas | Pan, zoom, fit, single/marquee selection, drag, 8-unit grid snapping, duplicate, copy/paste, keyboard nudge and delete. No rotation or arbitrary transform tools. |
| Tools sidebar | Select, pan, component, connector, boundary, text, rectangle. Searchable component palette; click-to-place is an alternative to drag. Selected objects expose duplicate and delete actions. |
| Components | 12 generic types: user, people, API, service, function, server, database, lake, queue, storage, model and shield. Curate 24 Azure services across compute, network, data, integration and identity; freeze the licensed asset manifest before parallel work. |
| Connectors | Attached component/boundary endpoints, orthogonal paths with rounded corners, plain-text label, forward/bidirectional/no arrow, solid/dashed. Create by dragging handles or selecting source then target. Reconnect endpoints. No connection to text/rectangles, self-loop or manual waypoint editing in v1. |
| Fast insertion | Insert a component on a selected connector; split the connector in one undoable transaction. Retain its label on the upstream edge, leave the downstream label empty, preserve style/direction on both. |
| Boundaries | Labelled ownership/trust containers, two levels of nesting, group movement and resizing. Explicit membership changes through a parent field or group/ungroup command; dropping over a boundary does not silently reparent. |
| Annotations | Plain text and resizable rectangles, foreground/background ordering, semantic swatches. No rich text, image upload, freehand or arbitrary SVG input. |
| Inspector | Contextual label, subtitle, component type, parent, status, semantic color and connector properties. No permanent typography panel. |
| Quality | One crisp light diagram theme, consistent type/spacing, optional title/subtitle and automatic legend for used status/color categories. Status starts unset; never assume an element is live. |
| Layout | Whole-diagram Auto-arrange RIGHT/DOWN using ELK. Explicit command only, one undo step; preserve labels, identities and memberships. No pinning, partial layout or continuous layout. |
| Ownership | One active document, browser autosave, New, JSON Open/Save, import of the skill's documented JSON schema. Browser storage is not a backup. |
| Output | Self-contained SVG and PNG at 1x/2x, white/transparent background, fit-to-content crop with padding. The editor and exports use shared visual definitions and geometry. |

The Azure manifest is a release gate, not permission to silently substitute generic glyphs for branded services. Any unavailable or unlicensed asset requires PO review.

## Interface and visual direction

- Quiet, compact work surface: white canvas with subtle dot grid, charcoal text, restrained teal commands and distinct semantic accents. Avoid a marketing layout or large decorative panels.
- Slim icon tool rail plus collapsible searchable library on the left; unframed canvas takes most of the viewport. Contextual properties occupy a right panel only when useful.
- Compact top bar: document title/save state, icon undo/redo, Auto-arrange direction menu, file and export actions. Bottom canvas controls: zoom and fit.
- Familiar Lucide icons, action-name tooltips, labelled accessibility controls, visible focus, swatches for color and a segmented direction selector. No instructional paragraphs inside the app.
- Components are SVG architecture tiles with at most 8px corner radius; boundaries are plain containers, not decorative cards. Official service icons retain their original colors/shapes.
- Use a bundled, licensed readable font rather than remote font requests. Candidate: IBM Plex Sans; exact font and license require dependency/asset approval.
- Desktop target: 1280x720 and 1440x900. At 390x844, panels become drawers; click-to-place, select, property edit, delete and export remain reachable. Full mobile productivity is not a release promise.
- No application shell or fonts/icons depend on a CDN at runtime. This does not promise that an unloaded app can open without a network.

## Interaction invariants

1. Add/edit/delete/connect never invokes ELK or moves unrelated objects.
2. A drag/resize/typing session commits as one history transaction. Undo/redo applies document changes, not camera or selection changes. Keep at least 100 transactions per session; history need not survive reload.
3. New/Open/Import prompt before replacing a document changed since its last JSON save. Browser autosave does not clear that backup reminder. Failed validation leaves the current document untouched.
4. Deleting components deletes incident connectors in the same transaction. Removing a boundary promotes its children to its parent and preserves absolute positions; it does not delete its contents. Multi-selection deletion handles explicitly selected children normally.
5. Group movement moves every descendant once. Resizing cannot clip contained objects. Reparenting preserves absolute positions and forbids cycles or a third boundary level.
6. Duplication/copy/paste creates fresh IDs and retains internal connections/membership when both endpoints/parents are included; external connections are omitted. Pasted objects receive a consistent offset. Internal clipboard is sufficient; cross-app clipboard is deferred.
7. Auto-arrange works on a snapshot/revision. Failure, cancellation or edits made while computing cannot overwrite newer work. Apply only a matching-revision result. Layout failure preserves geometry and offers retry; the UI remains usable.
8. Auto-arrange includes components and boundaries. Text/rectangles remain where the user put them and are not obstacles; fixtures must cover this. The inspector does not imply automatic annotation positioning.
9. Manual moves invalidate obsolete route geometry. Fallback orthogonal paths stay attached but do not promise obstacle avoidance. Auto-arrange optimizes routes; no algorithm guarantees zero crossings for arbitrary graphs.
10. No autosave success indicator until storage succeeds. On failure keep editing available, report the failed save and leave JSON download available. Only the latest durable snapshot is recoverable after a crash; debounce target is 500ms after a completed command.

## Document contract

Proposed `schemaVersion: 1`; framework-independent JSON, not a serialized React Flow instance.

| Entity | Required contract |
| --- | --- |
| Document | Version, stable document ID, title/subtitle, RIGHT/DOWN direction, entities, connections and legend visibility. |
| Entity | Globally unique ID; kind component/boundary/text/rectangle; parent boundary ID or null; parent-relative position and positive size; plain text; allowlisted style token. |
| Component | Allowlisted generic/Azure type and icon key, label/subtitle, optional live/planned/not-connected/synthetic status; omitted status means unset. |
| Connection | Stable ID, valid component/boundary endpoints, source/target side auto/top/right/bottom/left, label, line style and arrow mode. |
| Layout geometry | Optional route points and label position in document-absolute coordinates, tied to the geometry revision. Invalidate on graph/geometry changes; never reuse stale points. |
| Session state | Selection, active tool, camera, in-progress gestures and history; kept outside portable JSON. |

Validation checks versions, IDs, parent references/cycles/depth, endpoints, finite coordinates/sizes, allowed tokens and text lengths. Proposed limits: 5 MiB JSON, 100 total entities, 150 connections, 120-character labels, 200-character subtitles, 80-character connector labels and 2,000-character text notes. Errors identify the failing field. Reject unsupported versions rather than inventing migrations.

Imported skill JSON is normalized into this model: groups become boundaries, nested membership is retained, icon/status/color/direction/title/legend meaning is preserved where supported, and ELK computes its initial geometry. Explicit `live` is retained; missing status remains unset. Allowed skill colors include documented tokens and valid hex values. Unknown icons fall back to a generic glyph with a visible import warning; unknown statuses/unsupported structures fail with a clear error. No legacy export or arbitrary file-path icons.

Pure boundaries to freeze in DGM-001:

- `validateDocument(input) -> document or field errors` and `importSkillSpec(input) -> document plus warnings or errors`.
- `applyCommand(document, command) -> newDocument or error`; an atomic command is the unit of history.
- `computeLayout(document, direction, revision) -> positions, sizes and routes or error`; no store mutation.
- `buildScene(document) -> SVG-compatible primitives, text, paths and bounds`; one source for editor/export visuals.
- `exportSvg(scene, options) -> self-contained SVG`; `exportPng(scene, options) -> Blob or actionable error`.
- Persistence adapter `load()` / `save(snapshot)` with explicit error results. Shell adapts promises and commands; domain modules know nothing about React Flow.

## Architecture proposal

React + TypeScript + Vite; React Flow core for selection, viewport, handles and parent-relative positioning; ELK in a browser worker for deliberate arrangement. No server, auth, cloud SDK or application API.

Adapt the skill's pure graph/rendering concepts into a small internal scene/layout module; preserve the external skill. SVG must use native vector shapes/text and embedded allowlisted icon assets, not `foreignObject` screenshots. Rasterize that same SVG through browser canvas for PNG, with font readiness and export-size checks.

Use reducer/history commands and browser IndexedDB without a new state-management or storage dependency unless a spike demonstrates need. Tests: Vitest for deterministic domain/geometry tests, Testing Library for relevant interactions and Playwright for end-to-end/export checks. Exact compatible versions are chosen and locked only after approval. Proposed dependencies and notices are discussed in [RFD 001](../rfd/001-editor-foundation.md).

## Acceptance criteria

All thresholds are approved targets, not measurements already achieved.

| ID | Given / When / Then |
| --- | --- |
| AC-01 | Given a blank document, when a user inserts generic and Azure components by palette drag or click-to-place, then each appears at the chosen canvas location with stable dimensions and editable plain text; palette search matches service names. |
| AC-02 | Given two components and a boundary, when connectors are created/reconnected and endpoints or their parent move, then paths remain attached and labels/style/direction persist. Invalid endpoints/self-loops are rejected. |
| AC-03 | Given a labelled connection, when a component is inserted onto it, then exactly two valid connections replace it with the defined label/style rule; one undo restores the original graph. |
| AC-04 | Given components in nested boundaries, when grouped, moved, resized, reparented or ungrouped, then absolute geometry/membership follows the invariants; cycles/depth violations fail without partial mutation. |
| AC-05 | Given selected components, text and rectangles, when edited, nudged, duplicated, copied/pasted or deleted, then the expected graph/geometry is retained and a single undo restores each transaction. Camera/selection do not enter history. |
| AC-06 | Given an established layout, when ordinary edits occur, then unrelated positions remain identical; when RIGHT/DOWN Auto-arrange finishes, then IDs/membership/content remain unchanged and one undo restores exact previous geometry. Stale/error results do not alter the document. |
| AC-07 | Given a changed document, when autosave succeeds and the page reloads, then the latest durable document is restored; storage failure is visible and JSON download remains available. New/Open/Import protects unsaved-to-file work. |
| AC-08 | Given exported JSON, when reopened, then document semantics and saved geometry round-trip exactly. Invalid version, malicious text, dangling references, bad numbers and excessive input fail without overwriting current work. |
| AC-09 | Given a supported skill fixture with groups, statuses, edges and legend, when imported, then meaning is preserved, missing status is unset, unsupported icon warnings appear, and a complete initial layout renders. |
| AC-10 | Given approved quality fixtures, when SVG/PNG are exported, then the full diagram, labels, boundaries, icons, title and legend render without clipping; controls/grid/selection are absent. SVG has no external asset dependency, scripts or `foreignObject`; PNG 2x has twice each dimension of 1x. |
| AC-11 | Given 1440x900, 1280x720 and 390x844 viewports in Edge/Chromium, when key actions are exercised, then tools/text do not overlap, drawers do not block required actions and click-to-place works without dragging. Toolbar actions are keyboard reachable with accessible names. |
| AC-12 | Given the fixed stress fixture with 100 entities/150 connections on the PO's Windows machine, when 20 edit transactions and 10 layouts are measured in a production build, then p95 command-to-next-paint is <=100ms and each layout completes <=2s, with no worker computation blocking input. Record hardware/browser and measurements. |
| AC-13 | Given the simple three-tier fixture and a developer unfamiliar with Diagrammer, when asked to recreate its eight components, two boundaries and eight connections from a reference, then a usable SVG is produced within five minutes without coaching. PO observes and scores this manual usability test. |

Quality fixtures: simple three-tier app; grouped Azure integration with planned/not-connected states; nested-boundary cross-links with long labels; annotations plus an empty document; the stress graph. Fixture data is synthetic and explicitly not an assertion of a deployed architecture. Baseline screenshots and fixture IDs become frozen in DGM-001, before implementation comparisons.

## Exclusions

No freehand, accounts, backend, collaboration, AI/DSL generation, infrastructure discovery/deployment, cost estimates, AWS/GCP libraries, comprehensive UML/BPMN/ERD, C4 repository/drill-down, arbitrary asset upload, PDF/Visio/draw.io interchange, rich text, plugins, presentation mode, multiple open documents, mobile-first redesign or PWA/service worker. Deferred items require a new PO-approved spec.

## Risks and release gates

- Interactive export parity is not proven. DGM-000 must falsify the proposed shared-scene approach early, especially boundary endpoints and edge labels.
- ELK hierarchy/ports and React Flow layering differ. Validate nested cross-links and group endpoints before broad work; do not silently reduce grouping support.
- Azure asset distribution and font/ELK notice obligations require review. No asset bundling before approval.
- Import/export parsing and escaped text are a security-sensitive boundary. Escalate design review to the orchestrator/PO; use allowlisted assets and do not execute imported markup.
- IndexedDB availability/quota and multiple tabs can threaten local work. One writable tab per origin/document is the v1 contract; second tabs open read-only until the first closes. Use browser locks where supported in the target Chromium runtime and test the lock lifecycle.
- PNG output has browser canvas limits. Preflight dimensions and reject over-limit exports without affecting the document; establish the supported pixel cap during the spike.
- Performance/usability claims require measured/manual evidence. Failing a threshold is a reportable gate failure, not authority to weaken tests.

## Work-package specifications

These packages are planning-level task specs under this single review document. The orchestrator issues individual `docs/specs/<task-id>.md` contracts after approval and before dispatch; implementers cannot change this baseline.

### DGM-000: Browser feasibility spike

Context: test the proposed library/skill adaptation before product implementation. Interfaces: draft scene/layout contracts above. Cases: a nested boundary with a boundary endpoint and cross-links; manual movement plus Auto-arrange undo; escaped text; self-contained SVG/PNG in browser. Out of scope: production UI and storage. Risks: grouping/route/export mismatch. Done: browser evidence and a go/no-go report, license inventory and PNG cap; no unreviewed promotion of spike code. Owner: Orchestrator spike. Requires dependency approval.

### DGM-001: Foundation and contract freeze

Context: create the minimal app/test harness and stable interfaces so agents can work independently. Interfaces: document types, command/result types, scene primitives, worker messages, persistence adapter and editor callbacks. Cases: version/ID validation, blank-document fixture, stubbed shell renders, shared-scene smoke test. Out of scope: complete editor interactions and feature polish. Risks: premature/ambiguous interfaces. Done: individual task specs, fixtures, directories, scripts, version lock, asset manifest/terms and contracts approved; focused tests pass. Owner: one Implementer under orchestrator review. Depends on DGM-000 go decision.

### DGM-010: Document, history and persistence

Context: own graph mutations and durable local work. Interfaces: approved command/validation/history/persistence contracts. Cases: AC-03 through AC-09 domain behavior, including boundary promotion, ID remapping, malformed import, quota failure and tab lock. Out of scope: canvas UI, layout algorithm and rasterization. Risks: data loss/security at import and storage boundaries. Done: deterministic red/green tests, exact JSON round-trip and adapter failure evidence. Owner: Implementer A. Files: `src/document/`, `src/persistence/`, colocated tests. Depends on DGM-001.

### DGM-020: Canvas, sidebar and inspector

Context: make the visual workflow fast and discoverable. Interfaces: immutable document plus command dispatch, shared scene primitives, layout/export callbacks; test fakes until other owners deliver. Cases: AC-01 through AC-05 interaction portions, AC-11, keyboard/history controls and explicit layout action. Out of scope: domain reducer, worker implementation and export encoding. Risks: grouped coordinates, event/history storms, small-screen obstruction. Done: focused interaction tests and viewport screenshots, no duplicate state model. Owner: Implementer B. Files: `src/editor/`, colocated tests. Depends on DGM-001.

### DGM-030: Layout, scene and output

Context: adapt the skill into browser-safe layout and consistent output. Interfaces: scene builder, layout request/result and export contracts; never mutate the document store. Cases: AC-06 geometry/stale result, AC-09 import-layout rendering, AC-10 quality and AC-12 layout timing; annotations remain fixed. Out of scope: storage and canvas interaction mechanics. Risks: route origin, clipping, font/icon parity and PNG limits. Done: geometry tests, inspected SVG/PNG fixture evidence and compatible output primitives. Owner: Implementer C. Files: `src/layout/`, `src/render/`, `src/export/`, colocated tests. Depends on DGM-001.

### DGM-040: Integration and MVP completion

Context: connect the three completed slices into one user workflow. Interfaces: approved contracts only. Cases: add/connect/group/annotate/arrange/save/reload/export, undo across each action, async layout edits, storage errors and readonly second tab. Out of scope: new features or contract redesign. Risks: callbacks, route invalidation and async boundary mismatches. Done: end-to-end tests pass, build/typecheck pass, evidence recorded. Owner: one Implementer integrator. Files: `src/app/`, `src/main.tsx`, end-to-end tests; owner of app-wide styles. Depends on DGM-010/020/030.

### DGM-050: Independent sprint verification

Context: verify the integrated product against every acceptance criterion. Interfaces: frozen spec and production build. Cases: AC-01 through AC-13, exact JSON round-trip, imported text/assets, exports in Edge and manual SVG/PNG insertion into PowerPoint, measured performance and PO usability session. Out of scope: fixing code or weakening tests. Risks: visual fidelity and criteria claimed without evidence. Done: pass/fail matrix with commands/screenshots/measurements, docs matched to reality, issues logged and sprint demo delivered to PO. Owner: independent Verifier. Files: verification report/docs only. Depends on DGM-040; PO availability required for AC-13.

## Approval required

PO approved the spike and said "keep building the V1" on 2026-10-09. Foundation, three scoped parallel slices, integration and independent automated verification are complete. Production lives under `app/`; `spike/` is preserved. [DGM-050 evidence](../verification/DGM-050.md) records 11 criteria PASS and two requiring manual evidence. [Sprint review](../verification/sprint-1-review.md) remains open for PO acceptance; no next sprint is authorized.