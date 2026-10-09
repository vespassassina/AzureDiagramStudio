# Diagrammer: Third-Party Notices

Inventory checked 2026-10-09. Assets are bundled for the local architecture-diagram editor, not used as Diagrammer product branding. Review all notices and transitive dependencies before external distribution.

## Runtime Libraries

| Library | Installed version | License | Retained notice |
| --- | --- | --- | --- |
| React | 19.3.0 | MIT | [React notice](licenses/react-LICENSE) |
| React DOM | 19.3.0 | MIT | [React DOM notice](licenses/react-dom-LICENSE) |
| React Flow core | 12.12.0 | MIT | [React Flow notice](licenses/xyflow-react-LICENSE) |
| ELK.js | 0.12.0 | EPL-2.0 | [ELK notice](licenses/elkjs-LICENSE.md) |
| Lucide React | 1.49.0 | ISC | [Lucide notice](licenses/lucide-react-LICENSE) |

ELK source: https://github.com/kieler/elkjs/tree/v0.12.0. Installed package and upstream worker retain their notices. Applicable EPL source/notice obligations remain a distribution review requirement; this local foundation does not certify external distribution compliance.

## Font

IBM Plex Sans variable font is bundled unchanged from Google Fonts under SIL OFL 1.1. The original notice/license is retained in [IBM Plex OFL](licenses/IBM-Plex-OFL.txt). It is loaded locally and embedded in standalone SVG output.

Source: https://github.com/google/fonts/tree/main/ofl/ibmplexsans.

Copyright 2017 IBM Corp.; Reserved Font Name "Plex". OFL permits bundling, embedding and redistribution with the copyright notice and license. The font must not be sold by itself, and a modified font must not use the reserved name without permission. The font remains under OFL; documents produced with it are not required to adopt OFL. No font modification or relicensing is claimed.

## Microsoft Architecture Icons

Source: https://learn.microsoft.com/en-us/azure/architecture/icons/ and the linked Azure Public Service Icons V24 archive. Microsoft permits architectural-diagram, training-material and documentation use, including copying/distributing/displaying icons only for those uses; all other rights are reserved. Do not crop, flip, rotate, distort or use them to represent Diagrammer's product/service.

### Current Full Source Inventory

| Source | SVG archive paths | Unique bundled glyph identities | Repeated placements | Categories | ZIP SHA256 |
| --- | ---: | ---: | ---: | ---: | --- |
| Azure Public Service Icons V24 | 714 | 638 | 76 | 29 | `921594ccd1bf3d9c0a1bd7b6d924e050551a59342f2b353bb74bdcf761c35141` |
| Fabric Icons.zip, v6.1.0 SVG collection | 1584 | 1584 | 0 | 7 | `fc22e71b0545ed15e22c53f16bf4fb06ffe72daabd3c90a947a6e481c9675e6b` |
| Microsoft Entra October 2023, one supplemental glyph | 1 selected | 1 | 0 | Identity | `4e07536706a2d092e6524e5417e2c861333fdbdb41c36f78d44dfa07ccc5eedc` |

The current bundle contains 2,223 official Microsoft SVG glyph identities: 639 Azure/Entra and 1,584 Fabric. Deduplication merges repeated placements only when canonical filename and byte hash agree; different published identities are retained even when their bytes match. Every one of the 2,298 Azure/Fabric archive SVG paths is accounted for; the supplemental Entra entry is recorded separately. Non-SVG archive files are not catalog glyphs.

Archive URLs, category/path counts, all path-to-key mappings, per-entry SHA256 hashes, duplicate statistics and supplemental provenance are in the [source inventory](../src/catalog/inventory.json). Labels, aliases, categories and stable keys are in the [generated catalog](../src/catalog/catalog.generated.ts), with semantic mappings in [catalog semantics](../src/catalog/semantics.json).

Azure archive: https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip.
Fabric archive: https://raw.githubusercontent.com/microsoft/fabric-samples/main/docs-samples/Icons.zip, linked by https://learn.microsoft.com/en-us/fabric/fundamentals/icons.

The 1,584 Fabric files are **icon variants, not 1,584 distinct services**. They span 380 parsed filename families, including interface/action symbols as well as product, workload and item glyphs; one family is the malformed source basename `globe_settings_20_filed`. Styles: 78 color, 560 filled, 561 regular, 342 item, 42 non-item, plus that one unclassified published `filed` suffix. Recognized sizes: 12 px (28), 16 (170), 20 (684), 24 (219), 28 (51), 32 (200), 40 (64), 48 (103), 64 (64); the unclassified source also names 20 px. There is no additional light/dark theme suffix in this pinned archive. Every variant is retained with a stable key. The malformed file has the readable label "Globe settings" without changing its original `fabric-globe-settings-20-filed` key, SVG bytes or category.

Fabric categories are Data Engineering, Data Factory, Data Science, Data Warehouse, Platform & OneLake, Power BI and Real-Time Intelligence. OneLake, Lakehouse, Warehouse, Notebook, Data pipeline, Dataflow Gen2, Eventhouse, Eventstream, KQL database, Semantic model, Report, ML model and Experiment use official archive glyphs and readable component labels, with canonical aliases where needed. A filename-family count is not a service count or a statement of product availability.

Importer validation checks the entire XML document, including stylesheet processing instructions outside the SVG element, with DTD processing prohibited and both XML resolvers disabled. It records SVG root/namespace and byte-hash validation counts. Unsafe content aborts before generation writes; official glyphs are never sanitized or rewritten. Safe SVG bytes are bundled unchanged and embedded in exports. Glyphs and IBM Plex are served locally; no runtime icon CDN, remote glyph URL or host-permission prompt is required. Archive downloads are import-time only, and changed ZIP hashes require an explicit source review.

This is coverage of the pinned published archives, not a promise of unpublished/future glyphs or services. No replacement placeholder is advertised as official. Source collection updates, new aliases and category-contract changes require review; this snapshot does not certify external distribution compliance.

### Historical 24-Service Compatibility Baseline

The original 24-service subset remains preserved, not the current catalog size. Examples from that unchanged baseline:

- App Service: `10035-icon-service-App-Services.svg`.
- Functions: `10029-icon-service-Function-Apps.svg`.
- SQL Database: `10130-icon-service-SQL-Database.svg`.
- Storage: `10086-icon-service-Storage-Accounts.svg`.
- API Management: `10042-icon-service-API-Management-Services.svg`.
- Virtual Network: `10061-icon-service-Virtual-Networks.svg`.

The historical manifest is retained in [legacy compatibility data](../src/catalog/legacy.json). All 24 keys, labels, subtitles, colors and glyph bytes remain intact, including their exact official entry provenance and hashes: 23 from Azure V24 and one from the Microsoft Entra October 2023 collection. The original Azure [Microsoft Terms of Use](licenses/Microsoft_Terms_of_Use.pdf) are retained. The [foundation report](../README.md) describes that historical subset; the current full counts and coverage are recorded above and in the source inventory.

Container Apps uses the unchanged V24 `Azure_Public_Service_Icons/Icons/other/02884-icon-service-Worker-Container-App.svg`, SHA256 `B53C7E6B7AF75B25C04231A7DFF85074F0C32CC1C306376350C0C8DF0CB64417`. Microsoft's [compute-service selection diagram](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/compute-decision-tree#architecture) explicitly labels this graphic **Azure Container Apps** at the lower-right service endpoint. Direct diagram: https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/images/compute-choices.svg. This is a verified service mapping despite the archive filename, not Container Apps Environments, Container Instances or deprecated Container Services.

Microsoft Entra ID uses the unchanged entry `Microsoft Entra architecture icons - Oct 2023/Microsoft Entra color icons SVG/Microsoft Entra ID color icon.svg`, SHA256 `EFD9F54562BFB78BF3C77AECDD5FC31B61FCE8A1CEC78C4370B41FC470E54EDA`. Official source and permitted-use guidelines: https://learn.microsoft.com/en-us/entra/architecture/architecture-icons. Linked archive: https://download.microsoft.com/download/3/1/a/31a56038-856a-4489-88e4-ee5a1c4352be/Microsoft%20Entra%20architecture%20icons%20-%20Oct%202023.zip. ZIP SHA256: `4E07536706A2D092E6524E5417E2C861333FDBDB41C36F78D44DFA07CCC5EEDC`.

The original archive [Entra Terms of Use](licenses/Microsoft_Entra_Terms_of_Use.docx) and [Microsoft Entra Branding Playbook - Visual Identity](licenses/Microsoft_Entra_Branding_Playbook.pptx) are retained unchanged. Entra permits copying/distributing/displaying icons only in architectural diagrams, training materials or documentation unless Microsoft grants explicit permission; all other rights are reserved. Include the product name near its icon. Do not crop, flip, rotate, distort or change the shape, use Microsoft icons to represent Diagrammer, or use them in marketing communications.

### Fabric Terms

Microsoft's [Fabric icon guidelines and terms](https://learn.microsoft.com/en-us/fabric/fundamentals/icons) permit copying, distributing and displaying these icons only in architectural diagrams, training materials or documentation unless Microsoft grants explicit permission; all other rights are reserved. Use icons as they appear within the product and place the product, experience or item name near the icon. Do not crop, flip, rotate, distort or change their shape, or use Microsoft icons to represent Diagrammer's product or service. Publication in a GitHub archive does not grant an unrestricted artwork or branding license. No additional icon package or dependency is installed.

## Tooling

Locked development versions: TypeScript 6.0.3 (Apache-2.0), Vite 8.3.2 (MIT), React plugin 6.1.1 (MIT), Vitest 5.0.3 (MIT), Playwright 1.63.0 stable (Apache-2.0), Testing Library React 16.3.3 (MIT), jsdom 30.1.1 (MIT), @types/node 24.13.3, @types/react 19.2.18 and @types/react-dom 19.2.7 (MIT). Original installed-package notices are retained in their npm packages; the production bundle retains emitted library notices. Oxlint and the spike's beta Playwright were not adopted. Approved tools and their transitive packages are locked in package-lock.json.