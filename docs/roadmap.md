# Diagrammer Roadmap and Delegation Plan

Date: 2026-10-09. Status: V1 IMPLEMENTED; AUTOMATED VERIFICATION PASSED; PO/MANUAL REVIEW PENDING.

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