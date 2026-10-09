# Microsoft Application Artwork Notices

Research snapshot: 2026-10-09. 14 products: 5 unchanged official architecture SVG icons and 9 original named badges. All 10 DGM-090 required keys are present. No affiliation, sponsorship, or endorsement by Microsoft is asserted. Microsoft product artwork is not Azure Diagram Studio branding. Microsoft and the named products are trademarks of their respective owners.

## Permitted Use

The official Dynamics 365 and Power Platform documentation permits copying, distributing, and displaying these icons only in architectural diagrams, training materials, or documentation unless Microsoft grants explicit additional permission; all other rights are reserved. Preserve proportions, colors, orientation and complete glyphs; use product names nearby. Do not crop, rotate, flip, distort, recolor, or use them to represent this application. This is not a general logo/marketing license. See public/licenses/microsoft-apps/README.md and the original bundled PDFs.

## Microsoft 365 Source Qualification

The requested Microsoft 365 architecture page now redirects to the archived previous-versions article. Inspected https://learn.microsoft.com/en-us/microsoft-365/solutions/architecture-icons-templates and its actual downloads:

- SVG: https://go.microsoft.com/fwlink/?linkid=869455 resolves to https://download.microsoft.com/download/2/F/3/2F346655-1F7E-4F5E-BE78-82DA3D507F3A/2024-microsoft-365-content-icons.zip
- SVG archive SHA-256: 522c4d43cf98a00380b0836f9ec6e06d81fb99758b258c49b6e5f385c05c547a
- Visio: https://go.microsoft.com/fwlink/?linkid=2056186 resolves to https://download.microsoft.com/download/2/F/3/2F346655-1F7E-4F5E-BE78-82DA3D507F3A/2024-microsoft-365-content-VisioTemplates.zip
- Visio archive SHA-256: 5ed0a9938b0e286656d3db7fa3f57a24f8579f6229a1a576df7d5f900826ef22

These downloads contain generic architectural symbols/color palettes, not identified exact glyphs for the nine fallback products. A SharePoint/Teams-colored generic folder, building, or cloud is not a SharePoint/Teams product logo. The productcolors-miscellaneous-symbols-2024.vssx masters were inspected as standard ZIP/XML; no product icons were extracted or decompiled. Existing Azure V24 catalog provenance was inspected read-only; no Office/MS365 legacy glyph was available there. The older Download Center icon-set page (id=41937) was unavailable during research, so its contents/terms were not assumed.

Microsoft 365 Copilot is deliberately not consumer Microsoft Copilot, GitHub Copilot, or Microsoft Copilot Studio. Its badge makes no marketing-artwork license claim. The current overview calls the Microsoft 365 Copilot app Microsoft Copilot, while retaining Microsoft 365 Copilot license/experience names; this registry identifies the work/productivity experience named by DGM-090. Dynamics 365 is the product family; Business Central is its distinct ERP application. Power Apps and Power Automate use their exact Power Platform artwork. Historical aliases are search aids, not extra menu products or lifecycle assertions. Microsoft Graph is omitted: no exact diagram-licensed glyph was found in the inspected packages.

## Unchanged Bundled License PDFs

- dynamics: CELA_Licenses_Public_Use_Icons.pdf; SHA-256 95ba23b02d54aa07b1c128b6d05c6b736db6667cecdbcbc2beacc79e2a610a75; archive https://download.microsoft.com/download/498606aa-6d27-4f13-aa5c-1401078c153b/Dynamics-365-icons-scalable.zip
- power: CELA_Licenses_Public_Use_Icons.pdf; SHA-256 e3758409f34af73705bd53360d77db7d34860d3846bfa452e914b003e6e52ec9; archive https://download.microsoft.com/download/498606aa-6d27-4f13-aa5c-1401078c153b/Power-Platform-icons-scalable.zip

## Per-Product Provenance

### microsoft-sharepoint: official product icon

- Product: SharePoint
- Classification: Official product icon
- Microsoft CDN source: https://res-1.cdn.office.net/files/fabric-cdn-prod_20221209.001/assets/brand-icons/product/png/sharepoint_48x1.png
- Retrieval: individual PNG downloaded unchanged, then SHA-256 pinned for offline bundling.
- Source entry: app/src/assets/microsoft/microsoft-sharepoint.png
- Bundled file: app/src/assets/microsoft/microsoft-sharepoint.png
- Artwork SHA-256: 57dcf239d66d572e28fac8017903b83b9e2308c80ac09a91e0526316709e0e97

### microsoft-business-central: official architecture icon

- Product: Dynamics 365 Business Central
- Classification: Official architecture icon
- Archive source: https://download.microsoft.com/download/498606aa-6d27-4f13-aa5c-1401078c153b/Dynamics-365-icons-scalable.zip
- Archive SHA-256: f5f4d96aaa637b71e47136cc74e9a4a69b8a81f7e43c1c5756f00b5cea9ffe02
- Permitted-use terms: https://learn.microsoft.com/en-us/dynamics365/get-started/icons
- Extraction: unchanged bytes from the identified SVG ZIP entry.
- Source entry: Dynamics 365 App Icons/BusinessCentral_scalable.svg
- Bundled file: app/src/assets/microsoft/microsoft-business-central.svg
- Artwork SHA-256: 5effb9327ab3914ba1a4660c1a95282253ba6fb911580d227c62a222a4a76be8

### microsoft-dynamics365: official architecture icon

- Product: Dynamics 365
- Classification: Official architecture icon
- Archive source: https://download.microsoft.com/download/498606aa-6d27-4f13-aa5c-1401078c153b/Dynamics-365-icons-scalable.zip
- Archive SHA-256: f5f4d96aaa637b71e47136cc74e9a4a69b8a81f7e43c1c5756f00b5cea9ffe02
- Permitted-use terms: https://learn.microsoft.com/en-us/dynamics365/get-started/icons
- Extraction: unchanged bytes from the identified SVG ZIP entry.
- Source entry: Dynamics 365 Product Family Icons/Dynamics365_scalable.svg
- Bundled file: app/src/assets/microsoft/microsoft-dynamics365.svg
- Artwork SHA-256: 5017e931a0f5e724247a9c49e15e22bb22e252d5343e0a40f7f38366d2aeb388

### microsoft-m365: original named badge (not official)

- Product: Microsoft 365
- Classification: Original named badge (not official)
- Product identity reference (not an artwork license): https://learn.microsoft.com/en-us/microsoft-365/solutions/architecture-icons-templates
- Source gap: no exact identifiable product artwork in the inspected Microsoft 365 SVG/stencil collections; no marketing-logo redistribution permission assumed. Original grayscale letters and connector geometry, not a replacement official glyph.
- Source entry: app/src/assets/microsoft/microsoft-m365.svg
- Bundled file: app/src/assets/microsoft/microsoft-m365.svg
- Artwork SHA-256: 67445db657b61b35340b318ab4ec854ccc45c7c3d5ccd963bb59485dc57bed5d

### microsoft-copilot: original named badge (not official)

- Product: Microsoft 365 Copilot
- Classification: Original named badge (not official)
- Product identity reference (not an artwork license): https://learn.microsoft.com/en-us/microsoft-365/copilot/microsoft-365-copilot-overview
- Source gap: no exact identifiable product artwork in the inspected Microsoft 365 SVG/stencil collections; no marketing-logo redistribution permission assumed. Original grayscale letters and connector geometry, not a replacement official glyph.
- Source entry: app/src/assets/microsoft/microsoft-copilot.svg
- Bundled file: app/src/assets/microsoft/microsoft-copilot.svg
- Artwork SHA-256: 28eb4c6b8256330a27d747e7ead7db7130b02bfd9df7f29a146d7da3395c1de9

### microsoft-copilot-studio: official architecture icon

- Product: Microsoft Copilot Studio
- Classification: Official architecture icon
- Archive source: https://download.microsoft.com/download/498606aa-6d27-4f13-aa5c-1401078c153b/Power-Platform-icons-scalable.zip
- Archive SHA-256: d5abafebbce553690caf7b42dd14b8335bf2c0dfc09f46bd9ac8041187da2c3a
- Permitted-use terms: https://learn.microsoft.com/en-us/power-platform/guidance/icons
- Extraction: unchanged bytes from the identified SVG ZIP entry.
- Source entry: CopilotStudio_scalable.svg
- Bundled file: app/src/assets/microsoft/microsoft-copilot-studio.svg
- Artwork SHA-256: c614fa6b9b7d33048c6c4efcdd508e5b7818d296cbd1cd7d8848bb2dd1be4fd0

### microsoft-excel: official product icon

- Product: Excel
- Classification: Official product icon
- Microsoft CDN source: https://res-1.cdn.office.net/files/fabric-cdn-prod_20221209.001/assets/brand-icons/product/png/excel_48x1.png
- Retrieval: individual PNG downloaded unchanged, then SHA-256 pinned for offline bundling.
- Source entry: app/src/assets/microsoft/microsoft-excel.png
- Bundled file: app/src/assets/microsoft/microsoft-excel.png
- Artwork SHA-256: 25847181646d57146e37d5368c8c5799efde8634f8bf75c7a3eea2d98acbbc70

### microsoft-word: official product icon

- Product: Word
- Classification: Official product icon
- Microsoft CDN source: https://res-1.cdn.office.net/files/fabric-cdn-prod_20221209.001/assets/brand-icons/product/png/word_48x1.png
- Retrieval: individual PNG downloaded unchanged, then SHA-256 pinned for offline bundling.
- Source entry: app/src/assets/microsoft/microsoft-word.png
- Bundled file: app/src/assets/microsoft/microsoft-word.png
- Artwork SHA-256: f75b6a24b1569b660ccee0a66d2e75ee8bcd1d8dd1d875d000d727df465bf175

### microsoft-powerpoint: official product icon

- Product: PowerPoint
- Classification: Official product icon
- Microsoft CDN source: https://res-1.cdn.office.net/files/fabric-cdn-prod_20221209.001/assets/brand-icons/product/png/powerpoint_48x1.png
- Retrieval: individual PNG downloaded unchanged, then SHA-256 pinned for offline bundling.
- Source entry: app/src/assets/microsoft/microsoft-powerpoint.png
- Bundled file: app/src/assets/microsoft/microsoft-powerpoint.png
- Artwork SHA-256: 64690d558b257afa224813fffa64c5f7bb8295082dd56b546c7f931f9128aa51

### microsoft-teams: official product icon

- Product: Microsoft Teams
- Classification: Official product icon
- Microsoft CDN source: https://res-1.cdn.office.net/files/fabric-cdn-prod_20221209.001/assets/brand-icons/product/png/teams_48x1.png
- Retrieval: individual PNG downloaded unchanged, then SHA-256 pinned for offline bundling.
- Source entry: app/src/assets/microsoft/microsoft-teams.png
- Bundled file: app/src/assets/microsoft/microsoft-teams.png
- Artwork SHA-256: bee8786675eac8d30d4a611b649945701f1cdf9983df03fb704e2917764862a7

### microsoft-outlook: official product icon

- Product: Outlook
- Classification: Official product icon
- Microsoft CDN source: https://res-1.cdn.office.net/files/fabric-cdn-prod_20221209.001/assets/brand-icons/product/png/outlook_48x1.png
- Retrieval: individual PNG downloaded unchanged, then SHA-256 pinned for offline bundling.
- Source entry: app/src/assets/microsoft/microsoft-outlook.png
- Bundled file: app/src/assets/microsoft/microsoft-outlook.png
- Artwork SHA-256: fe67170a0d546a9dc74d49e4686f9bd4721212c1e495b68a10d92d16e6016518

### microsoft-onedrive: official product icon

- Product: OneDrive
- Classification: Official product icon
- Microsoft CDN source: https://res-1.cdn.office.net/files/fabric-cdn-prod_20221209.001/assets/brand-icons/product/png/onedrive_48x1.png
- Retrieval: individual PNG downloaded unchanged, then SHA-256 pinned for offline bundling.
- Source entry: app/src/assets/microsoft/microsoft-onedrive.png
- Bundled file: app/src/assets/microsoft/microsoft-onedrive.png
- Artwork SHA-256: 5555a9457583e078a05f1fe673565d6888da479c39378320e7267b924f8fb11b

### microsoft-power-apps: official architecture icon

- Product: Power Apps
- Classification: Official architecture icon
- Archive source: https://download.microsoft.com/download/498606aa-6d27-4f13-aa5c-1401078c153b/Power-Platform-icons-scalable.zip
- Archive SHA-256: d5abafebbce553690caf7b42dd14b8335bf2c0dfc09f46bd9ac8041187da2c3a
- Permitted-use terms: https://learn.microsoft.com/en-us/power-platform/guidance/icons
- Extraction: unchanged bytes from the identified SVG ZIP entry.
- Source entry: Power Platform/PowerApps_scalable.svg
- Bundled file: app/src/assets/microsoft/microsoft-power-apps.svg
- Artwork SHA-256: c357907ad0a2d24a6d8c82b23fe4d2aaa4a4524076991f74770fc043a4cc455a

### microsoft-power-automate: official architecture icon

- Product: Power Automate
- Classification: Official architecture icon
- Archive source: https://download.microsoft.com/download/498606aa-6d27-4f13-aa5c-1401078c153b/Power-Platform-icons-scalable.zip
- Archive SHA-256: d5abafebbce553690caf7b42dd14b8335bf2c0dfc09f46bd9ac8041187da2c3a
- Permitted-use terms: https://learn.microsoft.com/en-us/power-platform/guidance/icons
- Extraction: unchanged bytes from the identified SVG ZIP entry.
- Source entry: Power Platform/PowerAutomate_scalable.svg
- Bundled file: app/src/assets/microsoft/microsoft-power-automate.svg
- Artwork SHA-256: 2025db7bb3feec49d75681934b8561fb958cf11bdf0e2acf6e2b28db5c755e8d

## Reproduction

Use the owned generate-microsoft-import.ps1 script to verify pinned ZIP hashes and extract the five exact SVGs and original license PDFs. Then node app/scripts/generate-microsoft.mjs generates the neutral badges, frozen registry input, embedded assets, and this notice. node app/scripts/generate-microsoft.mjs --check verifies every generated byte offline and refuses changed official hashes. No runtime downloads, arbitrary paths, DOM initialization, package changes, or shared catalog integration are part of this owner slice.
