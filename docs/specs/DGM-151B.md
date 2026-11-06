# DGM-151B: Workbook Tabs, Markdown And Presentation

Date: 2026-11-04. Status: APPROVED / QUEUED AFTER DGM-151A.
Parent: [DGM-151](DGM-151.md); [RFD004](../rfd/004-workbooks-and-interoperable-exports.md).

## Context And Interfaces

Build UI on the accepted workspace model/commands, not a second page store.
Follow docs/ui-design.md. Existing standalone diagrams remain usable; adding
a second page explicitly promotes their current content to a workbook.
Use File for new-document/workbook operations and bottom tabs for page
navigation/add/rename/reorder. Existing destructive whole-document replacement
must clearly say it replaces the workbook and retain confirmation guards.

## Acceptance Criteria

1. Titled bottom tabs appear in Edit and Present, with active-page indication,
   accessible names, horizontal overflow scrolling and usable small targets.
   The title uses existing page Diagram.title; long/duplicate titles remain
   navigable without overwriting content or being used as identity.
2. Edit mode can add a blank page, rename and drag-reorder tabs; accessible
   move-left/right alternatives work. All go through one workspace command/
   history path. No new delete/duplicate/page-close operation is required.
3. Workbook title/Markdown and active page title/Markdown have clearly distinct
   controls in existing Properties/Markdown surfaces. Existing safe Markdown
   Edit/Preview, draft preservation and navigation still hold.
4. Page switch preserves accepted content and page-local camera/selection.
   Draft/IME/gesture transition uses explicit existing policies; refusal keeps
   the original page/draft. Switching alone is neither edit nor confirmation.
   Pending results cannot land on a different page.
5. Present retains tabs and page navigation but no structural editing controls.
   Switching page keeps presentation mode, updates its description/content,
   and isolates temporary ink per page until Exit clears it. Ink never saves
   or exports. Editing chrome does not reappear unexpectedly.
6. File Save JSON saves all pages/workbook metadata/order. Existing guards,
   top/bottom chrome, responsive content and keyboard access remain coherent.
   Guide/manual explain page versus workbook metadata and save behavior.

## Given/When/Then And Definition Of Done

Retain behavioral RED then GREEN/typecheck/build, source hashes and independent
production-browser interaction evidence under `app/test-results/dgm151b`.

- Given content and unsaved Markdown onA, when switchingA/B repeatedly and
  reopening Properties/Markdown, then content/drafts follow their correct page.
- Given three titled pages, when dragging the last before the first or using
  keyboard move commands, then persisted tab order changes once; Undo restores.
- Given pending IME or refused gesture finalization, when selecting another
  tab, then there is no silent loss or wrong-page mutation.
- Given Present with page-local ink, when switching pages/back, then the correct
  page/description/ink appears; Exit clears all temporary ink and restores UI.
- Given narrow/short light/dark layouts and long titles, then tabs/controls,
  focus, panel scrolling and canvas remain usable. Use actual pointer/keyboard
  sequences, not only control-presence assertions.
- Given a saved workbook and exported active-page JSON, then only full-workbook
  Save can clear the workbook backup requirement.

No PDF/Visio implementation, new automation tools, dependency, packaging,
Git delivery or repair of separately blocked connector defects.
