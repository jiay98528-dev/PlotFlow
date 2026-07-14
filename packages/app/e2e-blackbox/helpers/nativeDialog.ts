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
  readonly dialogTitle: string;
  readonly processId: number;
}

/**
 * Drives the Windows common file dialog without inspecting or modifying the
 * Electron renderer. Win32 control IDs are used deliberately: broad UIA tree
 * scans can block indefinitely and can select unrelated Explorer dialogs.
 */
export async function completeNativeFileDialog(options: NativeDialogOptions): Promise<NativeDialogResult> {
  if (process.platform !== 'win32') {
    throw new Error('Native dialog automation is only implemented for Windows.');
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  const mode = options.mode ?? 'save';
  const filePathBase64 = Buffer.from(options.filePath, 'utf16le').toString('base64');
  const script = `
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public sealed class PlotFlowDialogInfo {
  public long Handle { get; set; }
  public string Title { get; set; }
  public string ButtonTitle { get; set; }
  public int ProcessId { get; set; }
}

public static class PlotFlowNativeDialog {
  private const uint WM_SETTEXT = 0x000C;
  private const uint WM_GETTEXT = 0x000D;
  private const uint WM_GETTEXTLENGTH = 0x000E;
  private const uint BM_CLICK = 0x00F5;
  private const uint SMTO_ABORTIFHUNG = 0x0002;
  private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")]
  private static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetClassName(IntPtr hWnd, StringBuilder value, int count);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetWindowText(IntPtr hWnd, StringBuilder value, int count);
  [DllImport("user32.dll")]
  private static extern IntPtr GetDlgItem(IntPtr hWnd, int controlId);
  [DllImport("user32.dll")]
  private static extern int GetDlgCtrlID(IntPtr hWnd);
  [DllImport("user32.dll")]
  private static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  private static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")]
  private static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageTimeoutW")]
  private static extern IntPtr SendTextMessageTimeout(
    IntPtr hWnd,
    uint message,
    IntPtr wParam,
    string lParam,
    uint flags,
    uint timeout,
    out IntPtr result);
  [DllImport("user32.dll", EntryPoint = "SendMessageTimeoutW")]
  private static extern IntPtr SendPointerMessageTimeout(
    IntPtr hWnd,
    uint message,
    IntPtr wParam,
    IntPtr lParam,
    uint flags,
    uint timeout,
    out IntPtr result);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageTimeoutW")]
  private static extern IntPtr SendBufferMessageTimeout(
    IntPtr hWnd,
    uint message,
    IntPtr wParam,
    StringBuilder lParam,
    uint flags,
    uint timeout,
    out IntPtr result);

  private static string ReadText(IntPtr hWnd) {
    var value = new StringBuilder(4096);
    GetWindowText(hWnd, value, value.Capacity);
    return value.ToString();
  }

  private static string ReadClass(IntPtr hWnd) {
    var value = new StringBuilder(256);
    GetClassName(hWnd, value, value.Capacity);
    return value.ToString();
  }

  public static PlotFlowDialogInfo[] FindDialogs() {
    var dialogs = new List<PlotFlowDialogInfo>();
    EnumWindows((hWnd, _) => {
      if (!IsWindowVisible(hWnd) || ReadClass(hWnd) != "#32770") return true;
      var submitButton = GetDlgItem(hWnd, 1);
      if (submitButton == IntPtr.Zero || FindFileNameEdit(hWnd.ToInt64()) == 0) return true;
      uint processId;
      GetWindowThreadProcessId(hWnd, out processId);
      dialogs.Add(new PlotFlowDialogInfo {
        Handle = hWnd.ToInt64(),
        Title = ReadText(hWnd),
        ButtonTitle = ReadText(submitButton),
        ProcessId = (int)processId,
      });
      return true;
    }, IntPtr.Zero);
    return dialogs.ToArray();
  }

  public static long FindFileNameEdit(long dialogHandle) {
    var dialog = new IntPtr(dialogHandle);
    var host = GetDlgItem(dialog, 1148);
    IntPtr match = IntPtr.Zero;
    if (host != IntPtr.Zero) {
      EnumChildWindows(host, (child, _) => {
        if (ReadClass(child) == "Edit") {
          match = child;
          return false;
        }
        return true;
      }, IntPtr.Zero);
    }
    if (match == IntPtr.Zero) {
      EnumChildWindows(dialog, (child, _) => {
        var controlId = GetDlgCtrlID(child);
        if (IsWindowVisible(child) && ReadClass(child) == "Edit" && (controlId == 1001 || controlId == 1148)) {
          match = child;
          return false;
        }
        return true;
      }, IntPtr.Zero);
    }
    return match.ToInt64();
  }

  public static bool SetText(long editHandle, string value) {
    IntPtr result;
    return SendTextMessageTimeout(
      new IntPtr(editHandle), WM_SETTEXT, IntPtr.Zero, value,
      SMTO_ABORTIFHUNG, 1000, out result) != IntPtr.Zero;
  }

  public static string GetText(long editHandle) {
    var edit = new IntPtr(editHandle);
    IntPtr length;
    if (SendPointerMessageTimeout(
      edit, WM_GETTEXTLENGTH, IntPtr.Zero, IntPtr.Zero,
      SMTO_ABORTIFHUNG, 1000, out length) == IntPtr.Zero) return null;
    var capacity = Math.Max(length.ToInt32() + 1, 2);
    var value = new StringBuilder(capacity);
    IntPtr copied;
    if (SendBufferMessageTimeout(
      edit, WM_GETTEXT, new IntPtr(capacity), value,
      SMTO_ABORTIFHUNG, 1000, out copied) == IntPtr.Zero) return null;
    return value.ToString();
  }

  public static bool Submit(long dialogHandle) {
    var dialog = new IntPtr(dialogHandle);
    var button = GetDlgItem(dialog, 1);
    if (button == IntPtr.Zero) return false;
    SetForegroundWindow(dialog);
    IntPtr result;
    return SendPointerMessageTimeout(
      button, BM_CLICK, IntPtr.Zero, IntPtr.Zero,
      SMTO_ABORTIFHUNG, 1000, out result) != IntPtr.Zero;
  }

  public static bool Exists(long handle) {
    return IsWindow(new IntPtr(handle));
  }
}
'@

$deadline = [DateTime]::UtcNow.AddMilliseconds(${timeoutMs})
$filePath = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${filePathBase64}'))
$dialogMode = '${mode}'
$lastStage = 'waiting-for-dialog'
$lastCandidates = @()

while ([DateTime]::UtcNow -lt $deadline) {
  $candidates = @([PlotFlowNativeDialog]::FindDialogs() | Where-Object {
    $_.Title -notmatch 'Rename|重命名'
  })
  $lastCandidates = @($candidates | ForEach-Object {
    [PSCustomObject]@{ title = $_.Title; button = $_.ButtonTitle; processId = $_.ProcessId }
  })
  if ($candidates.Count -eq 0) {
    Start-Sleep -Milliseconds 100
    continue
  }

  $ranked = @($candidates | Sort-Object -Descending -Property @{
    Expression = {
      $score = 0
      if ($_.Title -match 'PlotFlow') { $score += 100 }
      if ($dialogMode -eq 'open' -and ($_.Title -match 'Open|打开|開く' -or $_.ButtonTitle -match 'Open|打开|開く')) { $score += 50 }
      if ($dialogMode -eq 'save' -and ($_.Title -match 'Save|保存|另存|Export|导出' -or $_.ButtonTitle -match 'Save|保存|Export|导出')) { $score += 50 }
      $score
    }
  })
  $dialog = $ranked[0]
  $lastStage = 'finding-filename-edit'
  $editHandle = [PlotFlowNativeDialog]::FindFileNameEdit($dialog.Handle)
  if ($editHandle -eq 0) {
    Start-Sleep -Milliseconds 100
    continue
  }

  $lastStage = 'setting-filename'
  if (-not [PlotFlowNativeDialog]::SetText($editHandle, $filePath)) {
    throw 'WM_SETTEXT timed out or failed.'
  }
  Start-Sleep -Milliseconds 100
  $actual = [PlotFlowNativeDialog]::GetText($editHandle)
  if ($actual -ne $filePath) {
    throw ('Filename verification failed. Expected: ' + $filePath + '; actual: ' + $actual)
  }

  $lastStage = 'submitting-dialog'
  if (-not [PlotFlowNativeDialog]::Submit($dialog.Handle)) {
    throw 'BM_CLICK timed out or failed.'
  }

  $lastStage = 'waiting-for-close'
  $closeDeadline = [DateTime]::UtcNow.AddMilliseconds(5000)
  while ([DateTime]::UtcNow -lt $closeDeadline) {
    if (-not [PlotFlowNativeDialog]::Exists($dialog.Handle)) {
      [PSCustomObject]@{
        status = 'submitted'
        mode = $dialogMode
        filePath = $filePath
        valueVerified = $true
        dialogClosed = $true
        dialogTitle = $dialog.Title
        processId = $dialog.ProcessId
      } | ConvertTo-Json -Compress
      exit 0
    }
    Start-Sleep -Milliseconds 100
  }
  throw 'Native file dialog accepted BM_CLICK but did not close.'
}

throw ('Native file dialog automation deadline expired at stage: ' + $lastStage + '; candidates: ' + ($lastCandidates | ConvertTo-Json -Compress))
`;

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: timeoutMs + 5_000, windowsHide: true },
    );
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
