# macOS Build

Azure Diagram Studio ships for Apple Silicon Macs as a ZIP holding
`AzureDiagramStudio.app`. GitHub Actions builds it on every push; you can also
build it locally.

## Continuous build

`.github/workflows/macos-build.yml` runs on every push, pull request and `v*`
tag, on a `macos-14` (Apple Silicon) runner. It:

1. runs the Electron shell tests and builds the app;
2. packages `app/release/Azure-Diagram-Studio-<version>-mac-arm64.zip`;
3. verifies the ZIP (`npm run desktop:verify:mac`): signature intact, arm64,
   product icon, and the app launches to a rendered diagram;
4. keeps the ZIP as the run artifact `azure-diagram-studio-mac-arm64`;
5. on a `v*` tag, attaches it to that GitHub release, creating the release if
   needed. To attach to an existing release without a new tag, run the
   workflow manually and name the tag.

## Signing

Without secrets the app is signed ad-hoc. That seals the bundle but proves no
identity: on another Mac, Gatekeeper blocks the first launch. The user opens
it once through System Settings, Privacy & Security, Open Anyway.

To sign with your identity and notarize, so it opens without warnings, add
these repository secrets (Settings, Secrets and variables, Actions):

| Secret | Value |
|---|---|
| `MACOS_CERTIFICATE_P12_BASE64` | Developer ID Application certificate and key, exported as .p12, base64: `base64 -i cert.p12 \| pbcopy` |
| `MACOS_CERTIFICATE_PASSWORD` | the .p12 export password |
| `APPLE_ID` | Apple ID email of the developer account |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password from account.apple.com |
| `APPLE_TEAM_ID` | ten-character team ID |

A Developer ID certificate needs the paid Apple Developer Program. An "Apple
Development" certificate does not work: Gatekeeper rejects it outside your own
Mac.

The quickest way to set the certificate secrets is the helper script. It checks
the .p12 (certificate type, private key, password), takes the team ID from the
certificate, uploads, then offers to delete the file:

```bash
app/scripts/set-macos-signing-secrets.sh path/to/cert.p12
```

Without a path it uses `Certificates.p12` in the folder above the repository.
Add `--dry-run` to check without uploading. Set `APPLE_ID` and
`APPLE_APP_SPECIFIC_PASSWORD` with `gh secret set`.

With the certificate present the build turns on hardened runtime; with the
Apple ID secrets it also notarizes. The "Report signing" step in the run log
shows which identity signed the app.

## Local build

Needs an Apple Silicon Mac, Xcode Command Line Tools (`xcode-select
--install`), Node.js 26 and about 2 GB free.

```bash
cd app
npm ci
npm run desktop:pack:mac
npm run desktop:verify:mac
open release/mac-arm64/AzureDiagramStudio.app
```

Local builds are ad-hoc signed unless `CSC_LINK` points at a Developer ID .p12.
