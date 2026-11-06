# DGM-151A: Workbook State And Backward-Compatible Persistence

Date: 2026-11-04. Status: APPROVED / QUEUED.
Parent: [DGM-151](DGM-151.md); [RFD004](../rfd/004-workbooks-and-interoperable-exports.md).
Prerequisites: accepted DGM-149 and DGM-150. Source-only.

## Context And Contract

Implement the approved workbook foundation, not tabs/rendering/PDF or new MCP
tools. Preserve old schemaVersion1 Diagram files and explicit no-migration policy.
PO-approved RFD005 amends accepted page versions to1 or2; v2 fields are only
created by explicit use of the newly approved features, never by opening v1.

Workspace document is Diagram or Workbook. Workbook has kind="workbook",
schemaVersion=1, stable id, title (existing120-character title limit), optional
description (existing60000-character Markdown limit), nonnegative integer
revision, and pages containing1-100 complete existing Diagram values. Page id
is Diagram.id; title/description come from that diagram, not wrapper duplicates.
Page ids are unique within a workbook; entity/connection ids are page-local.
Array order is canonical.5MiB raw page JSON and64MiB raw aggregate workbook
bounds apply before normalization/copying. Unsupported kinds/versions,
duplicate ids, malformed or oversized pages fail the whole input, not a subset.

Keep the active page and its camera/selection outside persisted content.
An internal workspace/session adapter can continue exposing active Diagram to
existing editor consumers, while retaining the complete root for save/recovery.
Open a workbook on its first page. Selection alone changes no persisted revision
or backup state. Existing legacy opens and saves remain Diagram JSON until an
explicit workbook creation/add-page operation. Never rewrite original files.

Root operations cover new workbook, add page, rename page, reorder pages,
workbook metadata and existing commands applied to a specified active page.
Reorder validates an exact permutation; no-op returns no history/revision.
Reorder/workbook metadata never change page revision or saved route validity.
Page edits use the existing domain command/revision policy for only that page.
Root revision advances for any accepted content/structural change.

Use one workspace history with structural sharing, not full deep copies of all
pages per edit. Undo/Redo restores all affected content/order/metadata; an Undo
of a page edit reveals that page. Navigation alone creates no history.
No new delete/duplicate/close-page operation in this slice.

## Safety And Persistence

Autosave/recovery and JSON backup/dirty state operate on the complete root,
not only the active page. Save success for one page export must not mark the
workbook backed up. Preserve current storage keys/old bytes; no DB migration.
Invalid recovery fails closed without replacing persisted bytes.

Request/generation guards capture workspace/page identity and revision before
async IO/layout. A page switch cannot let a late result mutate the new page;
cancel stale work explicitly. Existing ownership/Present/MCP draft guards remain.
Extend Recent's bounded supported JSON reads to the approved workbook limit;
legacy diagrams still fail above5MiB. No arbitrary path registration/access.

## Tests And Definition Of Done

Retain executed behavioral RED before production edits and focused GREEN under
`app/test-results/dgm151a`; typecheck/build plus independent verification.

- Given two pages with identical entity ids but distinct page ids/Markdown,
  when saving/recovering, then exact pages/order/content remain independent.
- Given old Diagram JSON, when opening/saving without explicit promotion,
  then it stays Diagram JSON. Given add-page promotion, retain the original
  diagram exactly and mark the new workbook dirty.
- Given unknown kind/version, empty/101 pages, duplicate page ids, >5MiB page
  or >64MiB aggregate, when parsed, then explicit errors and no partial state.
  Exercise exact bounds, not only representative small invalid inputs.
- Given saved route points onA/B, when reordering or editing workbook Markdown,
  then page revisions/routes are unchanged; editingA follows existing
  invalidation and never invalidatesB.
- Given edits onA/B plus reorder, when Undo/Redo across pages, then the correct
  page is visible and exact roots/history are restored.
- Given a deferred save/read/layout forA, when newer work or page selection
  occurs, then no result overwritesB or marks a newer root backed up.
- Given Recent reopen or persistence failure, preserve all workbook pages,
  dirty state and original bytes; successful reuse still promotes correctly.

Update factual architecture/manual foundation documentation without claiming
tabs, PDF or automation slices already work. No dependency, schema migration,
connector repair, package/version/Git/release/install or unrelated redesign.
