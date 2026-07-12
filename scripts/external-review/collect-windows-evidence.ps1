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

  [string]$EvidenceRoot = 'test-results/external-review',
  [switch]$AllowExistingProfile,
  [switch]$AllowMissingObs
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installedExe = (Resolve-Path -LiteralPath $InstalledExePath).Path
$releaseManifest = (Resolve-Path -LiteralPath $ReleaseManifestPath).Path
$revision = (& git -C $repoRoot rev-parse HEAD).Trim()
$gitStatus = @(& git -C $repoRoot status --porcelain=v1 --untracked-files=no)
$evidenceDir = [IO.Path]::GetFullPath((Join-Path $repoRoot (Join-Path $EvidenceRoot (Join-Path $revision $Pack))))
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null

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

$blockers = @()
if ($gitStatus.Count -gt 0) { $blockers += 'Git worktree is not clean.' }
if (-not $installerExpected) { $blockers += 'Installer is missing from SHA256SUMS.txt.' }
elseif ($installerExpected -ne $installerEvidence.sha256) { $blockers += 'Installer SHA256 does not match SHA256SUMS.txt.' }
if (-not $unpackedExpected) { $blockers += 'win-unpacked/PlotFlow.exe is missing from SHA256SUMS.txt.' }
elseif ($unpackedExpected -ne $installedEvidence.sha256) { $blockers += 'Installed executable does not match the packaged executable.' }
if ($uninstallEntries.Count -eq 0) { $blockers += 'PlotFlow uninstall registration is missing.' }
if (-not $fileAssociation.extensionClass) { $blockers += '.mdstory file association is missing.' }
if (-not $fileAssociation.icon) { $blockers += '.mdstory file association icon is missing.' }
if ($screens.Count -eq 0 -or $screens[0].width -le 0) { $blockers += 'Display resolution could not be collected.' }
if (-not $AllowMissingObs -and -not $obsPath) { $blockers += 'OBS executable is missing.' }
if (-not $AllowExistingProfile -and $existingProfiles.Count -gt 0) { $blockers += 'PlotFlow user profile already exists; restore the clean VM snapshot.' }

$environment = [ordered]@{
  schemaVersion = 1
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
  releaseManifest = [ordered]@{ path = $releaseManifest; installerExpected = $installerExpected; executableExpected = $unpackedExpected }
  uninstallEntries = $uninstallEntries
  fileAssociation = $fileAssociation
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
