[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Install', 'Cleanup')]
  [string]$Mode,
  [Parameter(Mandatory = $true)]
  [string]$InstallDir,
  [Parameter(Mandatory = $true)]
  [string]$AllowedRoot,
  [string]$InstallerPath,
  [string]$ExpectedExecutableHash,
  [string]$ReceiptPath,
  [string]$ExpectedReceiptHash
)

$ErrorActionPreference = 'Stop'
$expectedProductGuid = '74fc8b73-b58d-5573-82e7-75efc9ec526f'
$installRoot = [IO.Path]::GetFullPath($InstallDir).TrimEnd('\')
$allowedRootPath = [IO.Path]::GetFullPath($AllowedRoot).TrimEnd('\')
if ([string]::IsNullOrWhiteSpace($installRoot) -or [IO.Path]::GetPathRoot($installRoot) -eq $installRoot) {
  throw 'InstallDir must be a non-root absolute directory.'
}
if (-not $installRoot.StartsWith("$allowedRootPath\", [StringComparison]::OrdinalIgnoreCase)) {
  throw 'InstallDir must stay inside the explicitly allowed runner directory.'
}

function Test-PathInside([string]$Candidate, [string]$Root) {
  $candidatePath = [IO.Path]::GetFullPath($Candidate).TrimEnd('\')
  $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\')
  return $candidatePath.Equals($rootPath, [StringComparison]::OrdinalIgnoreCase) -or
    $candidatePath.StartsWith("$rootPath\", [StringComparison]::OrdinalIgnoreCase)
}

function Assert-NoReparsePoint([string]$Candidate) {
  $cursor = [IO.Path]::GetFullPath($Candidate)
  while ($cursor -and (Test-Path -LiteralPath $cursor)) {
    $item = Get-Item -LiteralPath $cursor -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Refusing a reparse-point install path: $cursor"
    }
    $parent = [IO.Directory]::GetParent($cursor)
    if (-not $parent) { break }
    $cursor = $parent.FullName
  }
}

function Get-PlotFlowUninstallEntries {
  @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
  ) | ForEach-Object {
    Get-ItemProperty $_ -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'PlotFlow' }
  }
}

function Split-NativeCommand([string]$Command) {
  if ($Command -match '^\s*"([^"]+)"\s*(.*)$') { return @($Matches[1], $Matches[2]) }
  if ($Command -match '^\s*([^\s]+\.exe)\s*(.*)$') { return @($Matches[1], $Matches[2]) }
  throw 'Registered uninstall command is malformed.'
}

function Resolve-ValidatedUninstallEntry($Entry, [switch]$RequireInstallLocation) {
  if ($Entry.PSChildName -notin @($expectedProductGuid, "${expectedProductGuid}_is1")) {
    throw "Refusing an unknown PlotFlow uninstall registration: $($Entry.PSPath)"
  }
  $command = if ($Entry.QuietUninstallString) { $Entry.QuietUninstallString } else { $Entry.UninstallString }
  $parts = Split-NativeCommand $command
  $uninstaller = [IO.Path]::GetFullPath($parts[0])
  if ($RequireInstallLocation -and (
      [string]::IsNullOrWhiteSpace($Entry.InstallLocation) -or
      -not [IO.Path]::IsPathRooted($Entry.InstallLocation)
    )) {
    throw 'PlotFlow uninstall registration has no absolute InstallLocation.'
  }
  $registeredRoot = if ([string]::IsNullOrWhiteSpace($Entry.InstallLocation)) {
    [IO.Path]::GetDirectoryName($uninstaller)
  } else {
    [IO.Path]::GetFullPath($Entry.InstallLocation).TrimEnd('\')
  }
  if (
    -not (Test-PathInside $uninstaller $registeredRoot) -or
    -not (Test-Path -LiteralPath $uninstaller -PathType Leaf) -or
    [IO.Path]::GetFileName($uninstaller) -notmatch '^Uninstall.*\.exe$'
  ) {
    throw 'PlotFlow uninstall command is not bound to its registered installation.'
  }
  return [PSCustomObject]@{ Root = $registeredRoot; Executable = $uninstaller; Arguments = $parts[1] }
}

function Invoke-UninstallEntry($ValidatedEntry) {
  $arguments = $ValidatedEntry.Arguments
  if ($arguments -notmatch '(^|\s)/S($|\s)') { $arguments = "$arguments /S".Trim() }
  $process = Start-Process -FilePath $ValidatedEntry.Executable -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
  if ($process.ExitCode -ne 0) { throw "PlotFlow uninstaller exited with $($process.ExitCode)." }
}

if ($Mode -eq 'Cleanup') {
  if (-not $ReceiptPath -or -not $ExpectedReceiptHash) { throw 'Cleanup requires the same-run receipt path and SHA256.' }
  $receiptFile = (Resolve-Path -LiteralPath $ReceiptPath).Path
  if (-not (Test-PathInside $receiptFile $allowedRootPath)) { throw 'Install receipt must stay inside AllowedRoot.' }
  Assert-NoReparsePoint $receiptFile
  $receiptHash = (Get-FileHash -LiteralPath $receiptFile -Algorithm SHA256).Hash
  if ($receiptHash -ne $ExpectedReceiptHash.ToUpperInvariant()) { throw 'Install receipt hash mismatch.' }
  $receipt = Get-Content -LiteralPath $receiptFile -Raw | ConvertFrom-Json
  if ($receipt.schemaVersion -ne 2 -or -not $receipt.installRoot.Equals($installRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Install receipt does not belong to this InstallDir.'
  }
  $registeredEntries = @(Get-PlotFlowUninstallEntries | ForEach-Object { Resolve-ValidatedUninstallEntry $_ -RequireInstallLocation })
  if ($registeredEntries.Count -ne 1 -or -not $registeredEntries[0].Root.Equals($installRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Cleanup requires one exact same-run PlotFlow registration.'
  }
  $entry = $registeredEntries[0]
  Assert-NoReparsePoint $entry.Root
  Assert-NoReparsePoint $entry.Executable
  $currentUninstallerHash = (Get-FileHash -LiteralPath $entry.Executable -Algorithm SHA256).Hash
  if ((-not $entry.Executable.Equals($receipt.uninstallerPath, [StringComparison]::OrdinalIgnoreCase)) -or
    ($currentUninstallerHash -ne $receipt.uninstallerSha256)) {
    throw 'Registered uninstaller does not match the same-run receipt.'
  }
  $installedExe = Join-Path $installRoot 'PlotFlow.exe'
  $installedExists = Test-Path -LiteralPath $installedExe -PathType Leaf
  $currentExecutableHash = if ($installedExists) { (Get-FileHash -LiteralPath $installedExe -Algorithm SHA256).Hash } else { $null }
  if ((-not $installedExists) -or ($currentExecutableHash -ne $receipt.executableSha256)) {
    throw 'Installed executable does not match the same-run receipt.'
  }
  foreach ($running in @(Get-Process -Name PlotFlow -ErrorAction SilentlyContinue)) {
    if (-not $running.Path -or -not (Test-PathInside $running.Path $installRoot)) {
      throw "Refusing to terminate an unverified PlotFlow process: PID $($running.Id)"
    }
    Stop-Process -Id $running.Id -Force
  }
  Invoke-UninstallEntry $entry
  $deadline = (Get-Date).AddSeconds(30)
  while (((Get-PlotFlowUninstallEntries).Count -gt 0 -or (Test-Path -LiteralPath $installRoot)) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if ((Get-PlotFlowUninstallEntries).Count -gt 0) { throw 'Stale PlotFlow uninstall registration remains after silent uninstall.' }
  if (Test-Path -LiteralPath $installRoot) { throw "Installed files remain after cleanup: $installRoot" }
  $class = (Get-ItemProperty 'Registry::HKEY_CLASSES_ROOT\.mdstory' -ErrorAction SilentlyContinue).'(default)'
  if ($class) { throw '.mdstory file association remains after cleanup.' }
  Write-Output 'CLEANUP_COMPLETE=true'
  exit 0
}

if (-not $InstallerPath -or -not $ReceiptPath) { throw 'InstallerPath and ReceiptPath are required for Install mode.' }
if (@(Get-PlotFlowUninstallEntries).Count -gt 0) { throw 'Install mode refuses all pre-existing PlotFlow uninstall registrations.' }
if (@(Get-Process -Name PlotFlow -ErrorAction SilentlyContinue).Count -gt 0) { throw 'Install mode refuses all pre-existing PlotFlow processes.' }
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$receiptFile = [IO.Path]::GetFullPath($ReceiptPath)
if (-not (Test-PathInside $receiptFile $allowedRootPath) -or (Test-PathInside $receiptFile $installRoot)) {
  throw 'ReceiptPath must stay inside AllowedRoot and outside InstallDir.'
}
Assert-NoReparsePoint $allowedRootPath
Assert-NoReparsePoint $installRoot
Assert-NoReparsePoint ([IO.Path]::GetDirectoryName($receiptFile))
if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
$process = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installRoot") -Wait -PassThru -WindowStyle Hidden
if ($process.ExitCode -ne 0) { throw "PlotFlow installer exited with $($process.ExitCode)." }
$installedExe = Join-Path $installRoot 'PlotFlow.exe'
if (-not (Test-Path -LiteralPath $installedExe -PathType Leaf)) { throw "Installer did not create $installedExe" }
$actualHash = (Get-FileHash -LiteralPath $installedExe -Algorithm SHA256).Hash
if ($ExpectedExecutableHash -and $actualHash -ne $ExpectedExecutableHash.ToUpperInvariant()) {
  throw 'Installed executable does not match the same-run packaged executable.'
}
$installedEntries = @(Get-PlotFlowUninstallEntries | ForEach-Object { Resolve-ValidatedUninstallEntry $_ -RequireInstallLocation })
if ($installedEntries.Count -ne 1 -or -not $installedEntries[0].Root.Equals($installRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Installed registration is not uniquely bound to the requested installation directory.'
}
$uninstaller = $installedEntries[0].Executable
Assert-NoReparsePoint $uninstaller
$receipt = [ordered]@{
  schemaVersion = 2
  createdAt = (Get-Date).ToUniversalTime().ToString('o')
  installRoot = $installRoot
  executablePath = $installedExe
  executableSha256 = $actualHash
  uninstallerPath = $uninstaller
  uninstallerSha256 = (Get-FileHash -LiteralPath $uninstaller -Algorithm SHA256).Hash
  registrationId = $expectedProductGuid
}
$receipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $receiptFile -Encoding utf8
$receiptHash = (Get-FileHash -LiteralPath $receiptFile -Algorithm SHA256).Hash
Write-Output "INSTALLED_EXE=$installedExe"
Write-Output "INSTALLED_EXE_SHA256=$actualHash"
Write-Output "INSTALL_RECEIPT=$receiptFile"
Write-Output "INSTALL_RECEIPT_SHA256=$receiptHash"
