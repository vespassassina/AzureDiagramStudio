# Sprint 1 Review: Diagrammer V1

Date: 2026-10-09. Status: READY FOR PO REVIEW; NOT CLOSED.
Baseline: [DGM-MVP](../specs/DGM-MVP.md). Independent evidence: [DGM-050](DGM-050.md).

## Recap

Goal: one focused local architecture-editor workflow with beautiful output and no backend. V1 is live at http://127.0.0.1:5174/. The original spike remains untouched on 5173.

DGM-001 foundation, DGM-010 document/storage, DGM-020 visual tools, DGM-030 layout/output, DGM-040 integration and DGM-050 automated verification are complete. None was dropped. Manual PowerPoint and novice-usability evidence carry over as acceptance work, not a new implementation sprint.

Delivered: 24 official Azure and 12 generic components; structured connectors and edge insertion; grouping/reparenting; clipboard/nudge; undo/redo; text/rectangles/layers; explicit RIGHT/DOWN layout; title/subtitle/status/legend; local autosave and recovery; single-writer tab ownership; versioned JSON Open/Save; skill import; self-contained SVG/PNG at 1x/2x and transparent/white backgrounds.

## Verification

- 257 tests in 16 files pass; build and strict typecheck pass. Configured lint is TypeScript semantic hygiene, not a separate style-analysis claim.
- Independent real Edge: 13 integrated workflows, three foundation viewports and four editor cases pass. Production report records no browser errors, warnings or failed resources.
- Production 100-entity/150-edge fixture: edit p95 82.4ms across 20 edits; maximum layout 1118.9ms across ten layouts. Original <=100ms/<=2000ms thresholds and stress graph were retained.
- Desktop/mobile screenshots and actual SVG/PNG inspected. Nested annotation DOM geometry, scene coordinates and downloaded JSON agree after arrangement and undo; negative coordinates do not clamp unexpectedly.
- Acceptance matrix: 11 PASS, 0 FAIL, AC-10 Office insertion and AC-13 timed novice session UNVERIFIED overall. Do not call the whole sprint accepted before those checks.

## Learn

Parallel ownership worked after contracts were frozen. Integration and an independent verifier were both necessary: passing local layout/domain tests separately missed their annotation coordinate-rebase contract. The verifier did not fix code; the owning implementer added a red cross-module regression and repaired the guard, and integration added real UI cases. A stale prototype status-message oracle was replaced with stronger geometry/current-route/exact-undo assertions.

Initial production edit p95 was 137ms, failing the real gate despite fast Node-only tests. Measured editor/renderer work was reduced through document-identity scene caching, field-complete tile/link memoization, stable callbacks and a bounded verified-glyph cache. Thresholds were not relaxed. Long-label fixture geometry was corrected without changing stress data or removing text/content coverage.

Asset filename alone did not establish service identity. Container Apps was confirmed against an official Microsoft-labelled diagram; Entra ID came from its official separate archive. Neither missing asset was replaced with an unverified neighboring glyph.

## Residual Risks

Large bundle and mixed static/dynamic ELK import warnings remain. No offline-install, cloud synchronization, exhaustive security or full mobile-productivity claim. One ResizeObserver notification appeared in the dev harness, not the clean production report. Browser storage is origin-local and not a portable backup; users must download JSON for transfer/backup.

## PO Actions

1. Try V1 and inspect SVG/PNG output in PowerPoint, including long text, icons, boundaries and legends.
2. Observe an unfamiliar developer recreate the eight-component, two-boundary, eight-connection three-tier reference and export a usable SVG within five minutes without coaching.
3. Review outcome, recorded lessons and any usability changes; accept the sprint or list scoped corrections.

No next sprint starts until the PO closes this review. Deferred features remain unauthorised.