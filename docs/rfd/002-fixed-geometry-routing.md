# RFD 002: Fixed-Geometry Connection Routing

Date: 2026-10-28. Status: APPROVED BY PRODUCT OWNER.
Related task: [DGM-142](../specs/DGM-142.md).

## Problem

Strict node/group placement passes exact alignment checks, but the compound
ELK routing/proxy constraints create enormous connection excursions and reserved
header crossings on the actual Fabric starter. Three bounded reserve/seed/proxy
experiments failed. See the [retained investigation](../verification/DGM-142.md)
for raw engine sections, measurements, failed candidates and the quality RED.
Moving aligned nodes, relaxing explicit ports or hiding edges is not acceptable.

## Options

1. Keep real ELK placement and add an obstacle-aware orthogonal routing stage
   over fixed final geometry. Routing can optimize paths without asking the
   placement constraints to accommodate dummy tracks.
2. Redesign the ELK-only crossing/corridor protocol. This requires a bounded
   feasibility spike; previous simple constraint changes did not establish it.
3. Keep the current loops or relax alignment/port/quality checks. Rejected.

## Decision And Authority

The PO selected "Approve a separate routing stage; preserve the aligned layout
(Recommended)" after being told it would retain ELK placement and add no
dependencies. Implement option 1, source-only, under DGM-142's quality and
preservation gates. This explicitly supersedes its earlier ELK-only routing
restriction, not its real-ELK placement or strict geometry invariants.

## Design Boundaries

- Preserve the final accepted ELK node/group geometry and hierarchy. Do not
  redesign placement or collapse gaps as part of this routing task.
- Build one deterministic pure routing stage shared by standard and stacked
  Auto-arrange output. Use actual absolute component/boundary geometry,
  ancestor membership, full-width header bands, endpoint sides and measured
  label dimensions.
- Route with cardinal endpoint stubs, orthogonal obstacle-aware corridors and
  a bounded shortest-path search. Prefer short paths, fewer bends and separated
  parallel channels. Honor explicit ports and existing arrows; choose automatic
  sides using the actual peer geometry.
- Use a finite, input-derived visibility/channel graph and deterministic
  tie-breaking. Bound graph/work/coordinate growth and keep it inside the
  existing cancellable layout-worker lifecycle. Do not freeze the renderer
  with an unbounded combinatorial search.
- The verified implementation uses one disposable native job worker for both
  pinned bundled ELK placement and routing. A construction-only compatibility
  adapter selects ELK0.12.0's embedded transport and restores the exact global
  descriptor before queued work; do not extend it to renderer/shared globals.
  Revalidate dispatcher/descriptor restoration and actual native teardown on
  any future engine/runtime upgrade. See the cycle2 independent report.
- Avoid unrelated component interiors and reserved group headers; source/target
  ancestor boundaries may be crossed where necessary. Handle nested, boundary
  endpoints, self/back/cyclic/parallel and disconnected cases explicitly.
- Normalize duplicate/collinear points; place labels along the final route with
  obstacle-aware positioning. Audit final route geometry before returning it.
  Do not silently drop a connection, reuse an invalid old route or return
  success with missing labels/ports because the search failed.
- A route failure fails the layout through existing explicit error handling,
  before any partial session/history/autosave commit. No mutable second model,
  new schema, external service, dependency or generic filesystem/network API.

## Acceptance And Consequences

Preserve DGM-142's pre-GREEN Fabric bounds, strict stacking and old regression
assertions. Add real-router tests for obstacles/headers, cardinal endpoints,
nested groups, cycles/back/parallel cases, label geometry and deterministic
bounded work, not only mocked path calls. The actual four-mode UI/HTTP/
SVG/PNG/MCP snapshot outputs and before/after visual inspection must agree.
Measure worst supported fixture time/work and retain first failures/provenance.

The trade-off is ownership of a small routing stage and its geometry tests;
it avoids new dependencies and removes the ELK placement/routing-constraint
coupling. Independent verification is required before promotion or a fresh
manual preview. No published/release artifact changes are authorized.
