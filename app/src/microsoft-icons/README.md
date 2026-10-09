# DGM-090 Microsoft Asset Owner Handoff

Status: done within the isolated asset-owner scope. Research and verification date: 2026-10-09. No shared catalog, asset dispatcher, editor, scene, document contract, package, git, publication, or specification changes were made.

## Export Contract

- catalog.ts exports microsoftLibrary: MicrosoftItem[] and the MicrosoftItem/MicrosoftIconKey structural types. The list, items, provenance, category/entry arrays, aliases, and keywords are frozen at runtime. Every item has category 'Microsoft Apps' and catalog 'azure'. The registry does not depend on the shared IconKey union.
- assets.ts exports microsoftAssets: Record<string, string>, a frozen null-prototype allowlist. Every value is a self-contained base64 SVG data URL. The module has no DOM, network, upload, filesystem, or shared-render-dispatch initialization.
- catalog.generated.json and assets.generated.json are deterministic inputs, not thousands of eagerly imported SVG modules. Source SVG files are retained for audit and byte/hash verification.
- Integration must widen its raw icon-key type and install the Microsoft Apps catalog group/asset dispatch after owner readiness. No shared integration is included or claimed here.

## Products

14 total products, including every exact required key:

| Required key | Product | Artwork |
| --- | --- | --- |
| microsoft-sharepoint | SharePoint | Original named badge, not official |
| microsoft-business-central | Dynamics 365 Business Central | Unchanged official architecture SVG |
| microsoft-dynamics365 | Dynamics 365 product family | Unchanged official architecture SVG |
| microsoft-m365 | Microsoft 365 | Original named badge, not official |
| microsoft-copilot | Microsoft 365 Copilot work/productivity experience | Original named badge, not official |
| microsoft-copilot-studio | Microsoft Copilot Studio, Power Platform | Unchanged official architecture SVG |
| microsoft-excel | Excel | Original named badge, not official |
| microsoft-word | Word | Original named badge, not official |
| microsoft-powerpoint | PowerPoint | Original named badge, not official |
| microsoft-teams | Microsoft Teams | Original named badge, not official |

Optional additions: microsoft-outlook and microsoft-onedrive are original named badges with published product-identity references; microsoft-power-apps and microsoft-power-automate are exact official Power Platform SVGs. Microsoft Graph was omitted because no exact diagram-licensed glyph was found in the inspected collections. No consumer Microsoft Copilot icon is mislabelled as Microsoft 365 Copilot, and no Dynamics family icon is substituted for Business Central.

## Source and Rights Evidence

MICROSOFT-APP-NOTICES.md contains each product's exact source URL, original archive entry or original local badge entry, full artwork SHA-256, classification, archive SHA-256, and source gap. collections.json pins the two used official ZIPs; definitions.json independently pins every official SVG.

The official Microsoft 365 SVG ZIP and its paired Visio ZIP were fetched from the actual links on the specified architecture page and inspected. They contained generic color-coded architectural symbols, not exact identified artwork for the fallback products. The current page is archived; no current marketing-logo rights or unavailable legacy Download Center rights are assumed. Existing Azure V24 provenance was checked read-only and provided no Office/MS365 glyph. Exact Word/PowerPoint vector assets were not found in the inspected sources; none are fabricated, recolored, cropped from a composite, or extracted from a proprietary executable.

The Dynamics and Power Platform source pages and the text of both original bundled CELA PDFs were read. Each permits copying, distributing, and displaying its icons in architectural diagrams, training materials, or documentation only, reserving all other rights. Preserve complete glyphs, proportions, colors and orientation; use product names nearby. Product artwork must not represent Azure Diagram Studio or be used as its branding. Nine original badges are separately identified in subtitles, SVG descriptions, keywords, and per-item notices.

## Verification

TDD red: the registry suite failed on missing catalog.ts/assets.ts; the generator suite failed on missing generate-microsoft.mjs before implementation. One initial generator-test syntax typo was repaired before accepting the missing-module red result.

Green commands:

```powershell
node app/scripts/generate-microsoft.mjs --check
node --test app/scripts/generate-microsoft.test.mjs
npm --prefix app test -- src/microsoft-icons
node app/scripts/generate-microsoft-verify.mjs
```

- 14 native generator preflight tests pass: inert local gradients, scripts, foreignObject, events, remote/file/encoded hrefs, remote paint, CSS imports/escapes, animation, xml:base, XML entities/malformed XML, invalid PNG, duplicate keys, and false official classification.
- 22 Vitest registry/component tests pass: ten required keys, compact count, aliases, unique identities, immutable provenance, byte/hash equivalence, unsafe content, explicit classification/terms, fresh offline module import without DOM side effects, and exact 35px React SVG image placement.
- Microsoft-only explicit-file TypeScript check passes with the repository's strict/compiler flags and TypeScript 6 --ignoreConfig; no shared build metadata was written.
- The isolated browser harness loads the actual owner exports in a fresh Vite SSR loader and uses two fresh offline Edge contexts (1280x900 and 390x844). All 14 products pass direct artwork, embedded 35px SVG component, and PNG conversion checks: 84 nonblank observations, matching SVG/PNG ink counts, no external requests, no browser errors, and no horizontal/text overflow. Desktop/mobile contact sheets were visually reviewed.
- Evidence: app/test-results/microsoft-apps/browser-report.json, contact-sheet.svg, contact-sheet.png, contact-sheet-desktop.png, contact-sheet-mobile.png, contact-sheet.html, and individual 35px PNGs. These are isolated component/export checks, not claims that shared editor exports or packaged Electron builds already support the new keys.

## Reproduction

Run app/scripts/generate-microsoft-import.ps1 to download absent official archives to the temporary source cache, verify their pinned hashes, and extract only the five exact SVGs and two original license PDFs. Run generate-microsoft.mjs to create the original badges and derived records. --check is offline and writes nothing; changed official bytes or unexpected asset files fail without deleting anything. No dependencies were added.

Open integration work belongs to the integration owner. Source gaps are the nine explicitly disclosed original badges and the omitted Microsoft Graph glyph; these are allowed fallbacks, not official-artwork claims.