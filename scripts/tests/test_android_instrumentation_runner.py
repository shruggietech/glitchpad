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
if __name__ == '__main__': unittest.main()
