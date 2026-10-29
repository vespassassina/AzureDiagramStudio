# UI Design Convention

Approved by the Product Owner on 2026-10-28 after the DGM-134 through DGM-139
source changes and preview. This is a reusable design rule, not authorization
to redesign unrelated screens.

## General Rule

Give each function one clear home, place controls beside what they affect,
and reserve space for the actual work. Separate application controls, editing
tools and content. Group related choices instead of multiplying buttons.
Use explicit, predictable state and persist meaningful preferences.

## Applying The Rule

- **Separate scopes.** Application information/preferences belong in application
  chrome; manipulation tools beside the work surface; view controls beside the
  view they open. Content browsers should primarily display browsable content.
- **One canonical home.** Avoid competing button clusters for the same panel or
  feature. Keyboard shortcuts and contextual actions may remain useful alternate
  access paths; this is not a ban on accessibility or context-specific access.
- **Protect working space.** Remove duplicate sections and reclaim their reserved
  height. Keep the primary canvas and useful library results prominent at narrow
  and short sizes, not only on a large desktop.
- **Group related choices.** Use a clearly named, accessible menu for variants
  of one operation rather than a row of ambiguous icon buttons. Keep frequent,
  distinct tools directly reachable.
- **Prefer explicit state.** Opening a panel keeps it open until the user closes
  it. Avoid ineffective pins, hover-only modes and unexpected auto-close.
  Temporary presentation/modal behavior must restore the user's intent.
- **Remember meaningful choices.** Persist favorites and configured locations
  within their documented profile scope. Show save failures honestly; do not
  silently migrate existing work or imply cross-device synchronization.
- **Make actions understandable.** Use clear names, tooltips and visible feedback.
  Describe output formats and limitations; do not imply that importing JSON
  installs code or that a preview is a published release.
- **Preserve interaction quality.** Simplifying controls must retain keyboard
  access, focus return, draft/history/selection preservation, responsive hit
  targets, themes and existing safety guards.

## Diagram Studio Placement

| Scope | Canonical location |
| --- | --- |
| New/Open/Import/Save | Top File menu |
| Panel visibility, Properties/Markdown, theme, existing fit commands | Top View menu |
| Settings, Help, About | Top Settings menu |
| Undo, Redo, Export, Present | Only top action buttons |
| Local save, error and ownership status | Bottom status bar (no top duplicate) |
| Diagram manipulation and drawing tools | Left drawing toolbar |
| Components and Favorites category | Component library, without duplicate architecture footer or pin |
| Properties and architecture Markdown | Shared sidebar, opened by the square Sidebar button after Auto-arrange |
| Horizontal/vertical/group-stacked layout variants | Auto-arrange dropdown |
| Diagram, Markdown and companion-file output choices | Export dialog and matching MCP export capabilities |

These placements are product-specific applications, not a global mandate that
every application use the same toolbar arrangement.

## Basis And Review

The PO explicitly requested the placements, duplicate-button removal, library
space, explicit open/close, persisted Favorites and workspace root. The broader
principle above was inferred from those requests, then explicitly approved for
repository and global agent guidance.

Contracts: [DGM-134](specs/DGM-134.md), [DGM-135](specs/DGM-135.md),
[DGM-136](specs/DGM-136.md), [DGM-137](specs/DGM-137.md),
[DGM-138](specs/DGM-138.md), [DGM-139](specs/DGM-139.md).
The approved [DGM-140](specs/DGM-140.md) menu placement supersedes the earlier
individual top buttons. [DGM-141](specs/DGM-141.md) adds a light workspace-only
paper tone and modest shared connection thickness, without changing custom
diagram/export backgrounds or the dark theme. The general rule is unchanged.
See the corresponding [verification reports](verification/DGM-134.md) for
independent automated evidence and retained manual/platform limitations.

For future UI changes, check scope/location, duplicate controls, usable working
space, predictable state and persistence. Verify actual pointer/keyboard
behavior at supported narrow/short/theme sizes; a DOM-presence assertion alone
does not establish usability.
