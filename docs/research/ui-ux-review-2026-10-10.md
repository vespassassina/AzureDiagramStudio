# UI/UX Review: Fast Diagramming and Customer Meetings

Date: 2026-10-10. Status: REVIEW COMPLETE; proposed work awaits PO approval.

## Goal and Recommendation

Make Azure Diagram Studio the local-first architecture editor that a presenter can open, change and explain without interrupting a customer conversation. Optimize time to a readable result, confidence in edits, and easy handoff, not the number of tools or icons.

Retain the structured architecture appearance, curated service catalogs, explicit arrangement, reversible document commands and portable JSON/SVG/PNG. Prioritize meeting readability and editing reliability before expanding the feature catalog.

## Evidence Boundary

- The existing production preview at http://127.0.0.1:5174/ was inspected visually. It is not proof that unpublished source changes are in the release.
- The current worktree contains unpublished layer/layout changes and a bundled-image validator change. This review does not modify, accept or publish them.
- A separate source instance at http://127.0.0.1:5186/ is used for review with isolated browser storage. The user's original document is not changed.
- Competitor comparisons use official documentation, not timed competitor trials or a pricing comparison. Product editions can differ.
- Historical automated test results are not rerun results. The existing novice-usability and PowerPoint manual acceptance checks remain open.
- This is a planning pass. Proposed metrics and scope are not changes to the approved MVP acceptance criteria.
- Source baseline: commit `d5ac8f8` plus the existing working-tree changes. Browser measurements below use that source, not a newly published desktop binary.

## Findings, Ordered by Risk

### F1 - High: A Layer Action Reorders Unselected Objects

Verified with the current pure command and scene functions in the browser, using a synthetic document whose entity array is `[front component, back rectangle, boundary]`, with legacy foreground/background fields and no numeric order.

- Before: back-to-front paint order is `[back, boundary, front]`.
- Action: Send to bottom on `back`, which is already at the bottom.
- After: paint order becomes `[back, front, boundary]`. Two unselected objects change relative order.

The [command sort](../../app/src/document/commands.ts#L279) defaults all missing order values to zero, whereas [scene ordering](../../app/src/scene.ts#L194) defaults background/boundary/foreground to -1/0/4. This is a confirmed defect, not a taste judgment. It also shows why the previous green suite does not establish the new ordering behavior.

Related risks to test, not separately claimed as reproduced defects: boundary/child ordering in exported SVG; ties and sparse order values; legacy layer commands after numeric ordering; route invalidation on a stacking-only change; multi-selection relative order. The renderer must define how connections sit among objects. React Flow's parent and selection elevation must not silently override the intended document order.

Observed feedback issue: selecting App Service gives its DOM node z-index 1004 although its ordinary value is 4. A selected object can therefore look above others while the user is trying to send it backward. Test selected and deselected states, not raw z-index equality alone. The four controls also reuse two identical glyphs, making one-step and extreme actions hard to distinguish without hovering. See [node mapping](../../app/src/editor/EditorSurface.tsx#L384) and [layer controls](../../app/src/editor/EditorSurface.tsx#L441).

Recommendation: one canonical stacking policy, four distinct action affordances, no-op behavior at the extremes, one-step undo, JSON round-trip tests and browser/export visual verification. This is a release blocker for the unpublished layer feature. Proposed task: [DGM-101](../specs/DGM-100.md#dgm-101---predictable-object-order).

### F2 - High: The Editor Is Not Yet a Presentation Surface

The preview dedicates both sides of the window to tools/properties even when no object is selected. The diagram can occupy a small fraction of the visible area, while title, layout toolbar, legend and selection controls compete for canvas space. Screen sharing makes this more consequential: the audience needs the diagram, not the editor chrome.

The current editor exposes no dedicated presentation mode. See [panel defaults](../../app/src/editor/EditorSurface.tsx#L106) and [canvas controls](../../app/src/editor/EditorSurface.tsx#L410).

At 1280x720 with both panels open, the canvas is 764x617 CSS pixels, about 60% of window width, and the sample fits at 65% zoom. Closing both panels and fitting increases the canvas to 1224x617 and the sample to 89% zoom. This is existing functionality with too many preparatory actions, not evidence that a new renderer is needed.

Recommendation: an explicit Present command that hides editing chrome, protects document content from accidental edits, frames the chosen content, and restores the previous editor view on exit. Include fit-selection and a temporary pointer; defer slide authoring and permanent annotations. Keep explicit Synthetic/Planned/Not connected semantics visible. Hiding tools is not redaction of customer content. Tasks: [DGM-103](../specs/DGM-100.md#dgm-103---readable-workspace-and-navigation), [DGM-104](../specs/DGM-100.md#dgm-104---safe-presentation-mode).

### F3 - High: Arrangement Is Stable in the Sample, but Not Proportionate with Long Headers

The Commerce sample produced identical boundary geometry across four consecutive RIGHT arrangements. The earlier repeated-growth symptom did not reproduce in that case.

However, with 120-character boundary labels and 200-character subtitles, platform/application header text ends at y=163 while the first child starts at y=371: a 208-unit gap. Data services has a 176-unit gap. These are supported text limits, though deliberately adversarial content. The [header calculation](../../app/src/layout.ts#L41) always measures wrapping at width 180 even when the final boundary is 586 or 1098 wide. This avoids clipping by reserving excessive space.

Recommendation: calculate stable content/header dimensions together, shrink obsolete bounds, preserve existing annotation-position contracts, and test both compactness and containment. Use small local tidy/align operations for manual edits later; do not make whole-diagram rearrangement the answer to every spacing problem. Tasks: [DGM-102](../specs/DGM-100.md#dgm-102---stable-content-sized-arrangement), [DGM-110](../specs/DGM-100.md#dgm-110---local-alignment-tools).

### F4 - Medium: Search Does Not Match Common Spoken Service Names

Observed: `APIM` returns no insertion results. `Entra` returns IoT Central and Business Central alongside identity products because of substring matching. `OneLake` and `PostgreSQL` do return relevant choices. See [catalog presentation](../../app/src/catalog/presentation.ts).

Recommendation: curated aliases, exact-name/alias-first ranking, keyboard selection and a small recent/favorite set. Preserve saved legacy icon keys and current lifecycle rules. Avoid adding fuzzy matching infrastructure before testing a small alias/ranking change. Task: [DGM-106](../specs/DGM-100.md#dgm-106---find-the-intended-service).

### F5 - Medium: Common Workflows Still Require Panel Travel

Components are chosen in the left library, placed on the canvas and edited in the right inspector. Connections can be created with a tool or handles, but adding a connected service is not an adjacent quick-add workflow. Examples exist as files outside the application rather than an integrated starting point.

The [component choice handler](../../app/src/editor/EditorSurface.tsx#L276) also changes behavior with selection: with an edge selected, choosing a library component immediately inserts it on that edge; otherwise it enters placement mode. Keep the useful split-edge capability but make the active action explicit so a palette choice does not surprise a presenter.

Recommendation: contextual add-and-connect, inline label editing, a compact searchable command menu, and a small curated starter picker. Keep advanced properties in the inspector; do not add a ribbon full of controls. Tasks: [DGM-107](../specs/DGM-100.md#dgm-107---add-and-connect-in-context), [DGM-108](../specs/DGM-100.md#dgm-108---direct-editing-and-keyboard-actions), [DGM-109](../specs/DGM-100.md#dgm-109---curated-starting-diagrams).

### F6 - Medium: Meeting Handoff Still Means Exporting a File

The export menu exposes SVG, PNG 1x/2x and transparency. It has no Copy image, selection-only scope or meeting/slide-sized preset. The internal object clipboard is intentionally not a cross-application image clipboard. This is a missing workflow, not a broken existing promise.

Recommendation: Copy image with a file-download fallback, selection/whole-diagram export, previewed crop, and a 16:9 white-background preset. Keep editable JSON distinct from pictures. Verify real Teams chat and PowerPoint paste; a browser clipboard call succeeding is insufficient. Task: [DGM-105](../specs/DGM-100.md#dgm-105---meeting-and-slide-handoff).

### F7 - Medium: Save and Portability Need Clearer Product Language

The UI uses Saved alongside JSON backup needed; both can be technically correct, but the distinction is easy to miss during a meeting. The manual confirms that browser origins and desktop profiles have separate local stores, with JSON needed for transfer.

Recommendation: distinguish Saved on this device from an exported editable file, provide a discoverable Save a copy action, and keep customer data local by default. Do not imply cross-device sync or universal managed-device support. Do not add automatic recovery-history storage without a separate data-retention decision. Tasks: [DGM-111](../specs/DGM-100.md#dgm-111---clear-save-and-transfer-states), [DGM-112](../specs/DGM-100.md#dgm-112---portability-decision-spike).

The [manual](../manual.md) still names the old binary order buttons. It also describes packaged offline tests near the beginning but says final offline verification remains pending near the end. Those are documentation inconsistencies to reconcile against release evidence, not grounds to assume every platform works.

### F8 - Medium: Responsive Does Not Yet Mean Comfortable to Use

At 390x844, there is no horizontal page overflow and the side panels start closed. The sample is nevertheless fit at roughly 30%; rail targets are 31x31, file actions 30x29 and zoom controls 28x28 CSS pixels. Small targets and hover-only explanations impose effort on touch users. Several desktop support labels are only 9-11px before any screen-share scaling.

Recommendation: preserve a compact desktop design but offer touch-appropriate targets, keyboard-visible descriptions, clear focus and intentional drawer behavior. Keep the phone promise to viewing, focused edits and export initially; tablet/laptop editing and full phone authoring are separate product decisions. This is not a formal WCAG conformance audit. Tasks: [DGM-103](../specs/DGM-100.md#dgm-103---readable-workspace-and-navigation), [DGM-113](../specs/DGM-100.md#dgm-113---qualify-supported-platforms).

## Existing Strengths to Preserve

- Professional architecture tiles and meaningful boundaries rather than a mandatory sketch aesthetic.
- Service search, curated Azure/Microsoft/Fabric and software/vendor choices, plus custom artwork.
- Explicit arrangement and ordinary undo rather than automatic disruptive reflow.
- Local-first operation and self-contained diagram files/images without mandatory sign-in.
- Theme preferences independent of the portable diagram's appearance.

## Consistency Against Our Own Goal

| Intended experience | Current tension | Design direction |
| --- | --- | --- |
| Quick start | Hundreds of choices; examples are external files | Search aliases, recent choices, optional in-editor starters; no mandatory onboarding |
| Low-effort editing | Left palette, canvas, right inspector; selection-dependent insertion | Keep the next common action near the selected object and make it explicit |
| Confident changes | Legacy order normalization changes unselected stacking | One command/render order policy and behavior-focused tests |
| Polished composition | Stable layout can still waste large header areas | Fit to content and bounded padding, not worst-case padding everywhere |
| Customer-ready view | Tools and properties remain the default audience view | Edit and Present as distinct session modes |
| Clear semantics | Color-name legend entries can read like technical meaning | Preserve explicit status meaning; consider curated legend entries later |
| Local-first portability | Saved is local, not a transferable backup | Clear state labels and deliberate export/open transfer |

## Competitor Patterns

Official sources retrieved on 2026-10-10. These are capability comparisons, not measured speed, quality rankings or licensing recommendations.

| Reference | Documented strength | Upgrade to borrow | What not to adopt by default |
| --- | --- | --- | --- |
| [draw.io](https://www.drawio.com/docs/manual/connectors/connect-shapes/) | Directional clone/connect; drop-to-connect; keyboard add/connect | Adjacent quick-add with one atomic undo | A large stencil/formatting surface |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | Bound arrows, shape libraries, local-first hosted app, image/clipboard export, PWA | Immediate editing and low-friction picture handoff | Mandatory sketch styling or collaboration infrastructure |
| [tldraw SDK](https://tldraw.dev/features) | Selection/transforms, alignment/distribution, navigation and accessibility primitives | Coherent canvas conventions and predictable keyboard/focus behavior | A framework migration or assumption of free production licensing |
| [Lucidchart](https://lucid.co/lucidchart/use-cases/documenting-systems-architecture) | Cloud shape libraries, Presentation Mode, revisions and collaboration | Purpose-built audience view and easy presentation handoff | Accounts, enterprise integrations and AI as prerequisites |
| [Eraser](https://docs.eraser.io/draggable-edits-beta) | Generated diagram layout with drag/drop edits; explicit and code-triggered layout reset | Deliberate automatic composition with clear impact | Automatic loss of manual placement following ordinary edits |
| [IcePanel](https://docs.icepanel.io/core-features/diagramming) | In-canvas creation, search-to-focus and linked levels of architectural detail | Focus on a selected subsystem during explanation | A cross-diagram C4 model repository for this iteration |

The competitive opportunity is the combination: polished service-aware diagrams, low setup effort, explicit local control and meeting-safe editing. None of these sources proves we are faster. Validate that through the same timed task, not a subjective product score.

Visio and Miro are sensible later benchmark candidates, particularly for Microsoft-oriented customers and workshops. Their requested pages could not be inspected in this pass (sign-in redirect/404), so no current feature or licensing claims about them are used here. Lucid/tldraw deep links also failed initially; the accessible official pages above replaced them.

## Proposed Experience

1. Open directly into a useful editing surface. Offer a small starter chooser only when requested; retain blank-diagram creation.
2. Find a service by name or familiar acronym. Insert it; add its next connected service beside it; rename directly.
3. Tidy only what needs attention. Arrange the whole graph explicitly when that is the intended change.
4. Enter Present in one action. Show the architecture without editing controls, focus a subsystem, point temporarily, and exit to the exact previous editing view.
5. Copy a diagram image into the meeting or deck. Save the editable file separately for continuation on another device.

No marketing redesign is needed. Keep IBM Plex Sans, restrained teal commands, semantic accent colors and the existing tile language. Reduce competing chrome, improve label contrast and target sizes, and give the diagram the space gained.

## Evidence Summary and Limits

| Check run during this review | Observation |
| --- | --- |
| Source browser at 1366x768 | Canvas 850x665; default fit about 72%; both panels open |
| Source browser at 1280x720 | Canvas 764x617, 65% fit; with panels closed and refit, 1224x617, 89% fit |
| Source browser at 390x844 | Canvas 347x704; no page overflow; approximately 30% fit; 28-31px controls |
| Dark and light modes | Inspected; source theme toggle works; full contrast audit not run |
| Layer regression | Already-bottom action reverses two unselected objects in legacy fixture |
| Selection feedback | App Service DOM z-index rises from ordinary 4 to selected 1004 |
| Repeated layout | Four RIGHT layouts of the unchanged sample yield identical boundary geometry |
| Long-header layout | 176-208 units between measured header text bottom and first child in fixture |
| Search | APIM absent; Entra includes unrelated substring matches; OneLake/PostgreSQL present |
| Export menu | SVG, PNG 1x/2x and transparency; no cross-app image-copy command |

The geometry/ordering probes used imported pure functions and synthetic clones, not writes to the user's diagram. Browser interactions used a separate origin. No source changes, dependency installs, release rebuilds, Git operations that mutate history, real customer data, or external uploads were performed.

Not verified here: timed novice performance; actual Teams recipient readability/compression; Office insertion/paste; macOS runtime; native x64 hardware; browser first-launch offline behavior; managed-device permissions; formal accessibility conformance. These are gates in the [proposed work plan](../specs/DGM-100.md), not implied passes.