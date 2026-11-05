"""Exercise S047 scheduling and cleanup through the real campaign entry point."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

CAMPAIGN = Path(__file__).resolve().parents[1] / 'run-android-s047-journeys.sh'
class JourneyCampaign(unittest.TestCase):
    def run_case(self, role='ordinary', api=24, fail=''):
        with tempfile.TemporaryDirectory(prefix='s047-campaign-') as directory:
            root=Path(directory); binary=root/'bin'; binary.mkdir()
            shutil.copyfile(CAMPAIGN,root/'run-android-s047-journeys.sh')
            (root/'run-android-instrumentation.sh').write_text('''#!/usr/bin/env bash
set -eu
echo "$*" >> "$CALLS"
if [[ -n "$FAIL" && "$*" == *"#$FAIL"* ]]; then exit 1; fi
''',encoding='utf-8')
            for name,script in {'adb':'''#!/usr/bin/env bash
set -eu
echo "$*" >> "$NATIVE"
if [[ "$*" == 'shell cmd overlay list' ]]; then printf '[x] com.android.internal.systemui.navbar.threebutton\n[ ] com.android.internal.systemui.navbar.gestural\n'; fi
''','node':'''#!/usr/bin/env bash
set -eu
echo "$*" >> "$VALIDATION"
'''} .items():
                path=binary/name;path.write_text(script,encoding='utf-8');path.chmod(0o755)
            env={**os.environ,'PATH':str(binary)+':'+os.environ['PATH'],'RUNNER_TEMP':str(root),'CALLS':str(root/'calls'),'NATIVE':str(root/'native'),'VALIDATION':str(root/'validation'),'FAIL':fail}
            result=subprocess.run(['bash',str(root/'run-android-s047-journeys.sh'),str(api),'a'*40,role],env=env,capture_output=True,text=True,check=False)
            read=lambda name:(root/name).read_text(encoding='utf-8') if (root/name).exists() else ''
            return result,read('calls'),read('native'),read('validation')
    def test_ordinary_schedules_all_real_tasks_and_process_verify(self):
        result,calls,native,validation=self.run_case()
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        for method in ('s047ColdAddJourney','s047MarkdownJourney','s047SourceFailureJourney','standaloneAuthoringAndDiagnosticJourneys','s047ImageJourney','s047LayoutJourney','s047BackJourney','s047AboutJourney'):
            self.assertEqual(calls.count('#'+method),1,method)
        self.assertEqual(calls.count('#draftRecoveryAcrossProcessBoundary'),2)
        self.assertIn('-e expectedRole ordinary',calls);self.assertIn('-e s047 true',calls)
        self.assertNotIn('#s047FaultJourney',calls)
        self.assertIn('settings put system font_scale 1.0',native);self.assertIn('wm size reset',native)
        self.assertIn('--role ordinary --api 24',validation)
    def test_failure_does_not_skip_independent_tasks_and_seed_failure_blocks_only_dependent_verify(self):
        result,calls,native,validation=self.run_case(fail='s047ColdAddJourney')
        self.assertEqual(result.returncode,1);self.assertIn('#s047AboutJourney',calls);self.assertIn('--role ordinary',validation)
        result,calls,native,validation=self.run_case(fail='draftRecoveryAcrossProcessBoundary')
        self.assertEqual(result.returncode,1);self.assertEqual(calls.count('#draftRecoveryAcrossProcessBoundary'),1)
        self.assertIn('wm size reset',native)
    def test_fault_role_is_separate_and_api36_restores_original_navigation(self):
        result,calls,native,validation=self.run_case(role='fault_probe',api=36)
        self.assertEqual(result.returncode,0);self.assertEqual(calls.count('#s047FaultJourney'),1)
        self.assertNotIn('#s047ImageJourney',calls);self.assertIn('--role fault_probe --api 36',validation)
        result,calls,native,validation=self.run_case(api=36,fail='s047BackJourney')
        self.assertEqual(result.returncode,1);self.assertIn('overlay enable --exclusive --category com.android.internal.systemui.navbar.gestural',native)
        self.assertIn('overlay enable --exclusive --category com.android.internal.systemui.navbar.threebutton',native)
        self.assertIn('#s047AboutJourney',calls)
    def test_fault_journey_reuses_its_activity_for_root_recovery(self):
        # ActivityScenario.launch clears/replaces the existing task. Calling an @Test
        # from this composed journey must not destroy its live Tauri activity.
        delivery=(CAMPAIGN.parents[1]/'crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidDeliveryInstrumentedTest.kt').read_text(encoding='utf-8')
        fault=delivery.split('  @Test fun s047FaultJourney() {',1)[1].split('  private val moreViewportActions',1)[0]
        self.assertNotIn('rootFailureRetainsDraft()',fault,'composed fault journey must not call the standalone launching test')
        self.assertIn('verifyRootFailureRetainsDraft(scenario)',fault)
        self.assertEqual(fault.count('launchS047()'),1)
        self.assertNotIn('ActivityScenario.launch',fault)
        standalone=delivery.split('  fun rootFailureRetainsDraft() {',1)[1].split('  private fun verifyRootFailureRetainsDraft(',1)[0]
        self.assertEqual(standalone.count('ActivityScenario.launch<MainActivity>'),1)
        self.assertIn('verifyRootFailureRetainsDraft(scenario)',standalone)
        helper=delivery.split('  private fun verifyRootFailureRetainsDraft(',1)[1].split('\n  @Test',1)[0]
        self.assertNotIn('ActivityScenario.launch',helper)
        self.assertIn('ownedScenario === scenario',helper)
        for assertion in ('injectRecoveryFailure(scenario, "root")','"Recover Untitled.md?"','"S046_ROOT_DRAFT_RETAINED_Ω"','"application_render_failed"','JSONObject(preview).getJSONObject("environment").getString("build_commit")'):
            self.assertIn(assertion,helper)
if __name__=='__main__':unittest.main()
