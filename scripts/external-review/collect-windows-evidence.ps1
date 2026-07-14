[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('install-integrity', 'graph-main-journey', 'keyboard-a11y', 'responsive-visual', 'performance-recovery')]
  [string]$Pack,

  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,

  [Parameter(Mandatory = $true)]
  [string]$InstalledExePath,

  [Parameter(Mandatory = $true)]
  [string]$ReleaseManifestPath,

  [Parameter(Mandatory = $true)]
  [string]$InstallReceiptPath,
  [Parameter(Mandatory = $true)]
  [string]$ExpectedReceiptHash,
  [Parameter(Mandatory = $true)]
  [string]$ReleaseArtifactUrl,
  [Parameter(Mandatory = $true)]
  [string]$ReleaseArtifactSha256,
  [Parameter(Mandatory = $true)]
  [long]$ReleaseArtifactBytes,
  [Parameter(Mandatory = $true)]
  [long]$ReleaseRunId,
  [Parameter(Mandatory = $true)]
  [int]$ReleaseRunAttempt,
  [Parameter(Mandatory = $true)]
  [long]$ReleaseArtifactId,
  [Parameter(Mandatory = $true)]
  [string]$ReleaseArtifactName,

  [string]$EvidenceRoot = 'test-results/external-review',
  [switch]$AllowExistingProfile,
  [switch]$AllowMissingObs
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installedExe = (Resolve-Path -LiteralPath $InstalledExePath).Path
$releaseManifest = (Resolve-Path -LiteralPath $ReleaseManifestPath).Path
$installReceipt = (Resolve-Path -LiteralPath $InstallReceiptPath).Path
$revision = (& git -C $repoRoot rev-parse HEAD).Trim()
$gitStatus = @(& git -C $repoRoot status --porcelain=v1)
$evidenceDir = [IO.Path]::GetFullPath((Join-Path $repoRoot (Join-Path $EvidenceRoot (Join-Path $revision $Pack))))
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
$receiptCopy = Join-Path $evidenceDir 'install-receipt.json'
Copy-Item -LiteralPath $installReceipt -Destination $receiptCopy -Force
$receiptEvidence = Get-Item -LiteralPath $receiptCopy
$receiptHash = (Get-FileHash -LiteralPath $receiptCopy -Algorithm SHA256).Hash
if ($receiptHash -ne $ExpectedReceiptHash.ToUpperInvariant()) { throw 'Install receipt hash does not match the same-run value.' }
$receiptDocument = Get-Content -LiteralPath $receiptCopy -Raw | ConvertFrom-Json

function Get-FileEvidence([string]$Path) {
  $item = Get-Item -LiteralPath $Path
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  return [ordered]@{
    path = $item.FullName
    bytes = $item.Length
    sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    fileVersion = $item.VersionInfo.FileVersion
    productVersion = $item.VersionInfo.ProductVersion
    authenticode = [string]$signature.Status
    signer = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
  }
}

function Get-ManifestHash([string]$RelativePath) {
  $normalized = $RelativePath.Replace('\', '/')
  $line = Get-Content -LiteralPath $releaseManifest | Where-Object {
    $_ -match ('^[0-9A-Fa-f]{64} \*?' + [regex]::Escape($normalized) + '$')
  } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split ' ')[0].ToUpperInvariant()
}

function Get-CommandExecutable([string]$Command) {
  if ([string]::IsNullOrWhiteSpace($Command)) { return $null }
  if ($Command -match '^\s*"([^"]+)"') { return [IO.Path]::GetFullPath($Matches[1]) }
  if ($Command -match '^\s*([^\s]+\.exe)') { return [IO.Path]::GetFullPath($Matches[1]) }
  return $null
}

function Get-RegisteredFilePath([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  $withoutIndex = $Value -replace ',\d+\s*$', ''
  return [IO.Path]::GetFullPath($withoutIndex.Trim().Trim('"'))
}

Add-Type -AssemblyName System.Windows.Forms
$screens = @([System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
  [ordered]@{
    deviceName = $_.DeviceName
    primary = $_.Primary
    width = $_.Bounds.Width
    height = $_.Bounds.Height
    workingWidth = $_.WorkingArea.Width
    workingHeight = $_.WorkingArea.Height
  }
})
$dpi = (Get-ItemProperty 'HKCU:\Control Panel\Desktop\WindowMetrics' -Name AppliedDPI -ErrorAction SilentlyContinue).AppliedDPI
$computer = Get-CimInstance Win32_ComputerSystem
$os = Get-CimInstance Win32_OperatingSystem
$obsCandidates = @(
  $env:PLOTFLOW_OBS_EXE,
  'C:\Program Files\obs-studio\bin\64bit\obs64.exe',
  'C:\Program Files (x86)\obs-studio\bin\32bit\obs32.exe'
) | Where-Object { $_ }
$obsPath = $obsCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
$profileCandidates = @(
  (Join-Path $env:APPDATA 'PlotFlow'),
  (Join-Path $env:APPDATA 'plotflow')
) | Select-Object -Unique
$existingProfiles = @($profileCandidates | Where-Object { Test-Path -LiteralPath $_ })

$installerEvidence = Get-FileEvidence $installer
$installedEvidence = Get-FileEvidence $installedExe
$releaseManifestEvidence = Get-FileEvidence $releaseManifest
$manifestLines = Get-Content -LiteralPath $releaseManifest
$installerEntry = $manifestLines | Where-Object { $_ -match '^[0-9A-Fa-f]{64} \*?PlotFlow Setup .+\.exe$' } | Select-Object -First 1
$unpackedExpected = Get-ManifestHash 'win-unpacked/PlotFlow.exe'
$installerExpected = if ($installerEntry) { ($installerEntry -split ' ')[0].ToUpperInvariant() } else { $null }

$uninstallRoots = @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$uninstallEntries = @(foreach ($root in $uninstallRoots) {
  Get-ItemProperty $root -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -eq 'PlotFlow' } |
    ForEach-Object {
      [ordered]@{
        registrationId = $_.PSChildName
        hive = if ($_.PSPath -match 'HKEY_LOCAL_MACHINE') { 'HKLM' } else { 'HKCU' }
        displayName = $_.DisplayName
        displayVersion = $_.DisplayVersion
        installLocation = $_.InstallLocation
        uninstallString = $_.UninstallString
        quietUninstallString = $_.QuietUninstallString
      }
    }
})
$extensionClass = (Get-ItemProperty 'Registry::HKEY_CLASSES_ROOT\.mdstory' -ErrorAction SilentlyContinue).'(default)'
$associationRoot = if ($extensionClass) { "Registry::HKEY_CLASSES_ROOT\$extensionClass" } else { $null }
$fileAssociation = [ordered]@{
  extensionClass = $extensionClass
  openCommand = if ($associationRoot) { (Get-ItemProperty "$associationRoot\shell\open\command" -ErrorAction SilentlyContinue).'(default)' } else { $null }
  icon = if ($associationRoot) { (Get-ItemProperty "$associationRoot\DefaultIcon" -ErrorAction SilentlyContinue).'(default)' } else { $null }
}

$installedDirectory = [IO.Path]::GetDirectoryName($installedExe)
$matchingUninstallEntries = @($uninstallEntries | Where-Object {
  $location = if ($_.installLocation) { [IO.Path]::GetFullPath($_.installLocation.TrimEnd('\')) } else { $null }
  $quietExecutable = Get-CommandExecutable $_.quietUninstallString
  $_.registrationId -eq '74fc8b73-b58d-5573-82e7-75efc9ec526f' `
    -and $location -and $location.Equals($installedDirectory, [StringComparison]::OrdinalIgnoreCase) `
    -and $quietExecutable `
    -and $quietExecutable.StartsWith("$installedDirectory\", [StringComparison]::OrdinalIgnoreCase) `
    -and [IO.Path]::GetFileName($quietExecutable) -eq 'Uninstall PlotFlow.exe' `
    -and (Test-Path -LiteralPath $quietExecutable -PathType Leaf) `
    -and (((Get-Item -LiteralPath $quietExecutable -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)
})
$uninstallerEvidence = if ($matchingUninstallEntries.Count -eq 1) {
  Get-FileEvidence (Get-CommandExecutable $matchingUninstallEntries[0].quietUninstallString)
} else { $null }
$associationExecutable = Get-CommandExecutable $fileAssociation.openCommand
$iconExecutable = Get-RegisteredFilePath $fileAssociation.icon
$registrationValid = $matchingUninstallEntries.Count -eq 1 `
  -and $associationExecutable `
  -and $associationExecutable.Equals($installedExe, [StringComparison]::OrdinalIgnoreCase) `
  -and $iconExecutable `
  -and $iconExecutable.StartsWith("$installedDirectory\", [StringComparison]::OrdinalIgnoreCase) `
  -and (Test-Path -LiteralPath $associationExecutable -PathType Leaf) `
  -and (Test-Path -LiteralPath $iconExecutable -PathType Leaf)

$blockers = @()
if ($gitStatus.Count -gt 0) { $blockers += 'Git worktree is not clean.' }
if (-not $installerExpected) { $blockers += 'Installer is missing from SHA256SUMS.txt.' }
elseif ($installerExpected -ne $installerEvidence.sha256) { $blockers += 'Installer SHA256 does not match SHA256SUMS.txt.' }
if (-not $unpackedExpected) { $blockers += 'win-unpacked/PlotFlow.exe is missing from SHA256SUMS.txt.' }
elseif ($unpackedExpected -ne $installedEvidence.sha256) { $blockers += 'Installed executable does not match the packaged executable.' }
if (-not $registrationValid) { $blockers += 'PlotFlow registration is not uniquely bound to the exact installed executable, quiet uninstaller, association and icon.' }
if ($receiptDocument.schemaVersion -ne 2 `
  -or -not ([string]$receiptDocument.installRoot).Equals($installedDirectory, [StringComparison]::OrdinalIgnoreCase) `
  -or $receiptDocument.executableSha256 -ne $installedEvidence.sha256 `
  -or -not $uninstallerEvidence `
  -or $receiptDocument.uninstallerSha256 -ne $uninstallerEvidence.sha256) {
  $blockers += 'Same-run install receipt does not bind the installed executable and uninstaller.'
}
if (($ReleaseArtifactBytes -le 0) -or ($ReleaseArtifactSha256 -notmatch '^[0-9A-Fa-f]{64}$') -or
  ($ReleaseArtifactUrl -notmatch '^https://github\.com/jiay98528-dev/PlotFlow/actions/runs/\d+/artifacts/\d+$')) {
  $blockers += 'Official GitHub release artifact provenance is incomplete.'
}
if ($screens.Count -eq 0 -or $screens[0].width -le 0) { $blockers += 'Display resolution could not be collected.' }
if (-not $AllowMissingObs -and -not $obsPath) { $blockers += 'OBS executable is missing.' }
if (-not $AllowExistingProfile -and $existingProfiles.Count -gt 0) { $blockers += 'PlotFlow user profile already exists; uninstall PlotFlow and clear or archive the profile before first-run evidence.' }

$environment = [ordered]@{
  schemaVersion = 2
  collectedAt = (Get-Date).ToUniversalTime().ToString('o')
  pack = $Pack
  revision = $revision
  preflightStatus = if ($blockers.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
  blockers = $blockers
  repository = [ordered]@{ root = $repoRoot; dirty = ($gitStatus.Count -gt 0); status = $gitStatus }
  windows = [ordered]@{
    caption = $os.Caption
    version = $os.Version
    build = $os.BuildNumber
    uiCulture = [Globalization.CultureInfo]::CurrentUICulture.Name
    userLanguages = @((Get-WinUserLanguageList).LanguageTag)
    dpi = $dpi
    scalePercent = if ($dpi) { [math]::Round(($dpi / 96) * 100) } else { $null }
    screens = $screens
  }
  host = [ordered]@{
    manufacturer = $computer.Manufacturer
    model = $computer.Model
    hypervisorPresent = $computer.HypervisorPresent
    user = [Environment]::UserName
  }
  recorder = [ordered]@{ required = (-not $AllowMissingObs); obsPath = $obsPath }
  cleanProfile = [ordered]@{ required = (-not $AllowExistingProfile); existingPaths = $existingProfiles }
  installer = $installerEvidence
  installedExecutable = $installedEvidence
  releaseManifest = [ordered]@{
    path = $releaseManifestEvidence.path
    bytes = $releaseManifestEvidence.bytes
    sha256 = $releaseManifestEvidence.sha256
    installerExpected = $installerExpected
    executableExpected = $unpackedExpected
  }
  releaseArtifact = [ordered]@{
    kind = 'release-binaries'
    url = $ReleaseArtifactUrl
    bytes = $ReleaseArtifactBytes
    sha256 = $ReleaseArtifactSha256.ToUpperInvariant()
    provenance = [ordered]@{
      provider = 'github-actions'
      repository = 'jiay98528-dev/PlotFlow'
      workflowPath = '.github/workflows/release-validation.yml'
      runId = $ReleaseRunId
      runAttempt = $ReleaseRunAttempt
      artifactId = $ReleaseArtifactId
      artifactName = $ReleaseArtifactName
    }
  }
  installReceipt = [ordered]@{ path = 'install-receipt.json'; bytes = $receiptEvidence.Length; sha256 = $receiptHash }
  uninstallEntries = $uninstallEntries
  fileAssociation = $fileAssociation
  registration = [ordered]@{
    valid = $registrationValid
    installedDirectory = $installedDirectory
    matchingUninstallEntries = $matchingUninstallEntries
    associationExecutable = $associationExecutable
    iconExecutable = $iconExecutable
    uninstaller = $uninstallerEvidence
    receiptSha256 = $receiptHash
    receipt = [ordered]@{
      installRoot = $receiptDocument.installRoot
      executableSha256 = $receiptDocument.executableSha256
      uninstallerSha256 = $receiptDocument.uninstallerSha256
    }
  }
}

$jsonPath = Join-Path $evidenceDir 'environment.json'
$markdownPath = Join-Path $evidenceDir 'environment.md'
$environment | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $jsonPath -Encoding utf8
@"
# PlotFlow External Review Environment

- Pack: $Pack
- Revision: $revision
- Preflight: $($environment.preflightStatus)
- Windows: $($os.Caption) $($os.Version) build $($os.BuildNumber)
- UI culture: $([Globalization.CultureInfo]::CurrentUICulture.Name)
- DPI/scale: $dpi / $($environment.windows.scalePercent)%
- Host: $($computer.Manufacturer) $($computer.Model); hypervisor=$($computer.HypervisorPresent)
- OBS: $(if ($obsPath) { $obsPath } else { '<missing>' })
- Installer SHA256: $($installerEvidence.sha256)
- Installed EXE SHA256: $($installedEvidence.sha256)
- Authenticode: $($installedEvidence.authenticode)
- Uninstall entries: $($uninstallEntries.Count)
- Existing profiles: $($existingProfiles.Count)

## Blockers

$(if ($blockers.Count) { ($blockers | ForEach-Object { "- $_" }) -join [Environment]::NewLine } else { '- None' })
"@ | Set-Content -LiteralPath $markdownPath -Encoding utf8

Write-Output "EVIDENCE_DIR=$evidenceDir"
Write-Output "PREFLIGHT_STATUS=$($environment.preflightStatus)"
if ($blockers.Count -gt 0) {
  $blockers | ForEach-Object { [Console]::Error.WriteLine($_) }
  exit 2
}
