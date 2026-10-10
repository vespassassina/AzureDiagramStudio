# macOS Apple Silicon Build Handover

Build Azure Diagram Studio on an Apple Silicon Mac running a current supported
macOS release. The output is a macOS ARM64 application ZIP, not an `.exe`.

## Prerequisites

- Xcode Command Line Tools: `xcode-select --install`
- Node.js 26
- Git
- Approximately 2 GB of free disk space

## Build

```bash
# Clone or update the exact delivery branch.
git clone https://github.com/vespassassina/AzureDiagramStudio.git
cd AzureDiagramStudio
git switch feat/DGM-070-desktop-release
git pull --ff-only

cd app
npm ci
npm run desktop:pack:mac
```

The build runs the Electron desktop tests, production build, and macOS ARM64
packaging. It writes this artifact:

```text
app/release/Azure-Diagram-Studio-0.1.0-mac-arm64.zip
```

## Verify

```bash
cd app
shasum -a 256 release/Azure-Diagram-Studio-0.1.0-mac-arm64.zip
unzip -t release/Azure-Diagram-Studio-0.1.0-mac-arm64.zip
open release/mac-arm64/Azure\ Diagram\ Studio.app
```

The package is unsigned and is not notarized. Follow your organization's
macOS security policy; do not bypass platform protections.

## Upload To GitHub Release

After inspecting the ZIP and checksum, upload it to the existing `v0.1.0`
release using an authenticated GitHub CLI session:

```bash
gh release upload v0.1.0 release/Azure-Diagram-Studio-0.1.0-mac-arm64.zip --clobber
```

Alternatively, dispatch the repository's **Build macOS ARM64 release** Actions
workflow with the `v0.1.0` tag. It builds on `macos-14` and uploads the same
artifact automatically.
