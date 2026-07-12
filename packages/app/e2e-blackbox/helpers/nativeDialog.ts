import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface NativeDialogOptions {
  readonly filePath: string;
  readonly timeoutMs?: number;
  readonly buttonPattern?: string;
  readonly mode?: 'save' | 'open';
}

export interface NativeDialogResult {
  readonly status: 'submitted';
  readonly mode: 'save' | 'open';
  readonly filePath: string;
  readonly valueVerified: boolean;
  readonly dialogClosed: boolean;
}

export async function completeNativeFileDialog(options: NativeDialogOptions): Promise<NativeDialogResult> {
  if (process.platform !== 'win32') {
    throw new Error('Native dialog automation is only implemented for Windows.');
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  const buttonPattern = options.buttonPattern
    ?? 'Save|Open|Select|Export|OK|\u4fdd\u5b58|\u6253\u5f00|\u9009\u62e9|\u5bfc\u51fa|\u78ba\u5b9a|\u4fdd\u5b58\u3059\u308b|\uc800\uc7a5';
  const mode = options.mode ?? 'save';
const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PlotFlowNativeWindow {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
$deadline = [DateTime]::UtcNow.AddMilliseconds(${timeoutMs})
$filePath = @'
${options.filePath}
'@
$buttonPattern = '${buttonPattern}'
$dialogMode = '${mode}'

function Find-Dialog {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $fileNameHostCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
    'FileNameControlHost'
  )
  $editCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Edit
  )

  $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($window in $windows) {
    if ($window.Current.ControlType -ne [System.Windows.Automation.ControlType]::Window) {
      continue
    }
    if ($window.Current.ClassName -ne '#32770' -and $window.Current.Name -notmatch 'Save|Open|Select|Export') {
      continue
    }
    $fileNameHost = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $fileNameHostCondition)
    $edit = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $editCondition)
    if ($fileNameHost -ne $null -or $edit -ne $null) {
      return $window
    }
  }
  return $null
}

function Dump-Windows {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  $lines = @()
  $count = 0
  foreach ($window in $all) {
    if ($window.Current.ControlType -ne [System.Windows.Automation.ControlType]::Window) {
      continue
    }
    $lines += ($window.Current.Name + ' | ' + $window.Current.ClassName + ' | ' + $window.Current.AutomationId + ' | ' + $window.Current.ControlType.ProgrammaticName + ' | offscreen=' + $window.Current.IsOffscreen + ' | handle=' + $window.Current.NativeWindowHandle)
    $count++
    if ($window.Current.ClassName -eq '#32770' -or $window.Current.Name -match 'Save|Open|Select|Export|PlotFlow') {
      $children = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
      $childCount = 0
      foreach ($item in $children) {
        if ($item.Current.ClassName -eq '#32770' -or $item.Current.ControlType.ProgrammaticName -match 'Button|Edit|ComboBox|Text') {
          $lines += ('  - ' + $item.Current.Name + ' | ' + $item.Current.ClassName + ' | ' + $item.Current.AutomationId + ' | ' + $item.Current.ControlType.ProgrammaticName + ' | offscreen=' + $item.Current.IsOffscreen)
          $childCount++
          if ($childCount -ge 80) {
            $lines += '  - ... child dump truncated'
            break
          }
        }
      }
    }
    if ($count -ge 80) {
      $lines += '... top-level window dump truncated'
      break
    }
  }
  return ($lines -join [Environment]::NewLine)
}

function Find-FileNameEdit($dialog) {
  $fileNameHostCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
    'FileNameControlHost'
  )
  $fileNameHost = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $fileNameHostCondition)
  if ($fileNameHost -ne $null) {
    $hostItems = $fileNameHost.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($item in $hostItems) {
      if ($item.Current.ClassName -eq 'Edit' -or $item.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit) {
        return $item
      }
    }
  }

  $edits = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $candidates = @()
  foreach ($edit in $edits) {
    if ($edit.Current.ClassName -eq 'Edit' -or $edit.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit) {
      $rect = $edit.Current.BoundingRectangle
      if ($rect.Width -gt 80 -and $rect.Height -gt 10) {
        $candidates += [PSCustomObject]@{
          Element = $edit
          Top = $rect.Top
          Left = $rect.Left
          Width = $rect.Width
          Name = $edit.Current.Name
          AutomationId = $edit.Current.AutomationId
        }
      }
    }
  }
  $candidate = $candidates | Sort-Object -Property Top, Width -Descending | Select-Object -First 1
  if ($candidate -eq $null) {
    return $null
  }
  return $candidate.Element
}

function Set-ClipboardText($text) {
  for ($i = 0; $i -lt 10; $i++) {
    try {
      [System.Windows.Forms.Clipboard]::SetText($text)
      return
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  throw 'Unable to set clipboard text for native dialog.'
}

function Set-EditText($edit, $text) {
  try {
    $valuePattern = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    if ($valuePattern -ne $null) {
      $valuePattern.SetValue($text)
      return $true
    }
  } catch {
  }

  try {
    $edit.SetFocus()
    Set-ClipboardText $text
    Start-Sleep -Milliseconds 80
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    return $true
  } catch {
    return $false
  }
}

function Get-EditText($edit) {
  try {
    $valuePattern = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    if ($valuePattern -ne $null) {
      return $valuePattern.Current.Value
    }
  } catch {
  }
  return $null
}

function Complete-Dialog($path) {
  [PSCustomObject]@{
    status = 'submitted'
    mode = $dialogMode
    filePath = $path
    valueVerified = $true
    dialogClosed = $true
  } | ConvertTo-Json -Compress
  exit 0
}

function Submit-Dialog($dialog, $buttonPattern) {
  $buttons = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($button in $buttons) {
    if ($button.Current.AutomationId -eq '1' -or ($button.Current.ClassName -eq 'Button' -and $button.Current.Name -match $buttonPattern)) {
      try {
        $invokePattern = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        if ($invokePattern -ne $null) {
          $invokePattern.Invoke()
          return $true
        }
      } catch {
      }

      try {
        $button.SetFocus()
        [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
        return $true
      } catch {
      }
    }
  }
  return $false
}

function Test-DialogVisible($dialog) {
  try {
    $null = $dialog.Current.Name
    return ($dialog.Current.IsOffscreen -eq $false)
  } catch {
    return $false
  }
}

function Wait-DialogSubmitted($dialog, $path) {
  $submitDeadline = [DateTime]::UtcNow.AddMilliseconds(5000)
  while ([DateTime]::UtcNow -lt $submitDeadline) {
    if ($dialogMode -eq 'save' -and (Test-Path -LiteralPath $path)) {
      return $true
    }
    if (-not (Test-DialogVisible $dialog)) {
      return $true
    }
    Start-Sleep -Milliseconds 100
  }
  return $false
}

    while ([DateTime]::UtcNow -lt $deadline) {
      $dialog = Find-Dialog
      if ($dialog -ne $null) {
        $edit = Find-FileNameEdit $dialog
        if ($edit -eq $null) {
          Start-Sleep -Milliseconds 150
          continue
        }
        [PlotFlowNativeWindow]::SetForegroundWindow([IntPtr]$dialog.Current.NativeWindowHandle) | Out-Null
    if (-not (Set-EditText $edit $filePath)) {
      throw 'Unable to set native file dialog path.'
    }
    $actualValue = Get-EditText $edit
    if ($actualValue -ne $filePath) {
      throw ('Native file dialog path verification failed. Expected: ' + $filePath + '; actual: ' + $actualValue + [Environment]::NewLine + (Dump-Windows))
    }
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    if (Wait-DialogSubmitted $dialog $filePath) {
      Complete-Dialog $filePath
    }

        if (Submit-Dialog $dialog $buttonPattern) {
          if (Wait-DialogSubmitted $dialog $filePath) {
            Complete-Dialog $filePath
          }
        }
        throw ('Native file dialog did not submit.' + [Environment]::NewLine + (Dump-Windows))
      }
      Start-Sleep -Milliseconds 150
    }
    throw ('Native file dialog not found.' + [Environment]::NewLine + (Dump-Windows))
`;

  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      timeout: timeoutMs + 5_000,
      windowsHide: true,
    });
    const result = JSON.parse(stdout.trim()) as NativeDialogResult;
    if (
      result.status !== 'submitted'
      || result.mode !== mode
      || result.filePath !== options.filePath
      || !result.valueVerified
      || !result.dialogClosed
    ) {
      throw new Error(`Native file dialog returned an invalid result: ${stdout}`);
    }
    return result;
  } catch (error) {
    const detail = error as {
      code?: number | string;
      killed?: boolean;
      signal?: string | null;
      stdout?: string;
      stderr?: string;
    };
    throw new Error(
      [
        'Native file dialog automation failed.',
        detail.code !== undefined ? `exit code: ${detail.code}` : '',
        detail.killed ? 'process killed by timeout' : '',
        detail.signal ? `signal: ${detail.signal}` : '',
        detail.stdout ? `stdout:\n${detail.stdout}` : '',
        detail.stderr ? `stderr:\n${detail.stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}
