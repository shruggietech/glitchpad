"""Exercise S047 scheduling and cleanup through the real campaign entry point."""
import os
import base64
import json
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

CAMPAIGN = Path(__file__).resolve().parents[1] / 'run-android-s047-journeys.sh'
class JourneyCampaign(unittest.TestCase):
    def run_case(self, role='ordinary', api=24, fail='', navigation='explicit', diagnostic=False):
        with tempfile.TemporaryDirectory(prefix='s047-campaign-') as directory:
            root=Path(directory); binary=root/'bin'; binary.mkdir()
            shutil.copyfile(CAMPAIGN,root/'run-android-s047-journeys.sh')
            shutil.copyfile(CAMPAIGN.parent/'android-navigation-mode.sh',root/'android-navigation-mode.sh')
            (root/'run-android-instrumentation.sh').write_text('''#!/usr/bin/env bash
set -eu
echo "$*" >> "$CALLS"
if [[ -n "$FAIL" && "$*" == *"#$FAIL"* ]]; then exit 1; fi
''',encoding='utf-8')
            for name,script in {'adb':'''#!/usr/bin/env bash
set -eu
echo "$*" >> "$NATIVE"
if [[ ! -f "$NAV_STATE" ]]; then printf '%s\n' "$NAV_INITIAL" > "$NAV_STATE"; fi
state=$(cat "$NAV_STATE")
if [[ "$*" == 'shell cmd overlay list' ]]; then
  for item in threebutton twobutton transparent gestural; do
    marker=' '; [[ "$state" != "$item" ]] || marker=x
    printf '[%s] com.android.internal.systemui.navbar.%s\n' "$marker" "$item"
  done
elif [[ "$*" == 'shell cmd overlay lookup android android:integer/config_navBarInteractionMode' ]]; then
  if [[ "$state" == gestural ]]; then echo 2; elif [[ "$state" == twobutton ]]; then echo 1; else echo 0; fi
elif [[ "$*" == 'shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural' ]]; then
  echo gestural > "$NAV_STATE"
elif [[ "$*" == 'shell cmd overlay disable '* ]]; then
  item="${@: -1}"; item="${item##*.}"
  if [[ "$state" == "$item" ]]; then echo '' > "$NAV_STATE"; fi
elif [[ "$*" == 'shell cmd overlay enable '* ]]; then
  item="${@: -1}"; printf '%s\n' "${item##*.}" > "$NAV_STATE"
fi
''','node':'''#!/usr/bin/env bash
set -eu
echo "$*" >> "$VALIDATION"
'''} .items():
                path=binary/name;path.write_text(script,encoding='utf-8');path.chmod(0o755)
            env={**os.environ,'ANDROID_S047_BACK_DIAGNOSTIC':'true' if diagnostic else 'false','PATH':str(binary)+':'+os.environ['PATH'],'RUNNER_TEMP':str(root),'CALLS':str(root/'calls'),'NATIVE':str(root/'native'),'VALIDATION':str(root/'validation'),'FAIL':fail,'NAV_STATE':str(root/'navigation-state'),'NAV_INITIAL':'threebutton' if navigation=='explicit' else ''}
            result=subprocess.run(['bash',str(root/'run-android-s047-journeys.sh'),str(api),'a'*40,role],env=env,capture_output=True,text=True,check=False)
            read=lambda name:(root/name).read_text(encoding='utf-8') if (root/name).exists() else ''
            result.diagnostic_receipt=json.loads(read('s047-back-diagnostic.json')) if read('s047-back-diagnostic.json') else None
            return result,read('calls'),read('native')+'\nFINAL_NAV='+read('navigation-state').strip(),read('validation')
    def test_back_diagnostic_is_single_journey_and_cannot_emit_full_qualification(self):
        for fail in ('','s047BackJourney'):
            result,calls,native,validation=self.run_case(api=36,diagnostic=True,fail=fail)
            self.assertEqual(result.returncode,1 if fail else 0,result.stdout+result.stderr)
            self.assertEqual(calls.count('#'),1,calls)
            self.assertEqual(calls.count('#s047BackJourney'),1,calls)
            self.assertEqual(validation,'')
            self.assertTrue(result.diagnostic_receipt['diagnostic_only'])
            self.assertFalse(result.diagnostic_receipt['candidate_qualified'])
            self.assertEqual(result.diagnostic_receipt['failures'],1 if fail else 0)
            self.assertTrue(native.endswith('FINAL_NAV=threebutton'),native)
            self.assertIn('wm size reset',native)
    def test_back_diagnostic_rejects_wrong_api_or_role_before_dispatch(self):
        for api,role in ((24,'ordinary'),(36,'fault_probe')):
            result,calls,native,validation=self.run_case(api=api,role=role,diagnostic=True)
            self.assertEqual(result.returncode,2,result.stdout+result.stderr)
            self.assertEqual(calls,'')
            self.assertEqual(validation,'')
            self.assertIsNone(result.diagnostic_receipt)
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
        self.assertEqual(result.returncode,1);self.assertIn('overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural',native)
        self.assertIn('overlay enable com.android.internal.systemui.navbar.threebutton',native)
        self.assertIn('#s047AboutJourney',calls)
        self.assertTrue(native.endswith('FINAL_NAV=threebutton'),native)
    def test_api36_base_navigation_without_enabled_overlay_is_observed_and_restored(self):
        result,calls,native,validation=self.run_case(api=36,navigation='base')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(calls.count('#s047BackJourney'),1)
        self.assertIn('overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural',native)
        self.assertIn('overlay lookup android android:integer/config_navBarInteractionMode',native)
        self.assertIn('overlay disable com.android.internal.systemui.navbar.gestural',native)
        self.assertTrue(native.endswith('FINAL_NAV='),native)
        self.assertNotIn('overlay enable com.android.internal.systemui.navbar.threebutton',native)
        self.assertIn('--api 36',validation)
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
    def test_api24_external_intents_use_registered_androidx_capture_and_stubbing(self):
        delivery=(CAMPAIGN.parents[1]/'crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidDeliveryInstrumentedTest.kt').read_text(encoding='utf-8')
        self.assertNotIn('override fun onStartActivity(',delivery,'API26 framework callbacks cannot qualify API24 handoff')
        for operation in ('IntentMonitorRegistry.getInstance()', 'addIntentCallback(callback)', 'removeIntentCallback(callback)', 'IntentStubberRegistry.load(', 'IntentStubberRegistry.reset()', 'Intent.ACTION_VIEW', 'request.dataString', 'Intent.EXTRA_STREAM', 'Intent.EXTRA_TEXT', 'request.clipData'):
            self.assertIn(operation,delivery)
        self.assertGreaterEqual(delivery.count('verifyExternalViewDispatch(scenario,'),2)
    def test_native_input_preserves_original_deadline_and_observes_real_field_before_commit(self):
        delivery=(CAMPAIGN.parents[1]/'crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidDeliveryInstrumentedTest.kt').read_text(encoding='utf-8')
        task=delivery.split('  private fun setTaskInput(',1)[1].split('  private fun chooseTaskOption(',1)[0]
        self.assertIn('waitForFocusedInputConnection(',task)
        self.assertLess(task.index('waitForFocusedInputConnection('),task.index('it.commitText(text, 1)'))
        self.assertIn('deadlineOverride = deadline',task)
        readiness=delivery.split('  private fun waitForFocusedInputConnection(',1)[1].split('  private fun setTaskInput(',1)[0]
        self.assertIn('getExtractedText(',readiness)
        self.assertIn('actual == expectedText',readiness)
        self.assertLess(readiness.index('actual == expectedText'),readiness.index('return Pair(current, dispatch)'))
        editor=delivery.split('  private fun replaceEditorText(',1)[1].split('  private fun waitForBrowserEditorCommit(',1)[0]
        self.assertIn('target.optBoolean("hit_is_editor")',editor)
        self.assertIn('nativeTapObservationsAgree(',editor)
        self.assertIn('deadlineOverride = deadline',editor)
        self.assertEqual(editor.count('MotionEvent.ACTION_DOWN'),1)
        self.assertEqual(editor.count('MotionEvent.ACTION_UP'),1)
        self.assertNotIn('.focus()',task)
        self.assertNotRegex(task,r'\.value\s*=(?!=)')
    def test_checked_shell_preserves_exact_source_whitespace_tokenized_runtime_argv(self):
        delivery=(CAMPAIGN.parents[1]/'crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidDeliveryInstrumentedTest.kt').read_text(encoding='utf-8')
        helper=delivery.split('  private fun checkedShell(',1)[1].split('  private fun verifyOfflineNotices(',1)[0]
        literal=r'"(?:\\.|[^"\\])*"'
        decode=lambda text:json.loads(text.replace('\\$','$'))
        script=re.search(r'val script = ('+literal+r') \+ command \+ ('+literal+r')',helper)
        output=re.search(r'val output = shellOutput\(('+literal+r') \+ encoded \+ ('+literal+r')\)',helper)
        self.assertIsNotNone(script);self.assertIsNotNone(output)
        self.assertIn('"\\\\%03o".format(it.toInt() and 0xff)',helper)
        prefix,suffix=map(decode,script.groups());before,after=map(decode,output.groups())
        cases=[]
        for command,expected,expected_output in (("printf fixture",0,"fixture"),("printf '%s' 'Unicode Ω two words'",0,"Unicode Ω two words"),("printf '%s' \"single ' double \\\" dollar \\$ semicolon ; Ω\"",0,"single ' double \" dollar $ semicolon ; Ω"),("exit 7",7,"")):
            source=prefix+command+suffix
            encoded=''.join('\\'+format(byte,'03o') for byte in source.encode('utf-8'))
            actual=before+encoded+after
            self.assertEqual(len(actual.split()),3,'the whole -c script must survive Runtime.exec whitespace tokenization')
            cases.append((actual,expected,expected_output))
        # This is the former real UiAutomation boundary, retained as a RED control.
        old_source=prefix+'printf fixture'+suffix
        cases.append(("sh -c '"+old_source.replace("'","'\\''")+"'",None,None))
        fixture='''import java.nio.charset.StandardCharsets;
import java.util.Base64;
class RuntimeArgvProof {
 public static void main(String[] commands)throws Exception {
  for(String command:commands) {
   Process process=Runtime.getRuntime().exec(new String(Base64.getDecoder().decode(command),StandardCharsets.UTF_8));
   byte[] output=process.getInputStream().readAllBytes();
   byte[] errors=process.getErrorStream().readAllBytes();
   int exit=process.waitFor();
   System.out.println(exit+"\\t"+Base64.getEncoder().encodeToString(output)+"\\t"+(errors.length>0));
  }
 }
}
'''
        # Runtime.exec(String) uses whitespace tokenization, without shell quote grouping.
        # The SDK-container companion receipt executes these same extracted commands
        # through the actual JVM too; this common policy suite needs no JDK dependency.
        rows=[]
        for command,_,_ in cases:
            result=subprocess.run(command.split(),capture_output=True,timeout=30,check=False)
            rows.append((str(result.returncode),result.stdout.decode('utf-8'),str(bool(result.stderr)).lower()))
        receipt=os.environ.get('S047_SHELL_JVM_RECEIPT')
        if receipt:
            Path(receipt).write_text(json.dumps({'fixture':fixture,'commands':[base64.b64encode(command.encode('utf-8')).decode('ascii') for command,_,_ in cases],'expected_outputs':[(expected_output+'\nS047_SHELL_EXIT='+str(expected)+'\n') if expected is not None else None for _,expected,expected_output in cases]}),encoding='utf-8')
        for row,(_,expected,expected_output) in zip(rows,cases):
            exit_value,actual,error=row
            marker=re.findall(r'(?m)^S047_SHELL_EXIT=([0-9]+)\s*$',actual)
            if expected is None:
                self.assertNotEqual(exit_value,'0');self.assertEqual(marker,[]);self.assertEqual(error,'true')
            else:
                self.assertEqual(exit_value,'0');self.assertEqual(marker,[str(expected)]);self.assertEqual(error,'false')
                self.assertEqual(actual.encode('utf-8'),(expected_output+'\nS047_SHELL_EXIT='+str(expected)+'\n').encode('utf-8'))
if __name__=='__main__':unittest.main()
