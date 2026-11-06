# RFD 005: Exact Attachments, Grid Color And Page State Styles

Date: 2026-11-04. Status: APPROVED / EXISTING-DIAGRAM SOURCE QUALIFIED;
CROSS-WORKBOOK AND PLATFORM QUALIFICATION PENDING.
Tasks: [DGM-155](../specs/DGM-155.md), [DGM-156](../specs/DGM-156.md).
Advanced page registry: [DGM-157](../specs/DGM-157.md).

## Confirmed Interaction Choices

Connector ends may attach at any relative point along an item's border.
The PO superseded the earlier detach-one-end choice: Canc/Delete removes the
whole connector. No free endpoint state is requested.
Grid gets12 swatches:3 greys, white, black, red, green, yellow, blue, orange,
purple, brown. Recommend saving the chosen color per diagram/page.
The PO also requested editable page-local functional state styles for boxes/
connectors, names/meanings, a configuration popover, legend integration and
agent/MCP configuration, using current fixed styles only as defaults.

## Problem

Current schemaVersion1 connection sides select midpoint ports, and manual route
points reset when geometry changes. They cannot secretly encode a persistent
relative border anchor. Grid has no saved color. Adding ignored properties to
version1 would let older apps silently lose new data on round-trip.

## Recommended Format Contract

- Accept existing Diagram schemaVersion1 unchanged. Add Diagram schemaVersion2
  for documents using explicit endpoint offsets, grid color or custom state
  styles; it retains all
  existing fields and their meanings. No migration of old input/profile files.
- Optional finite sourceOffset/targetOffset in[0,1] pair with an explicit,
  non-auto sourceSide/targetSide. Along top/bottom, offset is left-to-right;
  along left/right, top-to-bottom. Absence means existing automatic/midpoint
  behavior. Both entity ids remain mandatory. No dangling-end encoding.
- Optional grid.color is a validated normalized opaque hex color. The UI offers
  the12 requested named swatches; programmatic valid colors may remain custom
  without being relabeled as one of them. Missing means current Automatic.
- Optional stateStyles is a bounded page-local registry with stable id, name,
  plain-text meaning and supported box/connector paint settings. Undefined
  resolves current four presets; explicit empty means none. Keep one canonical
  item state reference, preserving version1 status behavior; version2 allows
  validated registry ids for entities and connectors. No arbitrary CSS/SVG/code.
  Removal of a used style requires explicit remapping/Unset, applied atomically.
  Freeze concrete field/bounds schemas before DGM-157 assignment; this format
  decision approves the registry envelope, not arbitrary extensibility.
- New features explicitly upgrade the in-memory document before their next
  save/export; normal opening/editing of legacy data alone does not. Retain
  version2 on subsequent edits rather than silently downgrading it.
- Version1 plus version2-only fields is rejected with a clear version message,
  not silently normalized away. Older apps reject version2, protecting it from
  accidental destructive down-level saving. Guide explains updated-app need.
- Workbook envelope version1 may contain valid Diagram pages of version1 or2.
  Update the approved workbook slice contract explicitly after PO approval;
  old single-page files and page-local ids/size limits stay unchanged.
- Add only these fields to relevant CLI/MCP validation/contracts after approval.
  State tokens, file/output bounds and no arbitrary-path MCP policy remain.

## Approved Concrete Registry

`stateStyles` is an optional array of at most64 entries. Each entry has:

- `id`: case-sensitive stable ASCII identifier, matching
  `[A-Za-z][A-Za-z0-9_-]{0,63}`; unique within the page.
- `name`: nonempty trimmed text, at most80 characters.
- `meaning`: plain text, at most1000 characters; empty is allowed.
- Optional `box`: only `fill`, `stroke`, `textColor`, `strokeWidth`, `lineStyle`.
- Optional `connector`: only `stroke`, `textColor`, `strokeWidth`, `lineStyle`.

Paint fields are optional overrides. Colors are normalized opaque `#rrggbb`
(accept/normalize shorthand hex at input); finite stroke widths are0.5–12 CSS
pixels; lineStyle is `solid`, `dashed` or `dotted`. No URLs, code or arbitrary
properties. Missing paint fields preserve base appearance. Absent registry
keeps exact legacy defaults, including their existing appearance; explicit
empty does not restore them.

Use the existing `status` property as the one canonical state reference:
version2 entities and connections may reference a resolved registry id.
Version1 keeps its exact existing entity status enum and connection shape.
Editing/replacing the registry and explicit remapping/Unset of removed used
ids must be one atomic validated command shared by UI/CLI/MCP, preserving the
existing state-token/history rules. No independent `styleId` interpretation.

The concrete bounds and paint/reference fields above were part of the approved
batched proposal, not permission to add further unreviewed public properties.

## Geometry And Output Invariants

Attachment offsets survive move/resize/reparent/layout, whereas manual segment
geometry follows its existing reset policy. Derive endpoints from the current
item rectangle and normalized side position; render and export must agree.
Do not couple stable anchor identity to stale routeRevision.

Exact border projection, corner tie-breaking, approach normals, usable drag
hit areas and orthogonal routing need behavior-specific tests, not just JSON
round-trip. Unconnected drops cancel. Canc/Delete cancels an active preview and
removes the whole edge once; late release cannot resurrect it.

Explicit grid color bypasses automatic hue adjustment; Automatic preserves
prior behavior. Grid on/off/style/snap/spacing are independent. Shared output
and page/workbook automation must retain both settings.

## Approval And Evidence Gate

The PO selected "Approve the backward-compatible v2 format and bounded styles
(Recommended)" after reviewing the versioning, exact offsets, page grid color,
64-style validated registry and mixed-version workbook proposal.
The concrete registry above is included in this approval. This is not
permission for schema migration, new dependencies, security relaxation,
package/release/install, global preferences or Git delivery.

Require retained executed
behavioral RED/GREEN and independent real gestures, save/reload plus actual
shared-format output. An accepted swatch or endpoint handle alone is not the
measurable outcome. Reuse source tests; no installed profile is a test fixture.
