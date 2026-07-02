import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface NativeDialogOptions {
  readonly filePath: string;
  readonly timeoutMs?: number;
  readonly buttonPattern?: string;
}

export async function completeNativeFileDialog(options: NativeDialogOptions): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Native dialog automation is only implemented for Windows.');
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  const buttonPattern = options.buttonPattern
    ?? 'Save|Open|Select|Export|OK|\u4fdd\u5b58|\u6253\u5f00|\u9009\u62e9|\u5bfc\u51fa|\u78ba\u5b9a|\u4fdd\u5b58\u3059\u308b|\uc800\uc7a5';
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

function Find-Dialog {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $classCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty,
    '#32770'
  )
  $fileNameHostCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
    'FileNameControlHost'
  )
  $editCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Edit
  )

  $dialogs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $classCondition)
  foreach ($dialog in $dialogs) {
    if ($dialog.Current.IsOffscreen -eq $true) {
      continue
    }
    $fileNameHost = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $fileNameHostCondition)
    $edit = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $editCondition)
    if ($fileNameHost -ne $null -or $edit -ne $null) {
      return $dialog
    }
  }

  $fileNameHosts = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $fileNameHostCondition)
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  foreach ($host in $fileNameHosts) {
    if ($host.Current.IsOffscreen -eq $true) {
      continue
    }
    $current = $host
    while ($current -ne $null -and $current -ne $root) {
      if ($current.Current.ControlType -eq [System.Windows.Automation.ControlType]::Window) {
        if ($current.Current.ClassName -eq '#32770') {
          return $current
        }
        break
      }
      $current = $walker.GetParent($current)
    }
  }
  return $null
}

function Dump-Windows {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $lines = @()
  foreach ($item in $all) {
    if ($item.Current.ClassName -eq '#32770' -or $item.Current.ControlType.ProgrammaticName -match 'Button|Edit') {
      $lines += ($item.Current.Name + ' | ' + $item.Current.ClassName + ' | ' + $item.Current.AutomationId + ' | ' + $item.Current.ControlType.ProgrammaticName + ' | offscreen=' + $item.Current.IsOffscreen)
    }
  }
  return ($lines -join [Environment]::NewLine)
}

function Find-FileNameEdit($dialog) {
  $fileNameHostCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
    'FileNameControlHost'
  )
  $host = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $fileNameHostCondition)
  if ($host -ne $null -and $host.Current.IsOffscreen -eq $false) {
    $hostItems = $host.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($item in $hostItems) {
      if ($item.Current.IsOffscreen -eq $false -and ($item.Current.ClassName -eq 'Edit' -or $item.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit)) {
        return $item
      }
    }
  }

  $edits = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $candidates = @()
  foreach ($edit in $edits) {
    if ($edit.Current.IsOffscreen -eq $false -and ($edit.Current.ClassName -eq 'Edit' -or $edit.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit)) {
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

function Submit-Dialog($dialog, $buttonPattern) {
  $buttons = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($button in $buttons) {
    if ($button.Current.IsOffscreen -eq $false -and ($button.Current.AutomationId -eq '1' -or ($button.Current.ClassName -eq 'Button' -and $button.Current.Name -match $buttonPattern))) {
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
    if (Test-Path -LiteralPath $path) {
      return $true
    }
    if (-not (Test-DialogVisible $dialog)) {
      return $true
    }
    Start-Sleep -Milliseconds 100
  }
  return $false
}

function Try-BlindSubmit($path) {
  Set-ClipboardText $path
  for ($i = 0; $i -lt 5; $i++) {
    Start-Sleep -Milliseconds 350
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    $submitDeadline = [DateTime]::UtcNow.AddMilliseconds(900)
    while ([DateTime]::UtcNow -lt $submitDeadline) {
      if (Test-Path -LiteralPath $path) {
        return $true
      }
      Start-Sleep -Milliseconds 100
    }
    if (Find-Dialog -ne $null) {
      return $false
    }
  }
  return $false
}

if (Try-BlindSubmit $filePath) {
  exit 0
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
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    if (Wait-DialogSubmitted $dialog $filePath) {
      exit 0
    }

        if (Submit-Dialog $dialog $buttonPattern) {
          if (Wait-DialogSubmitted $dialog $filePath) {
            exit 0
          }
        }
        throw 'Native file dialog did not submit. Visible windows:' + [Environment]::NewLine + (Dump-Windows)
      }
      Start-Sleep -Milliseconds 150
    }
    throw 'Native file dialog not found. Visible windows:' + [Environment]::NewLine + (Dump-Windows)
`;

  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      timeout: timeoutMs + 5_000,
      windowsHide: true,
    });
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      [
        'Native file dialog automation failed.',
        detail.message,
        detail.stdout ? `stdout:\n${detail.stdout}` : '',
        detail.stderr ? `stderr:\n${detail.stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}
