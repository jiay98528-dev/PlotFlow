<#
.SYNOPSIS
  注册 .mdstory 文件关联到 PlotFlow（开发环境手动运行）

.DESCRIPTION
  将 .mdstory 扩展名关联到 PlotFlow 应用，添加 Open 动词并设置文件图标。
  仅需在开发环境中运行一次，或在每次 PlotFlow 可执行文件路径变更后重新运行。
  生产环境打包后，electron-builder 的 NSIS 安装器会自动写入注册表。

  用法:
    .\scripts\register-file-association.ps1 -PlotFlowExe "D:\path\to\PlotFlow.exe"

  如果不指定 -PlotFlowExe，脚本会尝试自动检测:
    1. 当前项目 packages/app 目录下的 electron 可执行文件
    2. electron-builder 打包产物 release/ 目录中的 PlotFlow.exe

.NOTES
  必须以管理员身份运行（修改注册表需要管理员权限）。
  仅适用于 Windows。macOS/Linux 的文件关联通过 electron-builder 配置处理。

  关联原理:
    HKEY_CLASSES_ROOT\.mdstory
      (Default) = "PlotFlow.Story"
    HKEY_CLASSES_ROOT\PlotFlow.Story
      (Default)  = "PlotFlow Story"
      DefaultIcon → [exe path],1
      shell\open\command → "[exe path]" "%1"
#>

param(
  [Parameter(Mandatory = $false)]
  [string]$PlotFlowExe = ""
)

# ── 提升管理员权限 ──
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Warning "需要管理员权限才能修改注册表。请以管理员身份重新运行此脚本。"
  Write-Host "右键点击 PowerShell → 以管理员身份运行，然后重试。" -ForegroundColor Yellow
  exit 1
}

# ── 自动检测 PlotFlow 可执行文件路径 ──
if (-not $PlotFlowExe) {
  # 尝试 1: electron-builder 打包产物
  $candidates = @(
    (Join-Path $PSScriptRoot "..\release\win-unpacked\PlotFlow.exe"),
    (Join-Path $PSScriptRoot "..\release\PlotFlow Setup *.exe")
  )

  foreach ($pattern in $candidates) {
    $matches = Resolve-Path $pattern -ErrorAction SilentlyContinue
    if ($matches) {
      $PlotFlowExe = $matches[-1].Path
      Write-Host "自动检测到 PlotFlow: $PlotFlowExe" -ForegroundColor Green
      break
    }
  }

  # 尝试 2: 开发模式 electron 可执行文件
  if (-not $PlotFlowExe) {
    $devCandidates = @(
      "..\packages\app\node_modules\.bin\electron.cmd",
      "..\packages\app\node_modules\electron\dist\electron.exe"
    )
    foreach ($path in $devCandidates) {
      $fullPath = Join-Path $PSScriptRoot $path
      if (Test-Path $fullPath) {
        $PlotFlowExe = (Resolve-Path $fullPath).Path
        Write-Host "自动检测到开发模式 Electron: $PlotFlowExe" -ForegroundColor Green
        break
      }
    }
  }

  if (-not $PlotFlowExe) {
    Write-Error "未找到 PlotFlow 可执行文件。请指定 -PlotFlowExe 参数。"
    Write-Host "用法: .\scripts\register-file-association.ps1 -PlotFlowExe `"D:\path\to\PlotFlow.exe`"" -ForegroundColor Yellow
    exit 1
  }
}

if (-not (Test-Path $PlotFlowExe)) {
  Write-Error "指定的路径不存在: $PlotFlowExe"
  exit 1
}

$PlotFlowExe = (Resolve-Path $PlotFlowExe).Path

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  PlotFlow .mdstory 文件关联注册" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "目标可执行文件: $PlotFlowExe" -ForegroundColor Gray
Write-Host ""

# ── 注册表键路径 ──
$extKey   = "HKCR:\.mdstory"
$progKey  = "HKCR:\PlotFlow.Story"
$iconKey  = "HKCR:\PlotFlow.Story\DefaultIcon"
$cmdKey   = "HKCR:\PlotFlow.Story\shell\open\command"
$appKey   = "HKCR:\Applications\PlotFlow.exe\SupportedTypes"

# ── 1. 注册 .mdstory 扩展名 ──
Write-Host "[1/4] 注册 .mdstory 扩展名关联 ..." -ForegroundColor Yellow
if (-not (Test-Path $extKey)) {
  New-Item -Path $extKey -Force | Out-Null
}
Set-ItemProperty -Path $extKey -Name "(Default)" -Value "PlotFlow.Story"
Write-Host "  ✓ HKEY_CLASSES_ROOT\.mdstory → PlotFlow.Story" -ForegroundColor Green

# ── 2. 注册 ProgID ──
Write-Host "[2/4] 注册 PlotFlow.Story ProgID ..." -ForegroundColor Yellow
if (-not (Test-Path $progKey)) {
  New-Item -Path $progKey -Force | Out-Null
}
Set-ItemProperty -Path $progKey -Name "(Default)" -Value "PlotFlow Story"
Set-ItemProperty -Path $progKey -Name "FriendlyTypeName" -Value "PlotFlow 叙事分支文件"
Write-Host "  ✓ HKEY_CLASSES_ROOT\PlotFlow.Story" -ForegroundColor Green

# ── 3. 注册文件图标 ──
Write-Host "[3/4] 设置文件图标 ..." -ForegroundColor Yellow
if (-not (Test-Path $iconKey)) {
  New-Item -Path $iconKey -Force | Out-Null
}
Set-ItemProperty -Path $iconKey -Name "(Default)" -Value "$PlotFlowExe,0"
Write-Host "  ✓ 图标: $PlotFlowExe,0" -ForegroundColor Green

# ── 4. 注册 Open 动词 ──
Write-Host "[4/4] 注册 Open 动词 ..." -ForegroundColor Yellow
if (-not (Test-Path $cmdKey)) {
  New-Item -Path $cmdKey -Force | Out-Null
}
Set-ItemProperty -Path $cmdKey -Name "(Default)" -Value "`"$PlotFlowExe`" `"%1`""
Write-Host "  ✓ Open 命令: `"$PlotFlowExe`" `"%1`"" -ForegroundColor Green

# ── 5. 注册为 .mdstory 的受支持应用 ──
if (-not (Test-Path $appKey)) {
  New-Item -Path "$appKey" -Force | Out-Null
}
Set-ItemProperty -Path "$appKey" -Name ".mdstory" -Value ""

# ── 通知系统刷新 ──
Write-Host ""
Write-Host "通知 Shell 刷新文件关联 ..." -ForegroundColor Yellow
Start-Process -FilePath "rundll32.exe" -ArgumentList "shell32.dll,SHChangeNotify_RunDLL 0x08000000,0,0,0" -NoNewWindow -Wait
Write-Host "  ✓ Shell 刷新完成" -ForegroundColor Green

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  ✅ 注册完成！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "现在可以双击任意 .mdstory 文件用 PlotFlow 打开了。" -ForegroundColor White
Write-Host "如要验证，右键 .mdstory 文件 → 属性，查看"打开方式"是否已关联。" -ForegroundColor Gray
Write-Host ""
Write-Host "卸载关联（需要管理员权限）:" -ForegroundColor DarkGray
Write-Host "  Remove-Item -Path $extKey -Recurse -ErrorAction SilentlyContinue" -ForegroundColor DarkGray
Write-Host "  Remove-Item -Path $progKey -Recurse -ErrorAction SilentlyContinue" -ForegroundColor DarkGray
