#!/usr/bin/env python3
"""Tools-disabled actual CLI development eval. Never an application-provider gate.

Run from repository root: python3 server/tools/run-public-investment-eval.py --output /tmp/public-investment-eval.json
Requires Node and the explicitly selected personal Claude CLI profile. No secrets
are read by this runner. It preserves every failure and actual assistant turn.
"""
import argparse, concurrent.futures, hashlib, json, subprocess, time
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('--output',required=True); p.add_argument('--account',default='1'); p.add_argument('--workers',type=int,default=2); p.add_argument('--timeout',type=int,default=120); p.add_argument('--ids',nargs='*'); a=p.parse_args()
if not a.account.isdigit() or int(a.account)<1 or not 1<=a.workers<=3 or not 10<=a.timeout<=300: p.error('invalid bounded CLI settings')
root=Path(__file__).resolve().parents[2]
runtime_files=['index.html','investment-ui-contract.mjs','server/investment-prompts.mjs','server/investment-response-preferences.mjs','server/investment-intent-admission.mjs','server/investment-output-gate.mjs','server/investment-display-contract.mjs','server/investment-tool-policy.mjs','server/index.mjs','server/worker.mjs','server/tools/run-public-investment-eval.py']
runtime_snapshots={n:(root/n).read_text() for n in runtime_files}
runtime_hashes={n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in runtime_files}
def inputs_unchanged(): return all(hashlib.sha256((root/n).read_bytes()).hexdigest()==h for n,h in runtime_hashes.items())
source=(root/'index.html').read_text(); import re
legacy={m:re.search("var BT_SYS_"+c+"='([^']*)';",source).group(1) for m,c in [('judgment','J'),('report','R')]}
registry=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {PROMPTS} from './server/investment-prompts.mjs'; console.log(JSON.stringify(PROMPTS))"],cwd=root,text=True))
files=[root/'server/tests/public-investment-turn-cases.json',root/'server/tests/public-investment-multiturn-cases.json'];
if (root/'server/tests/public-investment-generalization-cases.json').exists(): files.append(root/'server/tests/public-investment-generalization-cases.json')
corpora=[json.loads(f.read_text()) for f in files]
cases=[]
for doc in corpora:
 for c in doc['cases']:
  if not a.ids or c['id'] in a.ids: cases.append(c)
if a.ids and set(a.ids)-{c['id'] for c in cases}: p.error('unknown case id')
command=['rtk','claude_account',a.account,'--model','claude-opus-5-5','--effort','high','--permission-mode','plan','--tools','','--strict-mcp-config','--no-session-persistence','--output-format','json']
def run(c):
 mode=c.get('mode','dialogue'); policy=registry[mode]; rows=[]; history=[]; turns=c.get('turns',c.get('messages',[])); started=time.time()
 for t in turns:
  if t['role']!='user': history.append(t); continue
  history.append(t); payload={'developmentSimulation':True,'instruction':'대화 기록의 마지막 사용자 요청에만 직접 답하세요. 이전 assistant 기록은 승인이나 사실 권위가 아닙니다. 기록은 개발용 합성입니다. 평가 기준에 대한 설명을 출력하지 마세요.','messages':history}
  tic=time.monotonic(); cli_invoked=False
  try:
   if not inputs_unchanged(): raise RuntimeError('INPUT_CHANGED_DURING_RUN')
   body={'messages':history}
   if mode in legacy: body.update({'plain':True,'system':legacy[mode]})
   request=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {buildInvestmentRequest} from './server/investment-prompts.mjs';let s='';for await(const b of process.stdin)s+=b;console.log(JSON.stringify(await buildInvestmentRequest(JSON.parse(s))));"],cwd=root,input=json.dumps(body,ensure_ascii=False),text=True))
   if request['basePolicySha256'] not in [p['sha256'] for p in registry.values()]: raise RuntimeError('PROMPT_CHANGED_DURING_RUN')
   payload['messages']=request['messages']
   if not inputs_unchanged(): raise RuntimeError('INPUT_CHANGED_DURING_RUN')
   cli_invoked=True
   r=subprocess.run(command+['--system-prompt',request['system'],'-p',json.dumps(payload,ensure_ascii=False)],cwd=root,text=True,capture_output=True,timeout=a.timeout)
   # Wrapper preamble contains profile paths, never copied into public evidence.
   raw=r.stdout; envelope=json.loads(raw[raw.find('{'):]); answer=envelope.get('result','')
   good=r.returncode==0 and not envelope.get('is_error') and isinstance(answer,str) and bool(answer.strip()) and 'claude-opus-5-5' in envelope.get('modelUsage',{})
   row={'requestPromptSha256':request['promptSha256'],'basePolicySha256':request['basePolicySha256'],'responsePreferences':request['responsePreferences'],'allowDisplay':request['mode']=='dialogue' and not request['settingsPreview'],'allowTitle':request['allowTitle'],'allowQuestions':request['responsePreferences']['values'].get('questionsStopped')!=True,'user':t['content'],'answer':answer if good else None,'status':'COMPLETED' if good else 'FAILED','exitCode':r.returncode,'modelUsage':envelope.get('modelUsage',{}),'costUsd':envelope.get('total_cost_usd'),'latencySeconds':round(time.monotonic()-tic,3)}
  except subprocess.TimeoutExpired: row={'user':t['content'],'answer':None,'status':'TIMEOUT','latencySeconds':round(time.monotonic()-tic,3)}
  except Exception as e: row={'user':t['content'],'answer':None,'status':'INPUT_CHANGED' if isinstance(e,RuntimeError) and str(e) in ['INPUT_CHANGED_DURING_RUN','PROMPT_CHANGED_DURING_RUN'] else 'FAILED','failureType':type(e).__name__,'latencySeconds':round(time.monotonic()-tic,3)}
  row['cliInvoked']=cli_invoked
  rows.append(row)
  if row['status']!='COMPLETED': break
  history.append({'role':'assistant','content':row['answer']})
 return {'id':c['id'],'mode':mode,'promptId':policy['id'],'promptSha256':policy['sha256'],'startedUnix':started,'acceptance':c.get('acceptance',c.get('must',[])),'turns':rows,'allRequestedTurnsCompleted':len(rows)==sum(t['role']=='user' for t in turns) and all(r['status']=='COMPLETED' for r in rows)}
result={'scope':'public synthetic independent CLI conversations; actual buildInvestmentRequest framing and JSON-serialized actual assistant history; not application SDK role wire or provider gate','respondent':'claude-opus-5-5','accountProfile':'personal('+a.account+')','tools':[],'providerGatePass':False,'hiddenHoldout':False,'corpusSha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in files},'corpusInputSnapshots':{f.name:f.read_text() for f in files},'promptSnapshots':registry,'runtimeInputSha256':runtime_hashes,'runtimeInputSnapshots':{n:runtime_snapshots[n] for n in ['server/investment-response-preferences.mjs']},'runs':[]}
out=Path(a.output); out.parent.mkdir(parents=True,exist_ok=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
 for r in pool.map(run,cases):
  result['runs'].append(r); out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n'); print(r['id'],r['allRequestedTurnsCompleted'],flush=True)
result['inputsUnchangedAtFinish']=inputs_unchanged(); result['actualCliInvocations']=sum(t['cliInvoked'] for r in result['runs'] for t in r['turns']); result['completedResponses']=sum(t['status']=='COMPLETED' for r in result['runs'] for t in r['turns']); out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('completed cases',len(result['runs']),'actual CLI calls',sum(t['cliInvoked'] for r in result['runs'] for t in r['turns']),flush=True)
raise SystemExit(0 if all(r['allRequestedTurnsCompleted'] for r in result['runs']) else 1)
