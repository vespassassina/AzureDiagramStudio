param(
    [Parameter(Mandatory = $true)][string]$AzureZip,
    [Parameter(Mandatory = $true)][string]$FabricZip,
    [Parameter(Mandatory = $true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$result = [ordered]@{}
foreach ($vendor in @('azure', 'fabric')) {
    $path = if ($vendor -eq 'azure') { $AzureZip } else { $FabricZip }
    $zip = [IO.Compression.ZipFile]::OpenRead($path)
    try {
        $entries = @()
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -notmatch '\.svg$') { continue }
            $stream = $entry.Open()
            $memory = New-Object IO.MemoryStream
            try { $stream.CopyTo($memory); $bytes = $memory.ToArray() } finally { $stream.Dispose(); $memory.Dispose() }
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $hash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
            $flags = @()
            $settings = New-Object Xml.XmlReaderSettings
            $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
            $settings.XmlResolver = $null
            $xml = New-Object Xml.XmlDocument
            $xml.XmlResolver = $null
            $memory = New-Object IO.MemoryStream(,$bytes)
            $reader = [Xml.XmlReader]::Create($memory, $settings)
            try { $xml.Load($reader) } finally { $reader.Dispose(); $memory.Dispose() }
            if ($xml.DocumentElement.LocalName -ne 'svg' -or $xml.DocumentElement.NamespaceURI -ne 'http://www.w3.org/2000/svg') { $flags += 'invalid-svg-root' }
            foreach ($instruction in $xml.SelectNodes("//processing-instruction('xml-stylesheet')")) {
                $flags += "processing-instruction:$($instruction.Name)"
            }
            foreach ($element in $xml.SelectNodes('//*')) {
                if ($element.LocalName -in @('script', 'foreignObject', 'iframe', 'object', 'embed', 'animate', 'animateMotion', 'animateTransform', 'set')) { $flags += "unsafe-element:$($element.LocalName)" }
                foreach ($attribute in $element.Attributes) {
                    if ($attribute.LocalName -match '^on') { $flags += "event-handler:$($attribute.Name)" }
                    if ($attribute.LocalName -in @('href', 'src', 'base') -and $attribute.Value -notmatch '^#') { $flags += "external-resource:$($attribute.Name)" }
                    if ($attribute.Value -match '(?i)(javascript:|@import|url\(\s*["'']?\s*[^#\s])') { $flags += "unsafe-value:$($attribute.Name)" }
                }
                if ($element.LocalName -eq 'style' -and $element.InnerText -match '(?i)(@import|url\(\s*["'']?\s*[^#\s])') { $flags += 'external-style-resource' }
            }
            $entries += [ordered]@{ entry = $entry.FullName; sha256 = $hash; base64 = [Convert]::ToBase64String($bytes); svgRoot = [ordered]@{ localName = $xml.DocumentElement.LocalName; namespaceURI = $xml.DocumentElement.NamespaceURI }; safetyFlags = @($flags | Sort-Object -Unique) }
        }
        $result[$vendor] = [ordered]@{ sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant(); entries = $entries }
    } finally { $zip.Dispose() }
}
[IO.File]::WriteAllText($OutputPath, ($result | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))