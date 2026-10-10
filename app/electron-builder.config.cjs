const developerId = Boolean(process.env.CSC_LINK)

module.exports = {
  appId: 'com.azurediagramstudio.desktop',
  productName: 'Azure Diagram Studio',
  executableName: 'AzureDiagramStudio',
  asar: true,
  compression: 'store',
  directories: { app: '.desktop-stage', output: 'release', buildResources: 'public/branding' },
  files: ['dist/**', 'electron/*.mjs', 'package.json', '!node_modules/**'],
  artifactName: 'Azure-Diagram-Studio-${version}-win-${arch}-portable.${ext}',
  forceCodeSigning: false,
  publish: null,
  win: { target: ['portable'], icon: 'public/branding/app-icon.ico' },
  portable: { requestExecutionLevel: 'user', buildUniversalInstaller: false },
  // A Developer ID certificate in CSC_LINK signs with hardened runtime, and
  // electron-builder notarizes when APPLE_ID credentials are present. Without
  // one, sign ad-hoc: it seals the bundle so Gatekeeper offers Open Anyway
  // instead of calling the app damaged. Hardened runtime breaks ad-hoc launches.
  mac: { target: ['zip'], artifactName: 'Azure-Diagram-Studio-${version}-mac-${arch}.${ext}', icon: 'public/branding/logo-512.png', identity: developerId ? undefined : '-', hardenedRuntime: developerId },
}