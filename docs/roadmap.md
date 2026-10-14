# Diagrammer Roadmap and Delegation Plan

Updated: 2026-10-14. Status: EXECUTE THE REMAINING APPROVED LOCAL WORK; RELEASE/PLATFORM ACCEPTANCE IS SEPARATE.

## Current Execution Policy

This section and the queue below are the current routing authority. The PO said
"skip revire and start next sprint" and subsequently requested a roadmap agents
can complete without stopping for every minor decision or task. For this
repository, that supersedes the older task-by-task approval and sprint-review
continuation stops in the historical record, DGM-100 and task handoffs. It does
not waive tests, independent verification, frozen behavior, manual acceptance,
or the safety gates below. Global preferences are unchanged in other repositories.

Reviews are asynchronous reporting checkpoints, not permission to take the next
already-authorized action. Complete the approved local queue before returning a
consolidated handoff. Do not invent another sprint, redo a completed feature, or
substitute cosmetic work because a different task is blocked.

## Execution Queue

Execute in order; skip only blocked dependencies, not acceptance criteria.
Update this table before every handoff with evidence and the exact next action.
The starting statuses below reconcile existing reports and session observations;
they are not fresh independent test results.

| Order | Work / current state | Owner and next action | Exit / automatic successor |
| --- | --- | --- | --- |
| 1 | [DGM-110](specs/DGM-110.md): AUTOMATED COMPLETE, verified 2026-10-14 | Independent [report](verification/DGM-110.md) records 458 tests, typecheck, build and browser gates with current coverage boundaries. Manual/native items remain separate. | No open source defect; do not requeue without new evidence. Continue 3. |
| 2 | DGM-110 repairs: CONDITIONAL on verifier findings | Scoped implementer fixes the named failing behavior or adds missing direct acceptance coverage in the existing spec allowlist, with RED/GREEN evidence. Verifier does not repair. | Automatically return to 1 for affected rechecks. Keep prior valid gates when inputs are unchanged; no PO prompt for an in-contract repair. |
| 3 | [DGM-116](specs/DGM-116.md): AUTOMATED COMPLETE, verified 2026-10-14 | Independent [report](verification/DGM-116.md) records 3/3 current generator tests, source/dist byte provenance and coverage limits. | No open asset defect; do not requeue without new evidence. Continue 4. |
| 4 | Sprint 4 local integration and documentation: VERIFYING | Orchestrator reuses [DGM-109](verification/DGM-109.md), [DGM-111](verification/DGM-111.md), DGM-110/116 evidence and the completed [DGM-112 investigation](specs/DGM-112.md). Verifier runs the single missing final source gate, then updates the manual only for observed drift and writes `docs/verification/sprint-4-review.md`. | Local work is AUTOMATED COMPLETE only when executable criteria have evidence. Publish the recap with unresolved human/platform checks; proceed to 5 without asking to close the review. |
| 5 | DGM-113 readiness packet: READY for documentation only | Orchestrator expands the [existing qualification card](specs/DGM-100.md#dgm-113---qualify-supported-platforms) into `docs/specs/DGM-113.md`, using DGM-112's findings. Identify source/artifact provenance, existing runners, per-target prerequisites, owners and acceptance cases. Missing spec paperwork is the orchestrator's work, not a request for the PO to write it. | Deliver an executable handoff contract with explicit per-cell blockers. Current artifact approval, native device availability and support scope remain prerequisites to runtime qualification. Then 6. |
| 6 | Consolidated delivery: READY after all runnable rows | Orchestrator summarizes completed local work, exact evidence, unresolved defects and one combined list of genuine external decisions. | Stop with LOCAL QUEUE COMPLETE or BLOCKED, never a platform/release claim. Do not invent more features or repeatedly ask the same platform question. |

DGM-109 and DGM-111 already have independent reports; they are not new
implementation tasks. DGM-112's desk investigation is complete, not an invitation
to repeat it. DGM-116 is approved Sprint 4 work, not a new sprint by itself.
Historical packaged executables do not represent current source features.

## Autonomous Defaults

- "Next", "continue" and "finish" resume the first runnable queue action. A status/question-only request is answered without starting unrelated work. Never ask whether to run the next already-required test, dispatch the verifier, fix an in-scope defect or update factual docs.
- The orchestrator owns task breakdown, missing task documents, evidence reconciliation and dispatch. It may clarify routine implementation details within the accepted behavior; changing a frozen behavior or public contract still needs approval. Implementers do not rewrite acceptance criteria.
- Keep implementation and independent verification separate. Dispatch available agents by explicit role and file allowlist; do not infer a model identity from its label. If preferred models are unavailable, use available agents with the same role boundaries. If no separate verifier can run, record that specific evidence gap without claiming self-verification is independent.
- Serialize shared files and terminal/browser gates. Parallel work is permitted only for disjoint ownership. Preserve unrelated dirty changes, historical evidence, existing user profiles and the server on port 5207.
- Routine defaults include fixture hit-testing, isolated test data, existing helpers, focused test selection, internal names, deterministic retries after a concrete repair, and documentation updates. Do not replace a failing oracle with one that merely passes or modify application hit-testing to manufacture reachability evidence.
- A verifier failure routes directly to the responsible implementer with the assertion, repro and contract; the repaired slice returns to the verifier automatically. Do not rerun unchanged failures hoping for green. Allow at most three repair-and-recheck cycles per defect. Persist the defect ID, attempt count, changes and result in the linked report; a handoff or new agent never resets the count. After the third failed cycle, mark the affected queue item BLOCKED with diagnostics and the precise unblock action, then continue independent rows. Reopening requires new evidence or an explicit PO direction, not another "next".
- A missing device, human participant, signing credential or approval blocks only the affected qualification/release cell. Record the blocker, owner, required input and unblock action once. Continue independent local work. Deferred or blocked is never PASS, and it must remain visible in the final handoff.

## Evidence and Resume Rules

For each gate, retain command, start/end time, exit code, totals, input/build
identity and artifact paths in a fresh timestamped directory under
`app/test-results/`. Preserve failures too. A timeout, partial progress display,
unretrievable terminal or stale report is not a pass. Never claim a historical
RED result that was not observed and retained.

Run one-shot gates synchronously to completion using the available tool's
completion handling. If execution must be handed back, record the exact active
terminal ID and log path; resume that run, not a duplicate. Do not poll or sleep.
Persist evidence from the first run so lost terminal output does not force
another multi-minute test solely to recover totals.

DGM-110's independent source gate, from `app`:
`./node_modules/.bin/vitest.cmd run --maxWorkers=1 src/editor/interactions.test.ts src/editor/Editor.test.tsx src/document/commands.test.ts src/app/session.test.ts`.
Then run `npm run typecheck`, `npm run build`, and `npm run test:browser` serially.
The browser runner uses `dist`: build after source/public changes, or prove the
existing build matches unchanged inputs. A runner-only change does not require
another identical production build. Preserve per-assertion coverage limits;
passing a generic browser scenario cannot prove all frozen DGM-110 cases.

DGM-116 uses `node --test scripts/generate-brand.test.mjs`, with current preview
assets and visual inspection. Reuse valid generator evidence; run
`npm run test:generators` when the asset slice changes. For local integration,
reuse unchanged gates and run the existing full source gate
`npm test -- --maxWorkers=1` once for the final candidate. Do not add repeated
full-suite runs merely for reassurance or claim this document edit ran tests.

Before yielding, each active queue row must have: state, owner, completed
evidence, exact next action and any blocker. Use READY, RUNNING, OWNER GREEN,
VERIFYING, AUTOMATED COMPLETE or BLOCKED. After success, update state and continue
in the same task. On resume, read the queue and linked report first; do not
reconstruct the plan from old chat status messages or old approval paragraphs.

## Genuine Approval Gates

Ask only when required to change product scope/frozen acceptance, public APIs or
schemas, add dependencies/major upgrades, affect security/auth/permissions,
migrate/delete user data, incur cost, change infrastructure/CI, or perform
irreversible/external actions. Current packaging/rebuilding, signing,
publication/deployment, branch/commit/push and platform support promises still
require explicit authorization. These are not authorized by "next" or by this
workflow revision. Escalate an affected slice, not the whole queue.

Human Teams/Office/novice tests, native zoom/touch, native x64/Mac qualification,
native download cancellation and current packaged GUI checks remain unresolved
where evidence is absent. They gate the corresponding acceptance/support/release
claims, not unrelated approved local implementation. The PO retains final
product/release acceptance.

## Historical Record

Everything below records the decisions and evidence available at its date.
Past "hard stop", "proposed" and "current" statements are historical, not the
live execution cursor. Use the queue above for routing; retain earlier reports
and technical contracts for their evidence and behavioral requirements.

2026-10-09 snapshot: V1 IMPLEMENTED; AUTOMATED VERIFICATION PASSED; PO/MANUAL REVIEW PENDING.

## Epic DGM-E01

Outcome: create/export a clear architecture diagram quickly in a local browser editor.
Source of truth: [DGM-MVP spec](specs/DGM-MVP.md). Architecture proposal: [RFD 001](rfd/001-editor-foundation.md). Research: [tool comparison](research/diagram-tools.md).

Success metrics: eight-component usability scenario <=5 minutes; fixture exports unclipped and self-contained; reliable local/JSON recovery; <=100ms p95 edits and <=2s layout on the agreed stress fixture. These are approved but unverified targets.

## Approval and sequencing

1. Product baseline/dependencies approved and DGM-000 spike completed; PO accepted the visible result and authorized V1 on 2026-10-09.
2. DGM-001 foundation accepted with frozen contracts, pinned stable tooling and 24 verified official assets.
3. DGM-010/020/030 implemented in parallel, DGM-040 integrated, and DGM-050 independently verified. Final Sprint 1 closure still requires PO/manual acceptance; no automatic continuation.

Sprint 0 goal: prove interactive layout/export compatibility and license feasibility.
Sprint 1 goal: complete one bounded add/connect/group/annotate/arrange/save/export workflow, with no backend.

Current outcome: production candidate under `app/` is live at http://127.0.0.1:5174/; unchanged spike remains on 5173. Independent gates: 257 tests, 13 integrated Edge checks, three foundation viewports, four editor cases, and production performance targets passed. [Verification](verification/DGM-050.md); [Sprint 1 review](verification/sprint-1-review.md). PowerPoint and novice-usability checks remain unverified.

PO-authorized refinement DGM-060 is implemented: seven icon-led groups, familiar first-four pins/alphabetical tails, Fabric under Azure, search-only long tail and source-dated retirement filtering without breaking old documents. Latest independent evidence supersedes numerical counts above: 4,899 tests, all 13 workflows and original performance gates pass. [Current catalog verification](verification/DGM-060.md). Prior V1 evidence remains historical; manual acceptance is still open.

## Work packages

| ID | Spec | Owner | Depends on | Exclusive implementation area | Verification responsibility |
| --- | --- | --- | --- | --- | --- |
| DGM-000 | [Spike](specs/DGM-MVP.md#dgm-000-browser-feasibility-spike) | Orchestrator, spike exception | PO approval | Isolated spike, not production modules | Go/no-go evidence and license/asset inventory |
| DGM-001 | [Foundation](specs/DGM-MVP.md#dgm-001-foundation-and-contract-freeze) | One Implementer | DGM-000 go decision | Root config, dependency lock, shared contracts, fixtures, icon manifest | Contract/schema and blank app smoke tests |
| DGM-010 | [Document](specs/DGM-MVP.md#dgm-010-document-history-and-persistence) | Implementer A | DGM-001 | Document/persistence modules and their tests | Domain, history, import, autosave and tab lock |
| DGM-020 | [Editor](specs/DGM-MVP.md#dgm-020-canvas-sidebar-and-inspector) | Implementer B | DGM-001 | Editor modules and scoped styles/tests | Canvas/sidebar/inspector and responsive behavior |
| DGM-030 | [Output](specs/DGM-MVP.md#dgm-030-layout-scene-and-output) | Implementer C | DGM-001 | Layout/render/export modules and their tests | Geometry/layout/export quality |
| DGM-040 | [Integration](specs/DGM-MVP.md#dgm-040-integration-and-mvp-completion) | One Implementer integrator | DGM-010/020/030 | App wiring, app-wide styles and end-to-end tests | Integrated production workflow |
| DGM-050 | [Verification](specs/DGM-MVP.md#dgm-050-independent-sprint-verification) | Independent Verifier | DGM-040 | Evidence/report/docs only | Every AC, visual checks, metrics and PO usability |

Individual task-spec files are created from these approved packages before dispatch. Each must retain context, interfaces, given/when/then cases, exclusions, risks and definition of done. Do not begin from an informal agent summary.

## Delegation protocol

- Orchestrator tier owns specs, RFDs, task contracts, routing, review and decisions; does not implement production code. Models/agents follow the PO's Opus/Sol orchestrator, Opus/Terra implementer and Luna/Haiku verifier policy. Availability must be checked; no model identity or specialist agent is assumed from a label.
- At most three implementers run concurrently: A document, B editor, C output. They start only after shared contracts and fixtures are frozen. They use deterministic fakes at module boundaries until counterparts are ready.
- In the shared worktree, ownership is disjoint. A second agent does not edit another owner's files, root config, shared contracts, icon manifest or app-wide CSS. Root changes go back to the foundation/integrator owner. No simultaneous package installation or lockfile edits.
- Each dispatch includes exact task-spec link, approved baseline, file allowlist, interfaces, AC responsibility, test command, forbidden scope and required report. Agent retries receive the same contract and a concrete defect, not an invitation to redesign.
- Implementers write a failing acceptance test, confirm the right failure, implement the simplest passing behavior and refactor under green tests. Tests use `should_<outcome>_when_<condition>` naming. Report red/green evidence; never delete/weaken tests to meet a gate.
- Cross-module contract changes, missing licenses, security/data-integrity concerns and unclear criteria are escalated to the orchestrator/PO. Agents stop that slice; unrelated approved work may continue.
- After a slice completes, the orchestrator reviews contract adherence and evidence. Integration starts only when all three slices are accepted. Repair tasks go to the owning implementer, not the verifier.
- Verifier runs tests, checks all criteria, updates docs to observed reality and reports defects. It never fixes code or approves deviations.
- No commits or branches are created by this planning turn. Implementation branch/worktree/commit operations require explicit authorization and must follow the PO's naming/Conventional Commit rules.

## Dispatch template

```text
Role/tier: [approved role and available agent/model]
Task: [ID and exact individual spec path]
Baseline: [PO-approved spec/RFD version]
Allowed files: [exclusive slice]
Inputs/outputs: [frozen contract names and fixtures]
Acceptance: [owned AC portions and given/when/then cases]
Procedure: confirm red test, implement, confirm green, refactor
Validation: [foundation-defined focused command]
Forbidden: spec/contract edits, dependencies, others' files, unrelated cleanup
Escalation: stop and report ambiguity/security/data integrity/license issues
Report: Status; Changes; Evidence; Docs updated; Open issues/decisions
```

Production dispatches follow the individual task contracts below. The orchestration agent handles specifications and review; implementers own code; the independent verifier reports results without fixing code.

Completed dispatches: one foundation implementer; three parallel feature implementers; one integrator; separate independent verifier. Verification found a nested-annotation layout guard mismatch and stale foundation oracle; owners repaired both with confirmed red regressions and the verifier rechecked them. No agent changed a failing acceptance threshold or installed an unapproved runtime dependency.

## Verification and review

Foundation defines the actual runnable scripts; expected gates are focused unit/component tests, typecheck, build and Playwright end-to-end tests. Do not report these as run during planning.

DGM-050 publishes an AC-01 through AC-13 matrix, command output, screenshots at the three specified viewports, actual exported artifacts, performance measurements and manual PowerPoint/usability observations. Manual checks require the PO; absent evidence means unverified, not passed.

Sprint review: recap outcome/evidence; identify root causes and workflow issues; annotate [lessons](lessons.md); adjust conventions/decisions; agree next priorities. Log changes in [decisions](decisions.md). Hard stop until PO closes review.

## Deferred backlog

Only after accepted MVP and a new scope decision: offline/PWA; AWS/GCP libraries; freehand; partial/pinned layouts; reusable templates; collaboration/cloud saving; AI generation. This is not an ordered or authorized next sprint.

## Proposed Next Work: DGM-E02

2026-10-10: the PO requested a UI/UX review and organized upgrade proposal for quick, low-effort diagramming and customer/Teams use. This authorizes review/planning, not implementation or closure of outstanding acceptance checks.

The [evidence-based review](research/ui-ux-review-2026-10-10.md) identifies a reproduced legacy-order defect, excessive long-header layout padding, limited meeting framing, search alias gaps and image-handoff/platform qualification needs. Four repeated sample layouts were stable; do not describe every repeated layout as still broken.

The [DGM-100 work plan](specs/DGM-100.md) organizes DGM-101 through DGM-115 with dependencies, owners, acceptance cases, exclusions, risk gates and proposed success measures:

- Sprint 2 proposal: predictable stacking, content-sized layout, readable workspace and guarded Present mode.
- Sprint 3 proposal: custom diagram backgrounds, configurable grid/snapping, meeting/slide image handoff, service search, contextual add/connect and direct editing. Review capacity and split before dispatch.
- Sprint 4 proposal: starter diagrams, local alignment, save/transfer clarity and platform qualification.
- Preflight decision: explicitly choose the supported desktop/browser/touch and offline delivery matrix before promising everywhere support.

2026-10-10: the PO approved execution of Sprint 2, DGM-101 through DGM-104. Task contracts are frozen under [DGM-101](specs/DGM-101.md), [DGM-102](specs/DGM-102.md), [DGM-103](specs/DGM-103.md) and [DGM-104](specs/DGM-104.md). Current status: IMPLEMENTED; INDEPENDENT AUTOMATED VERIFICATION PASSED; PO/MANUAL REVIEW PENDING. Sprints 3/4 remain PROPOSED. Existing manual acceptance checks remain unverified, not waived or passed. Existing MVP/catalog evidence above is historical and not a qualification of current unpublished changes or every desktop artifact.

Final [Sprint 2 review](verification/sprint-2-review.md): 5,221 source tests, 20 native generator checks and all 16 production-browser scenarios pass. Desktop policy checks retain their earlier 27/27 result, not a new packaged GUI run. The original 100-entity/150-connection production fixture passed edit p95 49.9ms and maximum layout 483ms. Boundary verification includes 132 real worker layouts. Five reported UI defects were repaired by owners and rechecked; failed-candidate evidence remains in the report. [Manual](manual.md) describes source-candidate controls, not a republished executable.

Hard stop: await PO-led sprint review. Actual Teams recipient readability, Office insertion, uncoached novice use, native Mac, native browser 200% zoom/physical touch and current packaged GUI remain unverified. No Sprint 3, release publication or desktop rebuilding was started.

2026-10-11: PO requested adding custom background colors and grid/snapping to the plan. [DGM-114](specs/DGM-100.md#dgm-114---custom-diagram-background) covers a saved solid background shared by editor, Present and opaque exports, with transparency remaining an output override. [DGM-115](specs/DGM-100.md#dgm-115---grid-and-snap-controls) adds independent grid/snap toggles, shared spacing/origin, dots/lines, and opt-in grid inclusion in Present/exports. These are accepted planning additions; implementation and the next sprint still await authorization. Sprint 2 evidence and its historical white-default behavior are unchanged.

Subsequent authorization, 2026-10-11: PO said "after this then implement next sprint". Plan amendment validated; Sprint 3 IN PROGRESS under DGM-114/115/106/107/105/108 task contracts. Shared-file implementation is sequential; catalog-only ranking may run in parallel. Existing manual checks remain unverified, not waived or passed. Stop at Sprint 3 review; no Sprint 4, release rebuild or publication is inferred.

2026-10-11 completion: Sprint 3 IMPLEMENTED; INDEPENDENT AUTOMATED VERIFICATION PASSED; PO REVIEW OPEN. [Sprint 3 review](verification/sprint-3-review.md) records 5,431 source tests across 36 files, typecheck/build, 20 generator checks and a fresh 51/51 production-browser matrix. Original 100-entity/150-edge performance passes unchanged gates: edit p95 51.7ms, maximum layout 734.2ms. Owners repaired camera readiness and scaled physical-target selection in test harnesses without weakening assertions; earlier failures and a confirmed standby-interrupted run remain evidence, not passes. [Manual](manual.md) now describes the actual background/grid, contextual insertion, inline editing, command menu and export controls. Hard stop for PO-led review: Teams/Office, uncoached novice timing, native Mac, physical 200% zoom/touch and current packaged GUI remain unverified. No Sprint 4, desktop rebuild, release, commit or publication was started.

2026-10-11 subsequent PO disposition: "approved go" permits bounded Sprint 4 continuation with all prior manual gates still unverified. Sprint 4 IN PROGRESS: [DGM-111](specs/DGM-111.md) copy-only save clarity, [DGM-109](specs/DGM-109.md) bundled starters and [DGM-110](specs/DGM-110.md) same-parent alignment execute sequentially; [DGM-112](specs/DGM-112.md) is desk investigation only. Approved contracts retain local storage and validation limits. Native download cancellation remains deferred, not claimed solved. DGM-113, platform support promises, desktop rebuilding, signing, CI, new dependencies, commits and publication are excluded. Independent verification and a new PO-review stop end Sprint 4.