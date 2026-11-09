import { spawn } from 'node:child_process';
/** Cancels observed native print dialogs only on the isolated hosted candidate runner. */
export function startPdfPrintDialogProbe(pid) {
  if (process.env.GITHUB_ACTIONS !== 'true')
    throw new Error('Native print probe requires isolated hosted CI');
  let executable, args;
  if (process.platform === 'win32') {
    executable = 'powershell.exe';
    const code = String.raw`param([int]$CandidatePid)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$until = [DateTime]::UtcNow.AddSeconds(240)
$round = 0
$lastPreview = ''
while ([DateTime]::UtcNow -lt $until -and $round -lt 2) {
  try {
    $process = Get-Process -Id $CandidatePid -ErrorAction Stop
    $process.Refresh()
    if ($process.MainWindowHandle -ne 0) {
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
      $nodes = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
      $names = @($nodes | ForEach-Object { $_.Current.Name } | Where-Object { $_ } | Select-Object -First 256)
      $cancel = @($nodes | Where-Object { $_.Current.Name -eq 'Cancel' -and $_.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $_.Current.IsEnabled -and -not $_.Current.IsOffscreen } | Select-Object -First 1)
      $expected = if ($round -eq 0) { 2 } else { 4 }
      $preview = @($names | Where-Object { $_ -match 'Total:|PDF document containing' }) -join ';'
      if ($preview -ne $lastPreview) { @{ preview = $preview; expected_pages = $expected; epoch_ms = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() } | ConvertTo-Json -Compress; $lastPreview = $preview }
      $ready = @($names | Where-Object { $_ -match ("PDF document containing " + $expected + " pages") -or $_ -match ("Total: " + $expected + " sheets") }).Count -gt 0
      if ($cancel.Count -eq 1 -and $ready -and -not ($names -contains 'Loading preview')) {
        $pattern = $cancel[0].GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $pattern.Invoke()
        $round++
        @{ round = $round; observed_native_dialog = $true; action = 'cancel'; names = $names; epoch_ms = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() } | ConvertTo-Json -Compress -Depth 3
        Start-Sleep -Milliseconds 750
      }
    }
  } catch { Write-Output (@{diagnostic=$_.Exception.GetType().Name} | ConvertTo-Json -Compress) }
  Start-Sleep -Milliseconds 250
}
`;
    // The script body is fixed; the sole interpolated argument is a validated numeric child PID.
    const encoded = Buffer.from(
      code.replace(
        'param([int]$CandidatePid)',
        '$CandidatePid = ' + String(pid),
      ),
      'utf16le',
    ).toString('base64');
    args = [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-EncodedCommand',
      encoded,
    ];
  } else if (process.platform === 'darwin') {
    executable = 'osascript';
    const code = `set rounds to 0
set iteration to 0
repeat 480 times
  set iteration to iteration + 1
  tell application "System Events"
    set candidates to every process whose unix id is ${pid}
    set printCandidates to every process whose name contains "print"
    set allCandidates to candidates & printCandidates
    repeat with candidate in allCandidates
      tell (contents of candidate)
        repeat with candidateWindow in windows
          if iteration mod 20 is 0 then
            log "NATIVE_PRINT_WINDOW " & (name of candidate) & " / " & (name of candidateWindow) & " buttons=" & (name of every button of candidateWindow)
          end if
          if exists sheet 1 of candidateWindow then
            set printSheet to sheet 1 of candidateWindow
            if exists button "Cancel" of printSheet then
              click button "Cancel" of printSheet
              set rounds to rounds + 1
              log "NATIVE_PRINT_CANCEL " & rounds
            end if
          else if exists button "Cancel" of candidateWindow then
            click button "Cancel" of candidateWindow
            set rounds to rounds + 1
            log "NATIVE_PRINT_CANCEL " & rounds
          end if
        end repeat
      end tell
    end repeat
  end tell
  if rounds is 2 then exit repeat
  delay 0.5
end repeat`;
    args = ['-e', code];
  } else {
    executable = 'python3';
    const code = `import subprocess,time,json
until=time.monotonic()+240
rounds=0
while time.monotonic()<until and rounds<2:
    search=subprocess.run(['xdotool','search','--onlyvisible','--pid','${pid}','--name','^Print$'],capture_output=True,text=True)
    for window in search.stdout.split():
        title=subprocess.run(['xdotool','getwindowname',window],capture_output=True,text=True).stdout.strip()
        if title != 'Print': continue
        subprocess.run(['xdotool','windowfocus','--sync',window],check=True,capture_output=True)
        subprocess.run(['xdotool','key','Escape'],check=True,capture_output=True)
        closed=False
        for attempt in range(20):
            visible=subprocess.run(['xdotool','search','--onlyvisible','--pid','${pid}','--name','^Print$'],capture_output=True,text=True).stdout.split()
            if window not in visible: closed=True;break
            time.sleep(0.1)
        if not closed: raise RuntimeError('Observed print dialog did not close after native Escape')
        rounds+=1
        print(json.dumps({'round':rounds,'observed_native_dialog':True,'title':title,'action':'cancel'}),flush=True)
        time.sleep(0.75)
        break
    time.sleep(0.25)`;
    args = ['-u', '-c', code];
  }
  return spawn(executable, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
