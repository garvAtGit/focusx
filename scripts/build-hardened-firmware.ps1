param(
  [string]$BuildPath = "$env:TEMP/focusx-5.1.4-build",
  [string]$Fqbn = "esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=default_8MB,PSRAM=opi,USBMode=hwcdc,CDCOnBoot=cdc"
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$cli = Join-Path $repo "arduino-cli/arduino-cli.exe"
$sketch = Join-Path $repo "FocusX_Scanner_Firmware_V5_DualRFID"
$cores = & $cli core list --format json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Cannot inspect installed Arduino cores" }
# Check the textual inventory too, across Arduino CLI JSON schema versions.
$inventory = & $cli core list
if (-not ($inventory -match 'esp32:esp32\s+2\.0\.17\s')) { throw "Install esp32:esp32@2.0.17 before building" }
& $cli compile --jobs 4 --fqbn $Fqbn --build-property upload.maximum_size=3145728 --build-path $BuildPath $sketch
if ($LASTEXITCODE -ne 0) { throw "Firmware compilation failed" }
$manifest = [ordered]@{
  firmwareVersion = "5.1.4-hardening"
  fqbn = $Fqbn
  coreVersion = "2.0.17"
  createdAtUtc = [DateTime]::UtcNow.ToString("o")
  sources = @(Get-ChildItem -LiteralPath $sketch -File | Where-Object { $_.Extension -in @('.ino', '.h', '.csv') } | ForEach-Object {
    @{ name = $_.Name; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower() }
  })
  artifacts = @(Get-ChildItem -LiteralPath $BuildPath -File | Where-Object { $_.Extension -in @('.bin', '.elf', '.map') } | ForEach-Object {
    @{ name = $_.Name; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower(); bytes = $_.Length }
  })
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $BuildPath "release-manifest.json") -Encoding utf8
Write-Output "Built firmware and release-manifest.json in $BuildPath. No device was flashed."
