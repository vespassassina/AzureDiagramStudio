# Diagramming Tool Research

Date: 2026-10-09. Purpose: inform Diagrammer's MVP, not rank products by an unmeasured score.

## Method and limitations

Searched the web for simple architecture diagram tools and compared official documentation, licenses and independent reviews. Two read-only research agents examined product patterns and the existing local diagram skill. No applications were interactively benchmarked; beauty and speed recommendations below are judgments, not measured facts.

TechRadar reviews of draw.io and Lucidchart, updated in July 2024, provide independent observations about usability. They disclose affiliate commissions and do not establish current pricing or performance. G2 requests returned HTTP 403; no G2 rating or consensus is asserted. Search snippets are discovery aids, not evidence of product capabilities.

## Useful references

| Tool | Evidence and strength | Lesson for Diagrammer | Avoid in this MVP |
| --- | --- | --- | --- |
| Excalidraw | Official repository documents immediate editing, bound arrows, libraries, undo, local autosave and SVG/PNG/JSON. Its intentionally hand-drawn output is a stylistic choice. | Minimal friction, familiar direct manipulation, few visible controls. | A sketch aesthetic as the sole export style. |
| tldraw | SDK documentation covers selection, transforms, camera controls, alignment and custom tools. | A coherent canvas interaction model and restrained chrome. | Assuming the production SDK is MIT; it requires a valid production license. |
| diagrams.net / draw.io | Official docs explain attached connectors, directional quick-connect and export. TechRadar praises its beginner-friendly UI, shape previews and contextual panels. | Searchable palette, quick-connect, contextual inspector. | Huge stencil collections and formatting menus. |
| Lucidchart | Official docs cover architecture libraries and exports. TechRadar describes getting started in minutes and intuitive left tools/right properties. | Progressive disclosure and good output controls. | Accounts, enterprise integrations and collaboration. |
| Eraser | Official docs describe architecture nodes, groups, connections and automatic composition. Significant code changes can reset manual layout edits. | Clean architecture structure and deliberate automatic layout. | Mandatory DSL/AI and implicit destruction of manual positions. |
| IcePanel | Official docs describe C4 objects shared across diagrams, relationships, drill-down and SVG/PNG/model exports. | Semantically meaningful components and ownership boundaries. | Cross-diagram model identity and repository management. |

These are the strongest references for different parts of the experience. No source establishes that one tool is universally the simplest or produces the most beautiful diagrams.

## Recommendation

Combine Excalidraw's low friction, draw.io's connector mechanics and Eraser's composition with the existing skill's crisp architecture tiles, boundaries, status badges and ELK layout. Provide a visual editor with explicit, reversible Auto-arrange.

The PO selected this direction, generic software plus curated Azure components, structured drawing without freehand, and a local-first desktop SPA without a backend. See [the specification](../specs/DGM-MVP.md).

## Existing skill: verified foundation

Read-only inspection of `~/.agents/skills/azure-arch-diagrams/` found:

- `SKILL.md`: JSON nodes, nested groups, labelled edges, RIGHT/DOWN direction, semantic colors, status badges and legend.
- `render.mjs`: `buildNode`, `buildGroup`, ELK layered/orthogonal configuration, recursive coordinate handling, SVG construction, rounded connector paths and embedded icons.
- `icons.mjs`: generic SVG glyphs and a semantic palette.
- `package.json`: `elkjs` declared as `^0.9.3`; this is a version range, not a verified installed version.
- Node-specific boundaries: process arguments, filesystem reads/writes, icon file lookup and headless Edge PNG export.

The browser can reuse or adapt graph conversion, visual rules, icon glyphs and coordinate logic. It cannot directly import the CLI as its editor engine. Manual geometry, history, validation, persistence, browser PNG output and interactions are new work. Official Azure icons are not bundled with the skill.

Do not equate ELK with an editor or promise identical CLI/browser output before testing. File-based icon loading must become an allowlisted bundled manifest. Preserve the local skill unchanged.

## Reuse and license implications

| Candidate | Verified terms or constraint | Planning consequence |
| --- | --- | --- |
| React Flow core | MIT; documented custom nodes, parent-relative grouping and ELK integration. | Preferred interaction library. Implement application history/group commands ourselves; paid Pro examples are not assumed reusable. |
| Excalidraw core | MIT; broad whiteboard model. | Viable alternative if sketching becomes central, but adapting its scene to the skill is additional work. |
| tldraw SDK | Source available, not permissively open-source; production key required. | Do not adopt without a deliberate licensing decision. |
| draw.io | Apache-2.0 core; stencil/assets have separate terms. | Inspiration is useful; do not copy a complete stencil catalog. |
| elkjs | EPL-2.0. | Verify exact package license, notices and applicable source-distribution obligations before shipping. |
| Azure architecture icons | Official guidance permits architecture-diagram use and restricts alteration/product branding. | Review actual downloaded asset terms and web-app bundling rights; keep official glyphs unchanged. |

These are engineering flags, not legal advice. No dependencies or assets were installed during planning.

## Sources

Sources consulted on 2026-10-09, either directly or by the research agent:

- [Search query](https://www.bing.com/search?q=best+simple+architecture+diagram+tools+Excalidraw+Eraser+reviews).
- [Excalidraw repository and documentation](https://github.com/excalidraw/excalidraw).
- [tldraw overview](https://tldraw.dev/), [persistence](https://tldraw.dev/docs/persistence), [image export](https://tldraw.dev/sdk-features/image-export), [license](https://tldraw.dev/community/license).
- [draw.io quick-connect](https://www.drawio.com/docs/manual/connectors/connect-shapes/), [SVG caveats](https://www.drawio.com/doc/faq/export-to-svg), [offline limitations](https://www.drawio.com/doc/faq/offline), [repository and terms](https://github.com/jgraph/drawio).
- [Lucidchart architecture tools](https://lucid.co/lucidchart/use-cases/documenting-systems-architecture), [export](https://help.lucid.co/hc/en-us/articles/16324571257492-Export-or-print-a-Lucid-document), [offline constraints](https://help.lucid.co/hc/en-us/articles/14756313957268-Edit-offline-in-Lucid).
- [Eraser architecture diagrams](https://docs.eraser.io/cloud-architecture-diagrams), [manual layout edits](https://docs.eraser.io/draggable-edits-beta).
- [IcePanel diagramming](https://docs.icepanel.io/core-features/diagramming.md), [export](https://docs.icepanel.io/core-features/export.md).
- [TechRadar draw.io review](https://www.techradar.com/reviews/drawio), updated 2024-07-24; [Lucidchart review](https://www.techradar.com/reviews/lucidchart), updated 2024-07-22.
- [React Flow quick start](https://reactflow.dev/learn), [subflows](https://reactflow.dev/learn/layouting/sub-flows), [ELK example](https://reactflow.dev/examples/layout/elkjs), [MIT license](https://github.com/xyflow/xyflow/blob/main/LICENSE).
- [ELK.js](https://github.com/kieler/elkjs), [license](https://raw.githubusercontent.com/kieler/elkjs/master/LICENSE.md).
- [Official Azure architecture icons and usage guidance](https://learn.microsoft.com/en-us/azure/architecture/icons/).

Azure best-practice guidance was requested. Azure provisioning, identity and deployment guidance does not introduce Azure services into this local-only scope.