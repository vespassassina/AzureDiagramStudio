# Repository Agent Guidance

## Delivery Cadence

The PO updated the process on 2026-11-05. This supersedes test-first and
per-feature verification instructions for the current work.

- Plan the complete approved sprint scope and acceptance cases first.
- Keep one implementer on the sprint's useful features through implementation
  and repairs. Complete the whole sprint implementation before running tests,
  builds used for validation, browser checks, or independent verification.
- Then run one consolidated, risk-focused validation phase. Return confirmed
  defects to the owning implementer and recheck affected behavior; do not
  restart discovery or repeat unchanged passing checks.
- Deliver usable features, then compile and run the completed application.
  Do not replace delivery with repeated diagnostics, status reports, or
  per-feature documentation and artifact sweeps.
- Preserve first failures and sufficient input provenance. Record interim
  evidence once; consolidate routine documentation at milestone completion.
- Keep scope, contract, dependency, data, security and release safety gates.
  Report genuine blockers without stopping independent approved work or
  claiming unverified behavior is accepted.

## UI Design

For UI changes, read and follow [the approved UI design convention](docs/ui-design.md).
Give each function one clear home, place controls beside what they affect,
and reserve space for the actual work. Separate application controls, editing
tools and content; group related choices, use explicit predictable state, and
persist meaningful preferences with honest failure feedback.

Preserve accessibility, responsive behavior, drafts and safety guards.
This convention does not authorize unrelated redesign or expand task scope.
