# <img src="app/public/branding/logo.svg" width="32" height="32" alt="Original Azure Diagram Studio logo"> Azure Diagram Studio

![Azure Diagram Studio, original brand header and light editor controls](docs/images/studio-screenshot.png)

A local architecture editor for Azure, Microsoft Fabric, Microsoft applications and software systems. Draw with architecture glyphs, clearly identified named badges or your own authorized images; describe ownership boundaries, connect components and export without a cloud account. The public source repository is [vespassassina/AzureDiagramStudio](https://github.com/vespassassina/AzureDiagramStudio).

- Searchable Azure/Fabric catalogs, 14 Microsoft app entries (5 official architecture glyphs, 7 official product PNGs, and 2 original named badges), and generic software components.
- A vendor icon set of 17 bundled PNG product icons, including Oracle, SAP, IBM, AWS, Google Cloud, HP and HPE as distinct identities.
- Custom icon import from SVG, PNG, JPEG, GIF or WebP, embedded as a safe normalized PNG in the editable document.
- Editable boundaries, annotations, connector labels, statuses and legends.
- Explicit ELK Auto-arrange, undo/redo and selection clipboard.
- Local autosave, editable JSON backups and separate skill-JSON import.
- Self-contained SVG with native text, embedded icons and font; PNG at 1x or 2x.
- Local light/dark editor theme; document and export colors stay unchanged.

![The same native example in the dark editor theme](docs/images/studio-dark.png)

## Windows Portable

[Version 0.1.0 is published](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/v0.1.0). Both portable files and the checksum manifest were uploaded and read back with matching sizes and SHA256 digests.

| Your PC | Release asset name |
| --- | --- |
| Windows on ARM, including Snapdragon | [Download ARM64 portable EXE](https://github.com/vespassassina/AzureDiagramStudio/releases/download/v0.1.0/Azure-Diagram-Studio-0.1.0-win-arm64-portable.exe) |
| Windows on Intel or AMD | [Download x64 portable EXE](https://github.com/vespassassina/AzureDiagramStudio/releases/download/v0.1.0/Azure-Diagram-Studio-0.1.0-win-x64-portable.exe) |

The portable packages bundle the complete app, Chromium runtime, glyphs, badges, font and layout worker for offline use, without Node.js, a local server or cloud sign-in. They have no auto-update service. Files are approximately 403-404 MB because the portable wrapper uses store-only compression. ARM64 was tested natively; x64 was tested under Windows ARM64 emulation, not certified on native Intel/AMD hardware.

Actual packaged offline checks passed for launch, five image formats, unsafe-image rejection, themes, bundled-worker layout/undo, JSON/SVG/PNG output, autosave/relaunch and moving the executable. Default production launch exposed no debug listener. This capture is from the packaged ARM64 app with networking disabled, not the development browser:

![Actual packaged ARM64 Azure Diagram Studio, offline, with Microsoft/vendor/custom artwork](docs/images/studio-desktop-offline.png)

Before launching a downloaded executable, compare its SHA256 with [SHA256SUMS.txt](https://github.com/vespassassina/AzureDiagramStudio/releases/download/v0.1.0/SHA256SUMS.txt):

```powershell
Get-FileHash '.\Azure-Diagram-Studio-0.1.0-win-x64-portable.exe' -Algorithm SHA256
```

These files are unsigned and may trigger Windows SmartScreen. Verify the source and checksum; follow your organization's policy. Do not disable SmartScreen, antivirus or other protections. Native save-dialog appearance and SmartScreen UX remain manual checks.

Local autosave is not a transferable backup. Use **Save JSON** before moving computers, clearing browser/profile data or removing the application. Browser and desktop storage are separate; transfer existing localhost diagrams with **Save JSON**, then **Open JSON** in the desktop app. See the [short manual](docs/manual.md).

## Examples

All four architectures are synthetic illustrations, not deployed systems, security guarantees or live integrations. Every component is marked **Synthetic**. Open the native JSON with **Open JSON** to edit; SVG and PNG are reusable pictures, not editable document backups.

[View all four examples together](docs/images/examples-contact-sheet.png).

### Azure Web & API

![Synthetic Azure web and API architecture](docs/images/azure-web-app.png)

[Editable JSON](examples/azure-web-app.json) | [SVG](docs/images/azure-web-app.svg) | [PNG](docs/images/azure-web-app.png)

### Fabric & OneLake Analytics

![Synthetic Fabric and OneLake analytics architecture](docs/images/fabric-onelake.png)

[Editable JSON](examples/fabric-onelake.json) | [SVG](docs/images/fabric-onelake.svg) | [PNG](docs/images/fabric-onelake.png)

### Event-Driven Azure Integration

![Synthetic event-driven Azure integration architecture](docs/images/event-driven.png)

[Editable JSON](examples/event-driven.json) | [SVG](docs/images/event-driven.svg) | [PNG](docs/images/event-driven.png)

### Microsoft & Enterprise Integration

![Synthetic Microsoft and enterprise integration with an original custom icon](docs/images/enterprise-integration.png)

[Editable JSON](examples/enterprise-integration.json) | [SVG](docs/images/enterprise-integration.svg) | [PNG](docs/images/enterprise-integration.png)

SharePoint uses its bundled Microsoft product PNG; Dynamics 365 uses its published architecture glyph. SAP and Oracle use bundled vendor PNGs. **SimpleBadge** is original sample artwork, not a corporate logo. Its [SVG source](examples/simple-badge.svg) and [PNG](examples/simple-badge.png) can be used to try **Import custom icon**. The native example embeds the normalized PNG, so it needs no external image file.

## Build From Source

Install Node.js and npm for source development; dependency installation needs network access the first time. From the repository root:

```powershell
cd app
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. The browser build stores data in that browser's origin/profile. For built-file preview, use `npm run preview -- --host 127.0.0.1` after building.

The examples are generated with the app's native parser, canonical catalog, shared renderer and real ELK layout, followed by curated page geometry. After installing app dependencies, run `node docs/tools/generate-examples.mjs` from the repository root to regenerate JSON/SVG/PNG, or append `--check` to validate them. Checks use installed Microsoft Edge. Add `--screenshot` with `DGM_DOCS_URL` set to the running branded app to capture both themes in a fresh isolated context, without touching your browser data.

## Notices

Azure Diagram Studio is independent, not a Microsoft product and not endorsed by any named organization. Its original [logo](app/public/branding/logo.svg) and [favicon](app/public/favicon.svg) are application branding, not Microsoft artwork. Microsoft glyphs retain their architecture/training/documentation restrictions; they are not unrestricted marketing assets and no blanket sublicensing permission is asserted. Retain the [third-party notices](app/public/THIRD-PARTY-NOTICES.md), [Microsoft application provenance](app/public/MICROSOFT-APP-NOTICES.md), [vendor badge rights/source qualifications](app/public/VENDOR-NOTICES.md) and [original license/terms files](app/public/licenses/).

Named badges do not establish logo permission, affiliation or tested compatibility. Import only artwork you own or are authorized to use; responsibility for uploaded content remains with its contributor. No open-source license has been selected for this project: a public repository is not itself a license grant.

PowerPoint insertion fidelity and uncoached novice usability have not been manually accepted; the example pictures do not establish those results.

## Release Downloads

- [Windows ARM64 portable](https://github.com/vespassassina/AzureDiagramStudio/releases/download/v0.1.0/Azure-Diagram-Studio-0.1.0-win-arm64-portable.exe)
- [Windows x64 portable](https://github.com/vespassassina/AzureDiagramStudio/releases/download/v0.1.0/Azure-Diagram-Studio-0.1.0-win-x64-portable.exe)
- [SHA256 checksum manifest](https://github.com/vespassassina/AzureDiagramStudio/releases/download/v0.1.0/SHA256SUMS.txt)
- [Release notes and limitations](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/v0.1.0)