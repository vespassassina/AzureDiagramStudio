# DGM-151D: Workbook-Aware CLI And MCP

## Current PO Automation Approval, 2026-11-06

The PO approved the bounded workbook automation contract: MCP `get_workbook`,
`edit_workbook` and `export_workbook`; create/add/rename/reorder, workbook
metadata and explicitly targeted page edits; stable page IDs and current
state tokens; CLI equivalents with explicit page/scope selection.
Existing single-diagram commands remain compatible. No filesystem or shell
tools are added. Record the concrete strict argument schemas alongside
implementation, using existing validated commands and the bounds below;
do not add operation categories or implicit title/index-based targets.
This approval removes the historical name-freeze gate, not validation,
safety or runtime acceptance requirements.

Date: 2026-11-04. Status: APPROVED SCOPE / INTERFACE FREEZE AFTER DGM-150.
Parent: [DGM-151](DGM-151.md); [RFD004](../rfd/004-workbooks-and-interoperable-exports.md).
Prerequisites: accepted DGM-150 and DGM-151A/B/C.

## Scope And Contract Invariants

### Frozen automation schema (PO approval, 2026-11-06)

The only additive MCP tools are `get_workbook`, `edit_workbook`, and
`export_workbook`. `get_workbook` takes `{}` and returns root metadata, ordered
`{id,title}` page descriptors and current root/page tokens. `edit_workbook`
takes `{stateToken,commands}`; its bounded commands are `newWorkbook`,
`addPage`, `renamePage`, `reorderPages`, `workbookMetadata`, and
`pageCommand`. Every page command has an explicit stable `pageId`; no page
index or title resolution is permitted. `export_workbook` takes
`{stateToken,scope:"page"|"workbook",pageId?,format}`; `pageId` is required
for page scope and format is one of `json`, `svg`, `png`, `markdown`, `zip`,
`pdf`, or `vsdx`. All objects reject unknown fields. CLI equivalents use
explicit `--page PAGE_ID` and `--scope page|workbook`; no filesystem or shell
tool is added. Legacy diagram operations retain their compatibility but bind a
returned page token to that exact page or reject stale/ambiguous use.

Expose approved workbook/page functionality through additive CLI/MCP commands
and generated help. After DGM-150 acceptance, freeze exact names/argument
schemas here before assigning implementation; do not preemptively modify its
approved single-diagram contract or invent a second document engine.

CLI must discover page ids/titles/order, create a workbook, add a page, rename,
reorder, edit workbook metadata/Markdown, target existing per-page edits/layout,
and export Page/Workbook with PDF plus existing formats. DGM-152 later adds
VSDX. Explicit output paths and no-overwrite defaults remain.

MCP reads workbook metadata/page identities and full individual pages, performs
bounded atomic workbook/page operations and returns scoped export resources.
Use stable page ids and opaque current workspace/page state tokens; never infer
targets from a stale UI selection, nonunique title or position.
Do not introduce arbitrary file read/write, path-based page loads, shell,
remote assets or auth changes. Startup --input may accept the approved workbook
format; mutations remain in memory. Keep stdout clean and errors machine-readable.

Existing single-diagram callers remain compatible. In workbook context, legacy
get_document/edit behavior must bind the returned token to its exact page or
reject with actionable guidance, never silently edit a different selected page.
No existing create/replace command may silently discard the rest of a workbook.
No autosave/input-file mutation by headless MCP.

## Acceptance Cases And Definition Of Done

- Given a legacy input and previous CLI/MCP commands, then supported behavior,
  output shape and errors remain compatible.
- Given a workbook with duplicate titles and page-local overlapping entity ids,
  when requesting explicit page ids, then only the specified page is read/edited
  and page discovery is unambiguous.
- Given a stale token or page switch/newer mutation during a request, then reject
  rather than misroute, partially apply or overwrite newer work.
- Given workbook/page exports, then CLI files and decoded MCP resources match
  the shared writer's exact scope/page count/order/content and MIME type.
- Given create/add/rename/reorder/metadata changes, then all pages/Markdown
  persist through explicit JSON output and history stays consistent.
- Given invalid/oversized input, EOF or worker crash, then clean bounded
  protocol/errors, resources closed and all input/original outputs unchanged.

Retain behavioral RED/GREEN, exact source/build hashes and independent real
CLI/stdio subprocess results under `app/test-results/dgm151d`.
Update in-app guide/manual with copyable page/workbook CLI/MCP examples,
JSON/file/stdout semantics and recovery; no installed0.5.1 capability claim.

No dependency, network transport, persistent daemon, global agent config,
automatic migration, package/release/install or Git delivery.
