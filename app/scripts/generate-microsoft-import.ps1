param([string]$SourceCache = (Join-Path $env:TEMP 'dgm090-microsoft-sources'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$registry = Join-Path $root 'src\microsoft-icons'
$assets = Join-Path $root 'src\assets\microsoft'
$licenses = Join-Path $root 'public\licenses\microsoft-apps'
$definitions = Get-Content (Join-Path $registry 'definitions.json') -Raw | ConvertFrom-Json
$collections = Get-Content (Join-Path $registry 'collections.json') -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force $SourceCache,$assets,$licenses | Out-Null
foreach ($property in $collections.PSObject.Properties) {
  $key = $property.Name
  $collection = $property.Value
  $archivePath = Join-Path $SourceCache "$key.zip"
  if (-not (Test-Path $archivePath)) { Invoke-WebRequest -UseBasicParsing -Uri $collection.url -OutFile $archivePath }
  if ((Get-FileHash $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $collection.sha256) { throw "Pinned archive hash mismatch: $key" }
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    foreach ($item in $definitions | Where-Object { $_.collection -eq $key }) {
      $entry = $zip.GetEntry($item.entry)
      if (-not $entry -or $entry.Length -gt 393216) { throw "Missing or oversized source entry: $($item.entry)" }
      $stream = $entry.Open()
      $algorithm = [System.Security.Cryptography.SHA256]::Create()
      try { $digest = [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
      finally { $stream.Dispose(); $algorithm.Dispose() }
      if ($digest -ne $item.sha256) { throw "Pinned SVG hash mismatch: $($item.key)" }
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $assets "microsoft-$($item.key).svg"), $true)
      Write-Output "Unchanged official SVG: microsoft-$($item.key) $digest"
    }
    $license = $zip.GetEntry($collection.licenseEntry)
    if (-not $license) { throw "Missing official license PDF: $key" }
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($license, (Join-Path $licenses "$key-CELA_Licenses_Public_Use_Icons.pdf"), $true)
  } finally { $zip.Dispose() }
}