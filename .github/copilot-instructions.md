# Diagrammer Agent Workflow

This is a repository-specific PO workflow update, authorized on 2026-10-14.
Read [the current execution queue](../docs/roadmap.md#execution-queue) and
[lessons](../docs/lessons.md) before choosing work. The current roadmap policy
supersedes older per-task approval and mandatory sprint-review continuation
stops for this repository only. Technical acceptance and safety gates remain.

The PO's 2026-11-05 delivery-cadence update supersedes earlier TDD and
per-feature verification sequencing: plan first, complete the whole approved
sprint implementation, then run consolidated tests and independent
verification. Keep one implementer through repairs, reuse unchanged passing
evidence, and prioritize finished usable features followed by compile/run.
Do not resume historical per-feature verification cursors before the sprint
implementation is complete. Safety and public-contract gates still apply.

- Continue approved queue work through implementation, verification, in-scope
  repair and factual documentation without asking for permission at each step.
- Treat "next" as resume, not a new scope request. Never redo completed features
  to fill time, invent a sprint, or ask the PO to write missing task paperwork.
- Keep orchestrator, implementer and independent verifier responsibilities
  separate; use available agents without claiming unavailable model identities.
- Record blockers per task/platform cell and continue independent ready work.
  Batch genuine PO decisions at the final handoff; do not call missing hardware
  a pass or relax a test to close an item.
- Preserve logs, failures and input/build provenance from the first run. Keep
  shared-file and terminal work serial. Update queue state and the exact next
  action before yielding so another agent resumes instead of restarting.
- Do not change user-global instructions, production scope, dependencies,
  security, public contracts, data, packaging or external/release state under
  this workflow authority. See the roadmap's genuine approval gates.