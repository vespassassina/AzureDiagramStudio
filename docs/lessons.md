# Sprint Lessons

The PO accepted Sprint 0 and authorized V1 on 2026-10-09. The verified observations below are adopted for Sprint 1; the visual language and explicit-layout behavior are retained.

Every agent must read this document before starting a sprint. At each PO-led review, append the date, sprint, root cause, adopted solution and task/decision link. Record agent-workflow issues as well as product/engineering issues. Do not present planning assumptions as verified lessons.

## 2026-10-09: Sprint 0 / DGM-000 Observations

Evidence: [spike report](verification/DGM-000.md).

- Retain measurements in controlled React Flow nodes. Rebuilding derived objects without metadata caused drag initialization failures; canonical explicit dimensions now preserve them.
- Use ELK's documented worker transport. The wrapper failed in-browser despite passing Node tests; workerFactory with the official worker works.
- ELK edge coordinates can be container-relative even when root-listed. Translate using container origins and assert endpoints in both directions. A screenshot caught the initial gap; it is now covered by unit/browser tests.
- Exact geometry checks compare transform/size, not selection z-order or camera, which intentionally sit outside history.
- Capture actual output with a real browser when integrated-browser download events are unavailable. Local Edge provided repeatable file/pixel evidence.
- Keep the spike isolated and stop at PO review. Passing feasibility checks do not authorize production work or prove full-MVP acceptance.

## 2026-10-09: Sprint 1 Technical Observations

Evidence: [independent verification](verification/DGM-050.md), [review](verification/sprint-1-review.md). PO-led acceptance review remains pending.

- Freeze contracts before parallel dispatch and keep owners disjoint. Source edits stayed with implementers; the verifier reported defects and made no repairs.
- A coordinate invariant must be expressed at the correct level. Layout preserves annotations in canvas coordinates even when parent-relative values change; guard absolute positions within a tight numeric tolerance while still protecting size/content/membership. Add compute/apply/UI regressions, not only isolated module tests.
- Prototype status text is not a durable verification oracle. Assert real geometry changes, preserved semantics, valid route revisions and exact undo; keep old failures as evidence rather than silently dropping a gate.
- Performance needs a production browser measurement. A 137ms edit p95 failed despite green Node timings. Memoize only measured repeated work and use complete comparisons; retain the same stress data and thresholds when verifying repairs.
- Quality fixtures must fit their measured text. Fix overlapping fixture coordinates/bounds without truncating long text or changing the stress fixture. Screenshots found a failure broad pixel counts missed.
- Official glyph filenames can be misleading. Confirm product identity from official labelled diagrams and retain actual file hashes/terms; use the separate official Entra collection where appropriate.
- Automated candidate readiness does not establish Office fidelity or novice usability. Record those checks as unverified and stop for PO review; do not start another sprint automatically.

## 2026-10-09: DGM-060 Catalog Refinement Observations

Evidence: [DGM-060](verification/DGM-060.md).

- Separate exhaustive asset provenance from presentation. An official icon archive contains duplicates, variants, interface glyphs and historical services; it is not a current product menu. Preserve old keys while curating new browsing/search.
- Use explicit lifecycle rules with dated sources, not broad words such as Cache or ML. Future retirement/deprecation is not present retirement. Record unknown dates and source gaps rather than inventing facts.
- Prioritize familiar choices editorially and label that assumption accurately. Four pins plus alphabetical tails and a small number of icon-led groups make the common workflow scannable; search holds the long tail.
- A mobile pixel test must not place probe nodes on top of one another. Correct deterministic fixture geometry while retaining per-icon ink assertions, rather than weakening export checks.
- Large asset inventories can trigger thousands of module reloads in isolated tests. A hash-deduplicated verified registry removes module fan-out without altering glyph bytes, and test setup must finish fresh imports before clearing spies.
- Do not accept a narrowly failed performance gate or retry for a favorable sample. Profiling isolated repeated descriptor/UTF-8 traversal; bounded encoding and eliminating redundant validation reduced costs while retaining security, Unicode, mutable-input and atomic rejection tests. The verifier reran the unchanged production gate once after the repair.