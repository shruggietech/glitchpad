"""Behavioral regression for the real shell runner; run only inside approved Linux."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

RUNNER = Path(__file__).resolve().parents[1] / 'run-android-instrumentation.sh'
class InstrumentationCompletion(unittest.TestCase):
    def run_case(self, outcome):
        with tempfile.TemporaryDirectory(prefix='s047-runner-') as directory:
            root=Path(directory); binary=root/'bin'; binary.mkdir()
            adb=binary/'adb'
            adb.write_text('''#!/usr/bin/env bash
set -eu
if [[ "$*" == *"am instrument"* ]]; then
 count=0; [[ ! -f "$COUNT" ]] || count=$(cat "$COUNT"); count=$((count+1)); echo "$count" > "$COUNT"
 echo 's047_journey_evidence={"journey":1}'
 if [[ "$OUTCOME" == crash || ( "$OUTCOME" == retry && "$count" = 1 ) ]]; then echo 'INSTRUMENTATION_RESULT: shortMsg=Process crashed.'; echo 'INSTRUMENTATION_CODE: 0'; else echo 'OK (1 test)'; echo 'INSTRUMENTATION_CODE: -1'; fi
fi
''',encoding='utf-8'); adb.chmod(0o755)
            sleep=binary/'sleep';sleep.write_text('#!/usr/bin/env bash\nexit 0\n',encoding='utf-8');sleep.chmod(0o755)
            env={**os.environ,'PATH':str(binary)+':'+os.environ['PATH'],'COUNT':str(root/'count'),'OUTCOME':outcome}
            result=subprocess.run(['bash',str(RUNNER),str(root/'task.txt'),'s047_journey_evidence=','-e','waitForActivitiesToComplete','false','-e','s047','true','-e','class','com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#s047ColdAddJourney'],env=env,text=True,capture_output=True,check=False)
            files={p.name:p.read_bytes() for p in root.iterdir() if p.is_file()}
            return result,files
    def test_functional_marker_cannot_hide_crash_and_both_attempts_survive(self):
        result,files=self.run_case('crash')
        self.assertEqual(result.returncode,1,result.stdout+result.stderr)
        self.assertEqual(files['count'].strip(),b'2')
        for attempt in (1,2):
            self.assertIn(b'Process crashed',files[f'task-attempt-{attempt}.txt'])
            self.assertIn(b'instrumentation_failure=1',files[f'task-attempt-{attempt}-status.txt'])
    def test_clean_second_attempt_keeps_failed_first_and_screenshot_failures_are_text(self):
        result,files=self.run_case('retry')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn(b'Process crashed',files['task-attempt-1.txt'])
        self.assertIn(b'junit_success=1',files['task-attempt-2-status.txt'])
        self.assertNotIn('task-attempt-2-s047-row-1.png',files)
        self.assertIn(b'png_signature_valid=false',files['task-attempt-2-s047-row-1-capture-error.txt'])
    def test_first_clean_completion_does_not_spend_second_attempt(self):
        result,files=self.run_case('clean')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(files['count'].strip(),b'1')
        self.assertNotIn('task-attempt-2.txt',files)
    def run_reboot_case(self, fail_reset=False, boot_flag_stays_set=False):
        with tempfile.TemporaryDirectory(prefix='s047-reboot-') as directory:
            root=Path(directory); binary=root/'bin'; binary.mkdir()
            (root/'ready').write_text('1',encoding='utf-8')
            (root/'resets').write_text('0',encoding='utf-8')
            adb=binary/'adb'
            adb.write_text('''#!/usr/bin/env bash
set -eu
if [[ "$*" == "wait-for-device" ]]; then
 touch "$STATE/connected"; exit 0
fi
if [[ "$*" == "shell getprop sys.boot_completed" ]]; then
 if [[ "$BOOT_FLAG_STAYS_SET" = 1 ]]; then echo 1; exit 0; fi
 if [[ -f "$STATE/connected" && "$(cat "$STATE/ready")" = 0 ]]; then
  polls=0; [[ ! -f "$STATE/polls" ]] || polls=$(cat "$STATE/polls")
  polls=$((polls+1)); echo "$polls" > "$STATE/polls"
  if (( polls >= 2 )); then echo 1 > "$STATE/ready"; fi
 fi
 cat "$STATE/ready"; exit 0
fi
if [[ "$*" == "shell pm path "* ]]; then
 if [[ -f "$STATE/connected" && "$(cat "$STATE/ready")" = 0 ]]; then
  polls=0; [[ ! -f "$STATE/package-polls" ]] || polls=$(cat "$STATE/package-polls")
  polls=$((polls+1)); echo "$polls" > "$STATE/package-polls"
  if (( polls >= 2 )); then echo 1 > "$STATE/ready"; fi
 fi
 if [[ "$(cat "$STATE/ready")" = 1 ]]; then echo 'package:/data/app/fixture/base.apk'; exit 0; fi
 echo 'Error: Could not access the Package Manager.' >&2; exit 1
fi
if [[ "$*" == "shell pm clear "* ]]; then
 if [[ "$(cat "$STATE/ready")" != 1 ]]; then
  touch "$STATE/early-clear"; echo 'Error: Could not access the Package Manager.' >&2; exit 1
 fi
 if [[ "$FAIL_RESET" = 1 && -f "$STATE/instrument-count" ]]; then echo Failed; exit 1; fi
 resets=$(cat "$STATE/resets"); echo $((resets+1)) > "$STATE/resets"
 echo Success; exit 0
fi
if [[ "$*" == *"am instrument"* ]]; then
 count=0; [[ ! -f "$STATE/instrument-count" ]] || count=$(cat "$STATE/instrument-count")
 count=$((count+1)); echo "$count" > "$STATE/instrument-count"
 if (( count == 1 )); then
  echo 0 > "$STATE/ready"
  echo 'INSTRUMENTATION_ABORTED: System has crashed.'
 elif [[ "$(cat "$STATE/resets")" = 4 ]]; then
  echo 's047_journey_evidence={"journey":1}'; echo 'OK (1 test)'; echo 'INSTRUMENTATION_CODE: -1'
 else echo 'INSTRUMENTATION_RESULT: shortMsg=Retry inherited uncleared application state.'; echo 'INSTRUMENTATION_CODE: 0'; fi
fi
''',encoding='utf-8'); adb.chmod(0o755)
            sleep=binary/'sleep'; sleep.write_text('#!/usr/bin/env bash\nexit 0\n',encoding='utf-8'); sleep.chmod(0o755)
            env={**os.environ,'PATH':str(binary)+':'+os.environ['PATH'],'STATE':str(root),'FAIL_RESET':'1' if fail_reset else '0','BOOT_FLAG_STAYS_SET':'1' if boot_flag_stays_set else '0','ANDROID_INSTRUMENTATION_RESET_APP_DATA':'true'}
            result=subprocess.run(['bash',str(RUNNER),str(root/'task.txt'),'s047_journey_evidence=','-e','waitForActivitiesToComplete','false','-e','s047','true','-e','class','com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#s047ColdAddJourney'],env=env,text=True,capture_output=True,check=False,timeout=30)
            return result,{p.name:p.read_bytes() for p in root.iterdir() if p.is_file()}
    def test_retry_waits_for_reboot_before_required_package_resets(self):
        result,files=self.run_reboot_case()
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(files['instrument-count'].strip(),b'2')
        self.assertEqual(files['resets'].strip(),b'4')
        self.assertNotIn('early-clear',files)
        self.assertIn(b'System has crashed',files['task-attempt-1.txt'])
        self.assertIn(b'instrumentation_failure=1',files['task-attempt-1-status.txt'])
        self.assertIn(b'junit_success=1',files['task-attempt-2-status.txt'])
    def test_failed_retry_reset_blocks_second_instrumentation(self):
        result,files=self.run_reboot_case(fail_reset=True)
        self.assertNotEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(files['instrument-count'].strip(),b'1')
        self.assertNotIn('task-attempt-2.txt',files)
        self.assertIn(b'phase=reset_application',files['task-attempt-2-setup.txt'])
        self.assertNotIn(b'phase=ready',files['task-attempt-2-setup.txt'])
    def test_retry_does_not_treat_boot_property_as_package_service_readiness(self):
        result,files=self.run_reboot_case(boot_flag_stays_set=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(files['instrument-count'].strip(),b'2')
        self.assertEqual(files['resets'].strip(),b'4')
        self.assertNotIn('early-clear',files)
if __name__ == '__main__': unittest.main()
