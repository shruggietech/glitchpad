import json, os, signal, subprocess, time
from pathlib import Path
root=Path(os.environ['GITHUB_WORKSPACE']); out=Path(os.environ['RUNNER_TEMP'])/'s047-observer-diagnostic'
api=int(os.environ['DIAGNOSTIC_API'])
def command(args,seconds=30,output=None):
 started=time.monotonic(); timed_out=False
 with (out/(output or 'setup.log')).open('a',encoding='utf-8') as log:
  try: result=subprocess.run(args,stdout=log,stderr=subprocess.STDOUT,timeout=seconds,check=False); code=result.returncode
  except subprocess.TimeoutExpired: code=124; timed_out=True
 return {'argv':args,'elapsed_seconds':round(time.monotonic()-started,3),'exit':code,'timed_out':timed_out}
results=[]
for package in ['com.google.android.gms','com.google.android.googlequicksearchbox']:
 command(['adb','shell','pm','disable-user','--user','0',package])
for args in [['adb','shell','svc','power','stayon','true'],['adb','shell','input','keyevent','224'],['adb','install','-r',os.environ['S047_DIAGNOSTIC_APK']],['adb','install','-r',str(out/'instrumentation.apk')]]:
 result=command(args,120)
 if result['exit']: raise RuntimeError('diagnostic setup failed; see setup.log')
if api==36:
 command(['adb','shell','svc','bluetooth','disable'])
 command(['adb','shell','settings','put','global','hide_error_dialogs','1'])
 command(['adb','shell','am','broadcast','-a','android.intent.action.CLOSE_SYSTEM_DIALOGS'])
command(['adb','shell','settings','put','secure','show_ime_with_hard_keyboard','1'])
methods=[('timed-native-pan','s047MetadataMarkdownOnlyDiagnostic',360,'timed')]
for name,method,seconds,placement in methods:
 env=os.environ.copy(); env['ANDROID_INSTRUMENTATION_RESET_APP_DATA']='true'
 args=['bash','scripts/run-android-instrumentation.sh',str(out/(name+'.txt')),'s047_metadata_copy_diagnostic=','-e','waitForActivitiesToComplete','false','-e','s047','true','-e','expectedSource','f572e0fbbd1d2978b6e4064a31817201834c8965','-e','expectedRole','ordinary','-e','s047ObservationTrace','true','-e','s047InputTrace','true','-e','s047TapPlacement','nearest','-e','s047SkipNativePan','true' if placement=='skip_pan' else 'false','-e','s047VisualFence','true' if placement=='visual' else 'false','-e','class','com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#'+method]
 started=time.monotonic()
 with (out/(name+'-driver.log')).open('w',encoding='utf-8') as log:
  proc=subprocess.Popen(args,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  try: code=proc.wait(timeout=seconds)
  except subprocess.TimeoutExpired:
   os.killpg(proc.pid,signal.SIGTERM)
   try: proc.wait(timeout=5)
   except subprocess.TimeoutExpired: os.killpg(proc.pid,signal.SIGKILL); proc.wait(timeout=5)
   code=124
 results.append({'task':name,'method':method,'diagnostic_limit_seconds':seconds,'elapsed_seconds':round(time.monotonic()-started,3),'exit':code})
 command(['adb','logcat','-d','-v','threadtime'],30,name+'-logcat.txt')
 command(['adb','shell','dumpsys','activity','activities'],30,name+'-activities.txt')
 command(['adb','shell','am','force-stop','com.shruggietech.glitchpad'],30)
 command(['adb','shell','am','force-stop','com.shruggietech.glitchpad.test'],30)
 (out/'result.json').write_text(json.dumps({'diagnostic_only':True,'candidate_qualified':False,'api':api,'tasks':results},indent=2)+'\n',encoding='utf-8')
 print(json.dumps(results[-1]),flush=True)
 if code: print((out/(name+'.txt')).read_text(encoding='utf-8',errors='replace')[-3000:],flush=True)
 if code==124: break

if any(item['exit']!=0 for item in results): raise SystemExit(1)
