# RFD 001: Interactive Editor Foundation

Date: 2026-10-09. Status: APPROVED V1 DIRECTION; IMPLEMENTED AND AUTOMATICALLY VERIFIED. Decision owner: PO.
Spec: [DGM-MVP](../specs/DGM-MVP.md). Evidence: [tool research](../research/diagram-tools.md).

## Problem

The local skill produces attractive ELK/SVG diagrams, but its CLI controls placement and relies on Node/filesystem/Edge export. The selected product requires direct visual editing, deliberate layout and portable output, without turning into a full whiteboard.

## Options

| Option | Benefits | Costs and risks | Recommendation |
| --- | --- | --- | --- |
| React Flow core + ELK + shared SVG scene | MIT interaction library; handles, viewport, custom nodes and parent-relative grouping; ELK matches the skill. | History, domain commands, scene/export parity and compound routes still need work. Some advanced examples are paid; core capability does not supply a complete editor. | Preferred, subject to spike. |
| Excalidraw core with crisp styling | MIT; existing rich whiteboard interactions and output. | Its scene/shape model is not the skill's graph; semantic boundaries and ELK/route mapping require adaptation. Sketching is outside selected scope. | Alternative if whiteboarding becomes central. |
| tldraw SDK | Strong editor SDK and custom shape/tool model. | Production license/key; custom SVG fidelity and domain adaptation remain necessary. | Only with explicit licensing approval. |
| Purpose-built SVG canvas | Close alignment to skill rendering. | Selection, pan, zoom, gestures, grouping, handles and accessibility are substantial bespoke engineering. | Not the focused MVP choice. |
| Layout-first composer | Closest to current skill, smallest surface. | No meaningful manual placement; conflicts with selected visual editing model. | Rejected by PO product selection. |

## Proposed decision

Use React/TypeScript/Vite and React Flow core, with framework-independent document commands and shared SVG-compatible scene definitions. ELK runs only on explicit Auto-arrange in a browser worker. Use browser IndexedDB and canvas PNG rasterization, not an Azure/backend service or headless browser.

Do not expose React Flow's instance JSON as the portable contract. Do not screenshot the app to create vector exports. Node SVG primitives, connector geometry, text metrics and style tokens must be shared between canvas and export, with a feasibility gate proving the approach.

## Proposed dependency/asset envelope

The PO authorized this envelope, accepted DGM-000 and authorized V1 on 2026-10-09. Compatible versions are pinned in `app/`; asset provenance and retained notices are recorded there. External distribution and final manual acceptance are not inferred from the local implementation.

- Runtime: React, React DOM, `@xyflow/react`, `elkjs`, `lucide-react`.
- Tooling: TypeScript, Vite and React plugin; Vitest, jsdom, Testing Library and Playwright where needed by the approved checks.
- Assets: unchanged curated official Azure architecture icons; a locally bundled readable font with approved distribution terms.
- No UI framework, state/store package, PNG capture library, cloud SDK, AI SDK or service worker by default.

React Flow core is MIT; ELK is EPL-2.0. Exact dependencies, transitive licenses, notices and asset redistribution rights require review. The font choice and the 24-service Azure manifest are not yet frozen. Do not infer permission from a diagram-use claim alone.

## Falsifiable hypothesis and spike

Hypothesis: React Flow can supply direct manipulation while the skill-derived scene and ELK adapter supply quality layout and self-contained SVG/PNG without a second visual model.

Cheapest discriminating check: one browser fixture with nested containers, a group endpoint, cross-container connections and a long label; move a component, arrange, undo and export both formats. Compare scene geometry, inspect pixels and ensure exports need no app DOM/CSS/network. A separate malformed-text input must remain inert.

Go requires attached edges, correct group coordinate transforms, preserved manual geometry on ordinary edits, reversible layout and unclipped vector/raster output. No-go triggers PO review of a smaller supported graph or another editor approach; no implementer can silently remove a criterion.

## Consequences

- A small worker/scene boundary gives clear parallel ownership after contracts freeze.
- Manual orthogonal connectors can cross obstacles; full automatic router quality is only evaluated after explicit layout on agreed fixtures.
- The skill's palette and composition inform the new app, but behavior compatibility is verified by fixtures rather than code-reuse percentages.
- A renderer that drifts between editor and exported images is a release defect, not an acceptable polish item.
- Local-first saves operate on the current origin/browser. Portable JSON is the backup and transfer mechanism; hosted storage and offline loading are separate future decisions.