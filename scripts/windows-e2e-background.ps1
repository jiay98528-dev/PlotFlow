param(
  [string]$Grep = '.',
  [switch]$UpdateSnapshots,
  [switch]$Child,
  [string]$DesktopName = '',
  [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot

# No SwitchDesktop, SendInput or global keyboard API is used. This runner is
# restricted to the CDP-based integration suite, not native-dialog blackbox.
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class FableviaTestDesktop {
  public delegate bool WindowCallback(IntPtr window, IntPtr data);
  [DllImport("user32.dll")]
  public static extern bool EnumDesktopWindows(IntPtr desktop, WindowCallback callback, IntPtr data);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  public static uint[] WindowProcesses(IntPtr desktop) {
    var ids = new System.Collections.Generic.HashSet<uint>();
    EnumDesktopWindows(desktop, (window, data) => {
      uint process; GetWindowThreadProcessId(window, out process); ids.Add(process); return true;
    }, IntPtr.Zero);
    return new System.Collections.Generic.List<uint>(ids).ToArray();
  }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct StartupInfo {
    public int cb; public string reserved; public string desktop; public string title;
    public uint x, y, width, height, xChars, yChars, fill, flags;
    public ushort show, reservedSize; public IntPtr reservedBytes, stdin, stdout, stderr;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct ProcessInfo {
    public IntPtr process, thread; public uint processId, threadId;
  }
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern IntPtr CreateDesktop(string name, IntPtr device, IntPtr mode, uint flags, uint access, IntPtr security);
  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool CloseDesktop(IntPtr desktop);
  [DllImport("user32.dll")]
  public static extern IntPtr GetThreadDesktop(uint threadId);
  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool GetUserObjectInformation(IntPtr handle, int index, StringBuilder data, uint length, out uint needed);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CreateProcess(string app, StringBuilder command, IntPtr processSecurity, IntPtr threadSecurity, bool inherit, uint flags, IntPtr environment, string directory, ref StartupInfo startup, out ProcessInfo process);
  [DllImport("kernel32.dll")]
  public static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll")]
  public static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll")]
  public static extern bool CloseHandle(IntPtr handle);
  public static string CurrentDesktop() {
    var name = new StringBuilder(256); uint needed;
    if (!GetUserObjectInformation(GetThreadDesktop(GetCurrentThreadId()), 2, name, 512, out needed))
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    return name.ToString();
  }
}
'@

if ($Child) {
  if ($DesktopName -notmatch '^FableviaE2E-[a-f0-9]+$' -or [FableviaTestDesktop]::CurrentDesktop() -ne $DesktopName) {
    throw 'Refusing to launch Electron outside its isolated test desktop.'
  }
  $outputPath = [IO.Path]::GetFullPath($OutputDirectory)
  $temporaryRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot '.tmp')) + [IO.Path]::DirectorySeparatorChar
  if (-not $outputPath.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Test output must stay inside the project .tmp directory.'
  }
  $env:PLOTFLOW_TEST_USER_DATA_DIR = Join-Path $outputPath 'profile'
  New-Item -ItemType Directory -Path $env:PLOTFLOW_TEST_USER_DATA_DIR -Force | Out-Null
  $env:PLOTFLOW_BACKGROUND_DESKTOP = $DesktopName
  $nodePath = (Get-Command node.exe).Source
  $cliPath = & $nodePath -p "require.resolve('@playwright/test/cli', {paths: ['./packages/app']})"
  if ($LASTEXITCODE -ne 0) { throw 'Playwright CLI resolution failed.' }
  $testArgs = @($cliPath, 'test', '--config', 'e2e/playwright.config.ts', '--workers=1', '--output', (Join-Path $outputPath 'results'))
  if ($Grep) { $testArgs += @('--grep', $Grep) }
  Set-Content -LiteralPath (Join-Path $outputPath 'desktop.txt') -Value ([FableviaTestDesktop]::CurrentDesktop()) -Encoding utf8
  Set-Location -LiteralPath (Join-Path $projectRoot 'packages/app')
  [Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
  $OutputEncoding = [Console]::OutputEncoding
  # Native stderr warnings are not PowerShell failures; preserve the real exit code.
  $ErrorActionPreference = 'Continue'
  & $nodePath @testArgs 2>&1 | Out-File -LiteralPath (Join-Path $outputPath 'run.log') -Encoding utf8
  $testExit = $LASTEXITCODE
  Set-Content -LiteralPath (Join-Path $outputPath 'exit-code.txt') -Value $testExit -Encoding utf8
  exit $testExit
}

$DesktopName = 'FableviaE2E-' + [guid]::NewGuid().ToString('N')
$OutputDirectory = Join-Path $projectRoot ('.tmp/background-e2e/' + $DesktopName)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$desktopHandle = [FableviaTestDesktop]::CreateDesktop($DesktopName, [IntPtr]::Zero, [IntPtr]::Zero, 0, 0x00FF, [IntPtr]::Zero)
if ($desktopHandle -eq [IntPtr]::Zero) { throw "CreateDesktop failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
$process = New-Object FableviaTestDesktop+ProcessInfo
try {
  $startup = New-Object FableviaTestDesktop+StartupInfo
  $startup.cb = [Runtime.InteropServices.Marshal]::SizeOf($startup)
  $startup.desktop = 'WinSta0\' + $DesktopName
  $startup.flags = 1
  $startup.show = 0
  $shellPath = (Get-Command node.exe).Source
  $childPath = Join-Path $projectRoot 'scripts/windows-e2e-child.mjs'
  $previousDesktopEnvironment = $env:PLOTFLOW_BACKGROUND_DESKTOP
  $env:PLOTFLOW_BACKGROUND_DESKTOP = $DesktopName
  # Launch Node directly: a second PowerShell host can fail before executing any
  # script on a private desktop. No fallback to the interactive desktop exists.
  $escapedGrep = $Grep.Replace('"', '\"')
  $snapshotMode = if ($UpdateSnapshots) { 'update' } else { 'compare' }
  $command = New-Object Text.StringBuilder ('"' + $shellPath + '" "' + $childPath + '" "' + $DesktopName + '" "' + $OutputDirectory + '" "' + $escapedGrep + '" ' + $snapshotMode)
  if (-not [FableviaTestDesktop]::CreateProcess($shellPath, $command, [IntPtr]::Zero, [IntPtr]::Zero, $false, 0x08000000, [IntPtr]::Zero, $projectRoot, [ref]$startup, [ref]$process)) {
    throw "CreateProcess failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  }
  $env:PLOTFLOW_BACKGROUND_DESKTOP = $previousDesktopEnvironment
  Write-Output "ISOLATED_DESKTOP=$DesktopName"
  Write-Output "OUTPUT_DIRECTORY=$OutputDirectory"
  $deadline = [DateTime]::UtcNow.AddMinutes(20)
  while ([FableviaTestDesktop]::WaitForSingleObject($process.process, 1000) -eq 258) {
    if ([DateTime]::UtcNow -gt $deadline) { throw 'Background E2E exceeded 20 minutes.' }
  }
  [uint32]$result = 0
  [void][FableviaTestDesktop]::GetExitCodeProcess($process.process, [ref]$result)
  $logPath = Join-Path $OutputDirectory 'run.log'
  if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Tail 15 -Encoding utf8 }
  $startupError = Join-Path $OutputDirectory 'startup-error.txt'
  if (Test-Path -LiteralPath $startupError) { Get-Content -LiteralPath $startupError -Encoding utf8 }
  if ($result -eq 0 -and -not (Test-Path -LiteralPath (Join-Path $OutputDirectory 'exit-code.txt'))) {
    throw 'Isolated runner exited without completing a test command.'
  }
  Write-Output "EXIT_CODE=$result"
  if ($result -eq 0) { exit 0 } else { exit 1 }
} finally {
  if ($process.process -ne [IntPtr]::Zero) {
    if ([FableviaTestDesktop]::WaitForSingleObject($process.process, 0) -eq 258) {
      & taskkill.exe /PID $process.processId /T /F | Out-Null
    }
    [void][FableviaTestDesktop]::CloseHandle($process.thread)
    [void][FableviaTestDesktop]::CloseHandle($process.process)
  }
  # A crashed Playwright worker can leave an Electron child behind. Only reap
  # windows on this private desktop; never target the user's Default desktop.
  foreach ($testProcessId in [FableviaTestDesktop]::WindowProcesses($desktopHandle)) {
    & taskkill.exe /PID $testProcessId /T /F 2>$null | Out-Null
  }
  [void][FableviaTestDesktop]::CloseDesktop($desktopHandle)
}
