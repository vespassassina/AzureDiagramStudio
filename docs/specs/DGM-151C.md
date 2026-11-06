# DGM-151C: Page/Workbook Exports And Combined PDF

Date: 2026-11-04. Status: APPROVED / QUEUED AFTER DGM-151A/B AND DGM-150.
Parent: [DGM-151](DGM-151.md); [RFD004](../rfd/004-workbooks-and-interoperable-exports.md).

## Contract

Export has explicit Page/Workbook scope. Preserve per-page SVG/PNG/JSON/
Markdown options and current backgrounds, bounds, font/icon and selection
semantics. A per-page JSON is a standalone schemaVersion1 Diagram; workbook
JSON is the full envelope. Workbook scope uses whole pages, never an old
selection from whichever editor last owned focus.

Workbook artwork ZIP contains ordered page SVG or PNG, per-page Markdown,
workbook Markdown and a manifest of stable page ids/titles/order. Prefix member
paths with zero-padded ordinal; sanitize names, handle duplicate titles, prevent
path traversal and reject collisions. Use existing ZIP support. Every page
comes from one immutable accepted root snapshot; incomplete exports fail as
a whole without a misleading partial-success download.

Combined PDF uses the already bundled Electron printToPDF through the isolated
render host, with one titled diagram per PDF page in saved tab order. Default
A4 landscape, fit the complete diagram inside margins without clipping, print
backgrounds, embed assets/fonts and wait for resource readiness. Workbook title
is document metadata; Markdown remains companion ZIP content, not unexpected
additional PDF pages. A per-page PDF uses the same path for one diagram.
No print dialog, installed printer or extra dependency.

Extend native save MIME/extension validation for approved outputs only. PDF
bridge accepts a validated structured snapshot/job, not arbitrary HTML/URL/path
or privileged renderer JavaScript. Keep sandbox/local-origin policies. Browser
builds honestly explain native PDF unavailability and offer supported exports.
MCP filesystem access remains absent; automation format integration is151D.

## Acceptance Cases

- Given N pages, when exporting workbook artwork, then the ZIP contains exactly
  the expected ordered artwork/Markdown/manifest with matching original content
  and safe unique paths, including duplicate/Unicode/malicious titles.
- Given backgrounds/icons/negative origins/large bounds/long titles, when
  exporting PDF, then actual PDF page count isN, order/titles/artwork match,
  all source content fits and no page is blank or clipped.
- Given a document edit/page switch after export starts, then output is one
  captured root and cannot mix revisions or clear a newer backup requirement.
- Given image/print/resource failure, oversized aggregate or canceled native
  save, then explicit failure/cancellation, no partial-success artifact and
  no source mutation. Old output bytes survive write failure.
- Given the previous standalone/page exporters, then real SVG/PNG/JSON/
  Markdown output retains its accepted shape and limits.
- Given browser-only runtime, then supported formats remain usable and PDF
  is explicitly unavailable rather than a renamed/empty file.

## Definition Of Done And Boundaries

Retain executed behavioral RED/GREEN/typecheck/build and hashes under
`app/test-results/dgm151c`. Independent actual PDF generation, page content/
pagination and ZIP decoding are required; a PDF magic header is not a pass.
Use source Electron fixtures, not installed profiles. Record missing external
viewer evidence as a cell limitation; do not install unapproved software.
Update guide/manual formats, scopes, examples and limitations.

No new dependency, Visio writer, package/version/release/install, GUI HTTP auth
change, arbitrary file/HTML bridge, automatic migration or Git delivery.
