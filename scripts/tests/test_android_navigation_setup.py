"""Exercise actual navigation setup/restore and campaign scheduling with strict adb."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
NAMES = ('threebutton', 'twobutton', 'transparent', 'gestural')
PREFIX = 'com.android.internal.systemui.navbar.'

FAKE_ADB = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
path=Path(os.environ['NAV_STATE'])
state=json.loads(path.read_text(encoding='utf-8'))
args=sys.argv[1:]
with open(os.environ['NATIVE'],'a',encoding='utf-8') as log: log.write(' '.join(args)+'\n')
fail=os.environ.get('NAV_FAIL','')
def finish(code=0):
 path.write_text(json.dumps(state),encoding='utf-8'); sys.exit(code)
if args==['shell','cmd','overlay','list']:
 print('android\n[x] android.unrelated.overlay')
 for name,enabled in state['overlays'].items():
  if fail=='missing_gestural' and name.endswith('.gestural'): continue
  print(('---' if fail=='bad_overlay_state' and name.endswith('.gestural') else '['+('x' if enabled else ' ')+']')+' '+name)
 finish()
if args==['shell','cmd','overlay','lookup','android','android:integer/config_navBarInteractionMode']:
 phase='restore' if state['restore_started'] else 'gesture' if state['gesture_started'] else 'before'
 if fail=='lookup_'+phase: print('lookup failed',file=sys.stderr);finish(7)
 if fail=='invalid_lookup': print('not a resource mode');finish()
 if fail=='invalid_lookup_reference': print('not-a-resource -> 2');finish()
 mode=2 if state['overlays'].get('com.android.internal.systemui.navbar.gestural') else 1 if state['overlays'].get('com.android.internal.systemui.navbar.twobutton') else 0 if state['overlays'].get('com.android.internal.systemui.navbar.threebutton') else state['base_mode']
 if fail=='wrong_mode' and phase=='gesture': mode=0
 if fail=='wrong_restore_mode' and phase=='restore': mode=2
 output=hex(mode) if os.environ.get('NAV_REFERENCE') in ('hex','reference_hex') else str(mode)
 print(('@17694720 -> ' if os.environ.get('NAV_REFERENCE') in ('1','reference_hex') else '')+output);finish()
if args==['shell','cmd','overlay','enable-exclusive','--category','com.android.internal.systemui.navbar.gestural']:
 state['gesture_started']=True
 if fail=='enable': print('enable failed',file=sys.stderr);finish(9)
 if fail!='enable_no_effect':
  for name in state['overlays']: state['overlays'][name]=name.endswith('.gestural')
 finish()
if len(args)==5 and args[:3]==['shell','cmd','overlay'] and args[3] in ('enable','disable') and args[4] in state['overlays']:
 state['restore_started']=True
 if fail=='restore' and args[3]=='disable' and args[4].endswith('.gestural'): print('restore failed',file=sys.stderr);finish(13)
 if fail!='restore_no_effect': state['overlays'][args[4]]=args[3]=='enable'
 finish()
if args in (['shell','settings','put','system','font_scale','1.0'],['shell','wm','size','reset']): finish()
print('unsupported adb argv: '+repr(args),file=sys.stderr);finish(64)
'''

class AndroidNavigationSetup(unittest.TestCase):
    def run_campaign(self, *, base_mode=0, enabled=(), fail='', api=36, journey_fail='', reference=False):
        with tempfile.TemporaryDirectory(prefix='s047-navigation-') as directory:
            directory=Path(directory)
            binary=directory/'bin';binary.mkdir()
            shutil.copyfile(SCRIPTS/'run-android-s047-journeys.sh',directory/'run-android-s047-journeys.sh')
            helper=SCRIPTS/'android-navigation-mode.sh'
            if helper.exists():shutil.copyfile(helper,directory/helper.name)
            # Offline controller has dedicated behavior/orchestration tests.
            (directory/'android-offline-mode.sh').write_text('''#!/usr/bin/env bash
set -eu
echo "offline $1" >> "$CALLS"
''',encoding='utf-8')
            runner=directory/'run-android-instrumentation.sh'
            runner.write_text('''#!/usr/bin/env bash
set -eu
echo "$*" >> "$CALLS"
if [[ -n "$JOURNEY_FAIL" && "$*" == *"#$JOURNEY_FAIL"* ]]; then exit 1; fi
''',encoding='utf-8')
            for name,text in {'adb':FAKE_ADB,'node':'''#!/usr/bin/env python3
import os,sys
with open(os.environ['VALIDATION'],'a',encoding='utf-8') as output: output.write(' '.join(sys.argv[1:])+'\\n')
'''}.items():
                executable=binary/name;executable.write_text(text,encoding='utf-8');executable.chmod(0o755)
            state={'overlays':{PREFIX+name:name in enabled for name in NAMES},'base_mode':base_mode,'gesture_started':False,'restore_started':False}
            before=json.loads(json.dumps(state['overlays']))
            (directory/'state.json').write_text(json.dumps(state),encoding='utf-8')
            env={**os.environ,'PATH':str(binary)+':'+os.environ['PATH'],'RUNNER_TEMP':str(directory),'NAV_STATE':str(directory/'state.json'),'NATIVE':str(directory/'native'),'CALLS':str(directory/'calls'),'VALIDATION':str(directory/'validation'),'NAV_FAIL':fail,'JOURNEY_FAIL':journey_fail,'NAV_REFERENCE':reference if isinstance(reference,str) else '1' if reference else '0'}
            result=subprocess.run(['bash',str(directory/'run-android-s047-journeys.sh'),str(api),'a'*40,'ordinary'],env=env,stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=30,check=False,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            files={path.name:path.read_text(encoding='utf-8') for path in directory.iterdir() if path.is_file() and (path.name.startswith('s047-navigation-') or path.name in ('calls','native','validation'))}
            return {'result':result,'before':before,'state':json.loads((directory/'state.json').read_text(encoding='utf-8')),'files':files,'calls':files.get('calls',''),'native':files.get('native','')}

    def assert_later_tasks(self, case):
        self.assertIn('#s047AboutJourney',case['calls'])
        self.assertIn('#draftRecoveryAcrossProcessBoundary',case['calls'])
        self.assertIn('--role ordinary',case['files'].get('validation',''))
        self.assertIn('settings put system font_scale 1.0',case['native'])
        self.assertIn('wm size reset',case['native'])

    def test_base_all_off_and_explicit_baselines_restore_exactly(self):
        for base_mode,enabled in ((0,()),(1,()),(2,()),(0,('threebutton',)),(1,('twobutton',)),(0,('transparent',)),(0,('threebutton','transparent')),(2,('gestural',))):
            with self.subTest(base_mode=base_mode,enabled=enabled):
                case=self.run_campaign(base_mode=base_mode,enabled=enabled)
                self.assertEqual(case['result'].returncode,0,case['result'].stdout+case['result'].stderr)
                self.assertEqual(case['calls'].count('#s047BackJourney'),1)
                self.assertEqual(case['state']['overlays'],case['before'])
                self.assertIn('overlay enable-exclusive --category '+PREFIX+'gestural',case['native'])
                self.assertNotIn('overlay enable --exclusive',case['native'])
                self.assertEqual(case['files']['s047-navigation-before-mode-value.txt'].strip(),str(base_mode))
                self.assertEqual(case['files']['s047-navigation-gestural-mode-value.txt'].strip(),'2')
                self.assertEqual(case['files']['s047-navigation-restored-mode-value.txt'].strip(),str(base_mode))
                self.assertEqual(case['files']['s047-navigation-before-state.txt'],case['files']['s047-navigation-restored-state.txt'])
                self.assertIn('android.unrelated.overlay',case['files']['s047-navigation-before.txt'])
                self.assertNotIn('s047-navigation-restore-required.txt',case['files'])
                self.assert_later_tasks(case)

    def test_resource_reference_output_uses_its_resolved_value(self):
        for output in (True,'hex','reference_hex'):
            with self.subTest(output=output):
                case=self.run_campaign(reference=output)
                self.assertEqual(case['result'].returncode,0,case['result'].stderr)
                self.assertEqual(case['files']['s047-navigation-gestural-mode-value.txt'].strip(),'2')

    def test_failed_enable_or_ineffective_enable_blocks_only_back_and_restores(self):
        for failure,base_mode in (('enable',0),('enable_no_effect',0),('enable_no_effect',2),('wrong_mode',0),('lookup_gesture',0)):
            with self.subTest(failure=failure,base_mode=base_mode):
                case=self.run_campaign(fail=failure,base_mode=base_mode)
                self.assertEqual(case['result'].returncode,1)
                self.assertNotIn('#s047BackJourney',case['calls'])
                self.assertEqual(case['state']['overlays'],case['before'])
                self.assertIn('s047-navigation-restored-mode-value.txt',case['files'])
                self.assert_later_tasks(case)

    def test_bad_baseline_lookup_never_mutates_and_later_tasks_still_run(self):
        for failure in ('lookup_before','invalid_lookup','invalid_lookup_reference','missing_gestural','bad_overlay_state'):
            with self.subTest(failure=failure):
                case=self.run_campaign(fail=failure)
                self.assertEqual(case['result'].returncode,1)
                self.assertNotIn('enable-exclusive',case['native'])
                self.assertNotIn('#s047BackJourney',case['calls'])
                self.assertEqual(case['state']['overlays'],case['before'])
                self.assert_later_tasks(case)

    def test_failed_or_unverified_restore_blocks_acceptance_after_back(self):
        for failure in ('restore','restore_no_effect','lookup_restore','wrong_restore_mode'):
            with self.subTest(failure=failure):
                case=self.run_campaign(fail=failure)
                self.assertEqual(case['result'].returncode,1)
                self.assertEqual(case['calls'].count('#s047BackJourney'),1)
                self.assertIn('s047-navigation-restore-required.txt',case['files'])
                self.assertIn('s047-navigation-restore-status.txt',case['files'])
                self.assertNotIn('restored_verified',case['files']['s047-navigation-restore-status.txt'])
                self.assert_later_tasks(case)

    def test_failed_back_still_restores_exact_baseline_once(self):
        case=self.run_campaign(enabled=('threebutton',),journey_fail='s047BackJourney')
        self.assertEqual(case['result'].returncode,1)
        self.assertEqual(case['calls'].count('#s047BackJourney'),1)
        self.assertEqual(case['state']['overlays'],case['before'])
        self.assertEqual(case['native'].count('overlay disable '+PREFIX+'gestural'),1)
        self.assert_later_tasks(case)

    def test_api24_back_path_never_invokes_navigation_overlay_commands(self):
        case=self.run_campaign(api=24)
        self.assertEqual(case['result'].returncode,0,case['result'].stderr)
        self.assertEqual(case['calls'].count('#s047BackJourney'),1)
        self.assertNotIn('cmd overlay',case['native'])
        self.assert_later_tasks(case)

if __name__=='__main__':unittest.main()
