# RFD 004: Diagram Workbooks And Interoperable Exports

Date: 2026-11-04. Status: APPROVED / SOURCE SLICES QUEUED.
Tasks: [DGM-151](../specs/DGM-151.md), [DGM-152](../specs/DGM-152.md).

## Confirmed Requirements

PO requested multiple contained diagram JSON pages, titled Excel-like bottom
tabs with drag sorting, workbook Markdown, each diagram's own Markdown,
presentation tabs, per-page/whole-workbook export and guide coverage.
The PO selected one portable workbook JSON with complete embedded diagram
pages, rather than separate files, then requested combined multi-page PDF
in addition to ordered ZIP export. Subsequent request: "can we add visio export ?".
Low usage friction remains the product direction.

The PO then selected "Approve the workbook, PDF and native Visio export scope
(Recommended)" after reviewing the backward-compatible workbook contract,
100-page/64MiB bounds, tabs/Markdown/exports, additive CLI/MCP integration and
editable VSDX with embedded-image icons. The recommendations below are approved
source scope. No installed/released capability is implied.

## Approved Document Contract

Introduce a distinct, versioned workbook envelope, not extra fields ignored by
the current diagram parser:

```json
{
  "kind": "workbook",
  "schemaVersion": 1,
  "id": "workbook-1",
  "title": "Solution architecture",
  "description": "Workbook Markdown",
  "revision": 0,
  "pages": []
}
```

The empty pages array above illustrates the shape, not a valid saved workbook:
valid workbooks have1-100 pages. Each array entry is a complete existing
schemaVersion1 or2 Diagram (v2 added by the subsequent approved RFD005).
Its existing id/title/description are the page
identity/title/Markdown: do not introduce competing title/description fields.
Page ids are unique within a workbook; entity/connection ids are page-local.
No cross-page connector is introduced. Array order is tab/export order.

Retain Diagram parsing/saving and old files unchanged. Opening a standalone
diagram does not rewrite it or force a workbook migration. Adding another page
or explicitly creating a workbook opts into the envelope. New workbook saves
include every page, never only the active diagram. Recent files read whichever
supported document kind was explicitly selected/saved.

Use existing5MiB per-diagram bounds,100 pages and64MiB aggregate raw
workbook JSON bounds, validated before copying/rendering. Reject invalid
pages/duplicate ids/unsupported versions as a whole; never silently drop them.
No on-disk schema migration or automatic rewriting of original JSON.

## State, UI And History

- Bottom tabs remain visible in Edit and Present, with horizontal scrolling,
  long-title handling and an accessible name/current-page indication.
- Add page, rename and drag reorder in Edit; keyboard-accessible move-left/right
  alternatives. Presentation tabs navigate only, never mutate structure.
- Workbook title/Markdown and page title/Markdown have distinct, clearly named
  homes in existing Properties/Markdown UI. Do not overload the same field.
- Only the active page mounts the diagram editor. Page switching retains
  per-page camera/selection intent and accepted content; no autosave or
  document replacement prompt merely because another tab is selected.
- Resolve active drafts/IME/gestures through existing explicit finish/cancel
  policies. A failed transition leaves the current page and draft intact.
  Async layout/import/export/MCP work captures workbook/page identity and
  revision so it cannot land on a different page after switching.
- One workbook-aware Undo/Redo timeline covers page edits and structural edits.
  Undoing an edit on another page reveals that affected page; navigation alone
  is not an edit. Structural snapshots share unchanged pages rather than
  repeatedly deep-copying the entire book.
- Temporary presentation ink stays page-local for the current presentation
  session and clears on exit, never becoming saved content or exported artwork.
  Navigation retains presentation state without edits.

## Export Defaults

Export has an explicit Page / Workbook scope. Existing per-page SVG/PNG/JSON/
Markdown behavior remains. Workbook editable JSON is one envelope. Workbook
artwork ZIP uses ordinal-prefixed safe unique paths, page artwork and page
Markdown in tab order plus workbook Markdown and a manifest identifying pages.
Duplicate titles cannot overwrite a ZIP member.

Combined PDF uses the existing Electron printToPDF facility via the isolated
render host, with one titled diagram per PDF page, fitted without clipping and
in tab order. Default A4 landscape, bundled artwork/fonts and no network/print
dialog. Workbook title goes into document metadata; Markdown is available as
the companion ZIP content rather than being silently reflowed into extra PDF
pages. Browser-only limitations must be explicit, not a pretend download.

Visio means native .vsdx, not SVG renamed or one screenshot per page. Export
the selected page or the workbook as ordered Visio pages with editable drawing
shapes, text and connected connectors. Icons may remain embedded images inside
editable components; no promise of vendor master stencils or editable icon
internals. Preserve geometry/styles/group intent as far as the supported format
can represent them, with unsupported details explicitly documented.

## Automation And Safety

Extend the approved CLI/stdio model through additive workbook/page operations.
Keep existing single-diagram commands and tools compatible. Page operations use
stable page ids and current workbook/page state tokens; never infer a target
from a mutable UI selection. Allow page/workbook export scopes and PDF/VSDX
formats consistently through explicit native/CLI output or in-memory MCP
resources, not arbitrary-path MCP tools.

No new dependency is planned: existing ZIP support plus XML can emit OPC VSDX,
and bundled Electron can print PDF. No sandbox/network/auth relaxation,
automatic profile migration, package/version/release/install, global config or
Git delivery is approved by a feature request alone.

## Trade-Offs And Validation

A single envelope is portable and preserves contained page JSON, but all-page
save/export validation, memory/history and file-size limits need new tests.
Deferring workbook changes until after the already approved headless contract
avoids silently modifying that task while it is being implemented.

PDF generation needs actual render/print evidence, not just a PDF header.
Native VSDX needs well-formed OPC/XML plus actual target-application opening,
page order, moving shapes and connected endpoint evidence; a ZIP signature or
schema-only check does not establish Visio editability.

Sources verified2026-11-04:
- [Microsoft Visio format introduction](https://learn.microsoft.com/en-us/office/client-developer/visio/introduction-to-the-visio-file-formatvsdx)
  documents VSDX as OPC/XML, with drawing pages/shapes/resources, not a raster
  image container disguised as a drawing. Use the linked Open Specifications
  and Visio XML schema during implementation.
- Existing Electron44 PrintToPDFOptions supports background printing, paper
  sizing/orientation and CSS pagination; reuse that runtime without an added
  PDF/printer dependency.
