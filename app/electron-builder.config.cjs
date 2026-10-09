module.exports = {
  appId: 'com.azurediagramstudio.desktop',
  productName: 'Azure Diagram Studio',
  executableName: 'AzureDiagramStudio',
  asar: true,
  directories: { app: '.desktop-stage', output: 'release', buildResources: 'public/branding' },
  files: ['dist/**', 'electron/*.mjs', 'package.json', '!node_modules/**'],
  artifactName: 'Azure-Diagram-Studio-${version}-win-${arch}-portable.${ext}',
  forceCodeSigning: false,
  publish: null,
  win: { target: ['portable'], icon: 'public/branding/app-icon.ico' },
  portable: { requestExecutionLevel: 'user', buildUniversalInstaller: false },
}