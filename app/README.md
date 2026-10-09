# Diagrammer V1 Candidate

Date: 2026-10-09. Status: implementation and independent automated verification complete; PO/manual acceptance pending. Live production preview: http://127.0.0.1:5174/. The original spike remains unchanged on port 5173.

## Current V1

Local browser autosave and recovery, versioned JSON Open/Save, skill import with warnings, single-writer tab ownership, compact Azure/Fabric service menus and 12 generic components, structured connectors, grouping/reparenting, edge insertion, clipboard/nudge, undo/redo, annotations/layers, explicit worker Auto-arrange and self-contained SVG/PNG. Browser autosave is not a portable backup: use Save JSON before transferring or clearing browser data.

The Azure tab has seven icon-led groups and 66 top menu services. Each group's first four are curated familiar/common choices, followed by an alphabetical tail; this is an editorial default, not a measured worldwide popularity ranking. Microsoft Fabric is nested under Azure, with OneLake, Lakehouse, Warehouse and Data pipeline first. Search reaches the remaining policy-current services/components, including 46 canonical Fabric families instead of thousands of icon variants. Software remains separate.

Retirement cleanup excludes 32 historical/deprecated/PO-requested entries from new choices, including Bonsai, while every previous key remains valid for saved diagrams. Effective service-end dates are distinguished from future announcements. See [lifecycle sources and limits](src/catalog/lifecycle-sources.md): Bonsai's precise date and Datamart's primary retirement notice remain unverified. The raw published collections retain 714 Azure archive entries, a separate Entra ID glyph, and 1,584 Fabric variants with full provenance; these are not asserted to be distinct current services or every future SKU.

From `app/`:

```powershell
npm ci
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 5174 --strictPort
```

For source development use `npm run dev` on another free port. Production preview serves the built files; rebuild after source edits.

Current gates: 4,899 Vitest tests; strict typecheck/build/configured lint; foundation and catalog checks at three viewports; 13 integrated Edge checks; four editor harness cases. `npm run lint` is TypeScript semantic hygiene, not a separate style linter. Independent production stress measured p95 39.7ms for 20 edits and maximum 733.4ms across ten layouts on the unchanged 100-entity/150-edge fixture. Bundle-size/dynamic-import warnings remain documented.

```powershell
npm run typecheck
npm run lint
npm run test:browser
$env:DGM_V1_URL = 'http://127.0.0.1:5174/'
node scripts/verify-v1.mjs
node scripts/verify-catalog.mjs
node src/editor/verify-browser.mjs
```

Verification: [current catalog/menu report](../docs/verification/DGM-060.md), [historical V1 report](../docs/verification/DGM-050.md), [browser results](test-results/v1/browser-report.json), [catalog results](test-results/catalog/browser-report.json), [performance](test-results/v1/performance.json), [sprint review](../docs/verification/sprint-1-review.md). PowerPoint SVG/PNG insertion and the PO-observed uncoached five-minute usability task remain unverified; no final PO acceptance is asserted. No backend, auth, AI, deployment or offline installation is included.

## Historical Foundation Record

The remaining sections preserve DGM-001's handoff evidence and contract rationale. Their 25-test baseline and temporary-editor descriptions are historical, superseded by the current V1 above and independent report. Foundation was accepted before parallel dispatch; its original asset blocker is resolved.

## Commands and Verification

- `npm ci` installs the exact dependency lock.
- `npm test` runs Vitest, including the mandatory 24-official-asset gate. Current result: 25 pass / 0 fail across four files. The original exact-24 unit test is unchanged; no test is skipped or weakened.
- `npm test -- src/foundation.test.ts src/domain.test.ts src/layout.test.ts`: 23 pass, including every original assertion in the 15 spike tests.
- `npm run typecheck`: strict TypeScript build checking.
- `npm run lint`: TypeScript semantic hygiene (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, strict checking). This is not a separate style linter; no unapproved lint dependency was added.
- `npm run build`: TypeScript + Vite. Large React Flow/ELK chunk warnings remain visible; this is not performance certification.
- `npm run test:browser`: uses stable Playwright with installed Edge, checks the built baseline at 1440x900, 1280x720 and 390x844, local assets, nodes/edges, desktop ELK/undo, swatch dimensions and no page overflow/errors. All three viewports pass; the stale desktop palette expectation was strengthened from 22 to the approved 24. Creates `test-results/foundation/` screenshots. A test-only random-port server and browser are always closed. No persistent production server is started.
- `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort` is available for later authorized local use; it has not been started.

RED evidence: the initial two metadata tests failed because createDocument/schemaVersion were absent. GREEN: both pass after canonical metadata adoption. Three subsequent shared geometry/metadata/route tests went red then green; fixture construction went red then green. The browser's compressed swatches failed a size assertion, then passed after wrapping without shrinking. Asset tests initially failed at six icons and an inherited `toString` lookup; lookup was fixed. The unchanged exact-24 gate was reconfirmed red at 22, remained red at 23 after the official Entra ID addition, and went green at 24 after verifying the Container Apps service graphic. The browser's former 22-count assertion failed at 24 before its expectation was strengthened.

## Frozen Types and Semantics

Source of truth: [model](src/model.ts), [contracts](src/contracts.ts), [catalog](src/catalog.ts), [assets](src/assets.ts). The shared files require orchestrator coordination after foundation acceptance; following implementers do not change these contracts.

Diagram requires schemaVersion:1, id, title, subtitle, synthetic, legendVisible, legend, revision, direction, entities and connections. Parent-relative x/y and positive dimensions are retained. parentId accepts string/null/omitted on the type boundary; normalized roots are null. An omitted layer means foreground; canonical fixtures explicitly set it. Status remains unset unless explicitly supplied. Connections have sourceSide/targetSide (auto/top/right/bottom/left), routeRevision, labelPosition and optional absolute points. Only routes matching diagram.revision are consumed.

The full DocumentCommand union is in [contracts](src/contracts.ts). Concrete discriminants/property names:

| type | Payload |
| --- | --- |
| addEntity | entity |
| updateEntity | id, patch: label/subtitle/color/icon/status |
| remove | entityIds, connectionIds |
| move | positions: {id,x,y}[]; target coordinates are parent-relative |
| resize | id, width, height |
| connect | connection |
| updateConnection | id, patch: from/to/label/style/arrow/sourceSide/targetSide |
| insertOnConnection | connectionId, entity, upstreamId, downstreamId |
| reparent | ids, parentId: string or null |
| group | ids, boundary (Entity with kind:boundary) |
| ungroup | boundaryIds |
| paste | fragment, idMap (entity and internal connection IDs), offset:{x,y} |
| metadata | patch: title/subtitle/direction/synthetic/legendVisible/legend |
| order | ids, layer:foreground/background |
| applyLayout | expectedRevision, result:{diagram,revision} |

All IDs are supplied by the caller, including replacement connection IDs and paste mappings. No random IDs, clocks or side effects in domain commands. A command is one immutable transaction; successful mutation advances document revision once. ApplyLayout checks expectedRevision against the current document and result.revision, then stamps accepted routes at the committed revision. Layout computation retains the snapshot metadata/revision and never commits by itself. Clipboard capture retains descendants/internal connections, detaches excluded parents using absolute positions and records the minimum absolute origin. Paste offset is a delta applied to roots, not an instruction to subtract origin; included descendants keep parent-relative positions. Parent-plus-descendant group moves must not double-apply inherited motion. Edge insertion keeps the old label upstream and clears the downstream label, preserving line/arrow semantics.

Result<T> is `{ok:true,value:T,warnings?:string[]}` or `{ok:false,errors:{path,message}[]}`. DomainError is an Error interface with name:DomainError, a concrete DomainErrorCode union and field errors. DGM-010 supplies the runtime implementation and throws it on atomic-command failure; it is not returned as a successful document.

DocumentApi freezes `validateDocument(input:unknown):Result<Diagram>`, `parseDocument(text:string):Result<Diagram>`, `importSkillSpec(input:unknown):Result<Diagram>`, `applyCommand(document:Diagram,command:DocumentCommand):Diagram` (throws DomainError) and `captureSelection(document:Diagram,ids:string[]):ClipboardFragment`. No fake implementations exist here.

PersistenceApi freezes `createStorage():DocumentStorage`, with `load():Promise<Diagram|null>`, `save(document:Diagram):Promise<void>`, `close():void`, and `watchSessionLock(onWritableChange:(writable:boolean)=>void):()=>void`. The callback reports false while waiting, true only when owning the per-origin active-document Web Lock; the cleanup releases/cancels ownership. The integrator reloads the durable snapshot after acquisition. Unsupported locks fail closed; load/save failures reject with clear errors. DGM-010 owns implementation/testing.

EditorProps in [contracts](src/contracts.ts) freezes document, canUndo, canRedo, readOnly, saveState (loading/saving/saved/error/read-only), backupDirty, message, isArranging, isExporting and every callback: onCommand(command), onUndo(), onRedo(), onNew(), onOpen(), onImport(), onSaveJson(), onArrange(direction), onExport({format:svg/png,scale:1/2,transparent:boolean}), onPreviewChange(document:Diagram|null). Callbacks return void; the shell owns async work/errors. Preview is a local draft or null on completion/cancellation; every notification invalidates pending layout. The temporary copied editor still owns its baseline session history; DGM-020 replaces it with the frozen controlled interface, DGM-040 wires it.

Shared geometry: `wrapText(text:string,limit:number):string[]` preserves line breaks and splits long words; limits must be positive integers. `measureEntity(entity:Entity):{width:number,height:number}` returns deterministic minimum-safe growth without mutating input or shrinking explicit sizes. `entityTextGeometry(entity)` provides the same line breaks/insets/baselines to the renderer. DGM-010 applies growth to ancestor boundaries; DGM-030 owns full content-bound/fit parity.

Retained root APIs: [layout](src/layout.ts) exports LayoutResult, computeLayout(diagram,direction,revision,providedEngine?), applyLayoutIfCurrent(current,result,revision). [scene](src/scene.ts) exports Scene/SceneEntity/SceneConnection/Assets, buildScene(diagram), entityMarkup(entity,assets?), connectionMarkup(connection), renderSvg(scene,assets?,transparent?), pngDimensions(scene,scale), escapeXml, fallbackPoints, roundedPath and compatibility geometry/catalog re-exports. [export](src/export.ts) retains exportSvg(diagram,transparent?):Promise<string>, exportPng(diagram,scale,transparent?):Promise<Blob> and download(blob,filename):void. PNG cap remains 8192 per dimension / 16,777,216 pixels. Full quality/export certification remains DGM-030/040/050 work.

## Assets and Versions

The requested 24-entry service manifest, exact source filenames and reserved keys are in [catalog](src/catalog.ts). Available palette/asset lookup exposes 24 unchanged distinct official SVGs, not placeholders: 23 from Azure V24 and one from the official Entra collection. Azure source paths are relative to `Azure_Public_Service_Icons/Icons/`; the Entra source is the full archive-relative entry. Only the two previously null source fields changed; model/contracts/asset-loader APIs and the original asset/foundation tests are untouched. The 12 generic types are user, people, api, service, function, server, database, lake, queue, storage, model, shield. Semantic tokens reproduce the skill's azure/fabric/databricks/purview/m365/foundry/source values plus the spike's teal/amber/rose/gray. Hex accepts #RGB/#RRGGBB; untrusted style/path keys do not become SVG attributes or asset paths.

Archive: official Azure Public Service Icons V24, reused from `%TEMP%/diagrammer-azure-v24.zip`. SHA256: `921594CCD1BF3D9C0A1BD7B6D924E050551A59342F2B353BB74BDCF761C35141`. Source: https://learn.microsoft.com/en-us/azure/architecture/icons/ and https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip. Microsoft permits architecture diagrams/training/documentation only; no recoloring, distortion or product branding. Original archive terms retained at [Microsoft terms](public/licenses/Microsoft_Terms_of_Use.pdf).

Entra archive: official Microsoft Entra architecture icons, October 2023, downloaded on 2026-10-09 from https://download.microsoft.com/download/3/1/a/31a56038-856a-4489-88e4-ee5a1c4352be/Microsoft%20Entra%20architecture%20icons%20-%20Oct%202023.zip, as linked by https://learn.microsoft.com/en-us/entra/architecture/architecture-icons. ZIP SHA256: `4E07536706A2D092E6524E5417E2C861333FDBDB41C36F78D44DFA07CCC5EEDC`. The actual ID color SVG is used, not the product-family, governance or workload icon. Original archive [Entra terms](public/licenses/Microsoft_Entra_Terms_of_Use.docx) and [branding playbook](public/licenses/Microsoft_Entra_Branding_Playbook.pptx) are bundled unchanged. Their SHA256 values are `704AEDBBC3BD98B4C74506513A67FF51DE44E2CFF58B52F368EBF548CED7788F` and `8AC700B0588BC2415934B2AC3962909AE4C5392204E146FDB0A7FB0C927A71B6`. Permitted use is architectural diagrams, training materials or documentation; do not crop, flip, rotate, distort, use as Diagrammer branding or use in marketing communications.

| Reserved key / bundled asset | Exact official ZIP entry | SVG SHA256 |
| --- | --- | --- |
| [azure-container-apps.svg](src/assets/azure/azure-container-apps.svg) | `Azure_Public_Service_Icons/Icons/other/02884-icon-service-Worker-Container-App.svg` | `B53C7E6B7AF75B25C04231A7DFF85074F0C32CC1C306376350C0C8DF0CB64417` |
| [azure-entra.svg](src/assets/azure/azure-entra.svg) | `Microsoft Entra architecture icons - Oct 2023/Microsoft Entra color icons SVG/Microsoft Entra ID color icon.svg` | `EFD9F54562BFB78BF3C77AECDD5FC31B61FCE8A1CEC78C4370B41FC470E54EDA` |

Verification on 2026-10-09 imported the actual manifest and compared each bundled SVG's bytes and SHA256 with its exact entry in the appropriate official ZIP. All 24 are byte-identical, all 24 have valid XML SVG roots, and all 24 SHA256 values are distinct. No SVG was normalized, recolored or rewritten.

### Container Apps Service Identity

Microsoft's [Choose an Azure compute service](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/compute-decision-tree#architecture) flowchart explicitly labels the worker graphic **Azure Container Apps**, separately from Container Instances and AKS. It is the lower-right service endpoint reached by **No** to **Need access to all Kubernetes capabilities?** This is service-level evidence, not an environment substitution.

Direct official diagram: https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/images/compute-choices.svg. Downloaded SVG SHA256: `565DD5AFC1D84496F78D6B0516982779DD0DA2EF897AA238FC36B29BFD9BBF38`. Service label is `shape1075-517` (inside `group1106-514`); adjacent glyph is the embedded 56x56 PNG in `shape1116-637`. PNG SHA256: `DD0447A681B864BE338ED1BF712903701D60AC043D0340D9A1580843DBF2124A`.

The graphic was visually matched against the unchanged V24 worker SVG and compared by drawing both at 56x56 with Edge canvas: 2,176 of 3,136 pixels are identical, 3,038 are within 32/255 in every channel, and mean absolute RGBA channel difference is 3.147/255. This establishes a graphic match; it does not claim PNG/SVG byte identity. The [official service-label screenshot](test-results/foundation/container-apps-service-identity.png) is retained as test evidence, not shipped as a product asset. `02989-icon-service-Container-Apps-Environments.svg`, Container Instances and deprecated Container Services are not used. The initial microservices runtime diagram placed the worker glyph at an environment boundary and was not used as sufficient service-identity evidence.

The asset release gate has no remaining missing entry. This resolves only the DGM-001 asset blocker; it does not accept the foundation or authorize the next sprint/tasks.

| Package | Locked version |
| --- | --- |
| react / react-dom | 19.3.0 / 19.3.0 |
| @xyflow/react / elkjs / lucide-react | 12.12.0 / 0.12.0 / 1.49.0 |
| typescript / vite / @vitejs/plugin-react | 6.0.3 / 8.3.2 / 6.1.1 |
| vitest / @playwright/test | 5.0.3 / 1.63.0 |
| @testing-library/react / jsdom | 16.3.3 / 30.1.1 |
| @types/node / @types/react / @types/react-dom | 24.13.3 / 19.2.18 / 19.2.7 |

Playwright npm latest was `1.64.0-beta-1791301756000`; structured versions metadata identified 1.63.0 as the highest stable release. All direct versions are exact in [package.json](package.json), with transitive versions in [package-lock.json](package-lock.json). Runtime tested on Node 26.7.0 / npm 11.19.0 / Edge 155.0.4283.45. Installed-package audit found zero vulnerabilities; this is not a security review. Bundled IBM Plex Sans variable TTF and original OFL/license notices are retained unchanged. See [third-party notices](public/THIRD-PARTY-NOTICES.md).

## Fixtures and Dispatch Ownership

[fixtures](src/fixtures.ts) freezes blank-v1, three-tier-v1 (8 components/2 boundaries/8 connections), azure-integration-v1, nested-cross-links-v1, annotations-v1 and stress-v1 (100 entities/150 connections). All are explicitly synthetic with deterministic IDs, fresh results and canonical round-trip metadata. The copied sample has stable id sample-commerce. Test-only screenshots of the adopted sample are generated by the browser gate, not shipped in dist; no original spike evidence or browser scripts were copied.

| Following owner | Writable files after acceptance |
| --- | --- |
| A: DGM-010 | src/document/, src/persistence/, colocated tests |
| B: DGM-020 | src/editor/Editor.tsx, src/editor/editor.css, colocated tests |
| C: DGM-030 | src/scene.ts, src/layout.ts, src/export.ts, domain.test.ts/layout.test.ts rendering/geometry assertions; optional src/render/, src/layout/, src/export/ helpers |
| Integrator: DGM-040 | src/app/, root App.tsx/main.tsx, app-wide styles, scripts/e2e and integration tests |
| Shared, frozen | model.ts, contracts.ts, catalog.ts, assets.ts, fixtures.ts, foundation/asset contract tests, assets/licenses, root config/package lock |

Do not dispatch the next tasks until orchestration accepts this foundation and the asset blocker is resolved. Remaining risks include full long-text/font fitting, legends/content bounds, annotation ordering, full browser export parity, concurrency/storage/import security, worker/bundle performance, all MVP interactions and independent/manual verification. None is claimed complete by foundation smoke checks.