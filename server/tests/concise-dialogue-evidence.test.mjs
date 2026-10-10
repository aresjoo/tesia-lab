import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PROMPTS,buildInvestmentRequest,digestText} from '../investment-prompts.mjs';
const archive=JSON.parse(readFileSync(new URL('../qa/concise-dialogue.json',import.meta.url)));
const hash=v=>createHash('sha256').update(v).digest('hex');
const rootFile=f=>readFileSync(new URL('../../'+f,import.meta.url));
const legacySource=rootFile('index.html').toString();
const legacy=Object.fromEntries([['judgment','J'],['report','R']].map(([mode,key])=>[mode,legacySource.match(new RegExp("var BT_SYS_"+key+"='([^']*)';"))[1]]));
test('fresh evidence preserves previous failures and separates CLI evaluation from customer activation',()=>{
 assert.equal(archive.customerProviderCalls,0);assert.equal(archive.productionChanges,0);assert.equal(archive.orders,0);
 assert.equal(archive.hiddenHoldout,false);assert.equal(archive.serviceGo,false);
 assert.equal(hash(rootFile('server/tests/recorded-investment-turns.json')),'153f2dc9dceb2389a1838f5b5691272f8339c87f5062457845a56abbe6d03a0e');
 assert.equal(hash(rootFile('server/qa/investment-usability.json')),'56a2e6717ca44ef853bdcfc9d227ba00d073dbbef95f0b6b66a8828a782c8d20');
 assert.equal(archive.phases[0].rawSha256,'e7e186e409ae7080e055330617085532edc563e2d9b4abd5d16d728846144c0c');
 assert.equal(archive.phases[1].rawSha256,'f6c705f1f32a231db7c5b5002253ca89be6bf6f1b330487841c4abe943fadad6');
 for(const phase of archive.phases){
  assert.equal(hash(phase.raw),phase.rawSha256);const record=JSON.parse(phase.raw);
  assert.equal(record.respondent,'claude-opus-5-5');assert.equal(record.accountProfile,'personal(1)');assert.deepEqual(record.tools,[]);
  assert.equal(record.providerGatePass,false);assert.equal(record.hiddenHoldout,false);assert.equal(record.inputsUnchangedAtFinish,true);
  const turns=record.runs.flatMap(r=>r.turns);
  assert.equal(record.actualCliInvocations,turns.filter(t=>t.cliInvoked).length);
  assert.equal(record.completedResponses,turns.filter(t=>t.status==='COMPLETED').length);
  if(['policy138','policy139'].includes(phase.key)){
   const known=phase.key==='policy138'?{calls:233,complete:232,id:'full138/FULL-H1-2'}:{calls:146,complete:145,id:'source139/H-d-held-participle'};
   assert.equal(record.actualCliInvocations,known.calls);assert.equal(record.completedResponses,known.complete);
   assert.deepEqual(record.runs.flatMap(r=>r.turns.map((t,i)=>({id:r.id,turn:i+1,status:t.status,exit:t.exitCode}))).filter(t=>t.status!=='COMPLETED'),[{id:known.id,turn:3,status:'FAILED',exit:1}]);
  }else{
   assert.equal(record.actualCliInvocations,record.completedResponses);
   assert.equal(record.completedResponses,turns.length);
  }
  assert.equal(hash(phase.policySource),record.runtimeInputSha256['server/investment-prompts.mjs']);
  for(const[f,sha]of Object.entries(record.corpusSha256))assert.equal(hash(record.corpusInputSnapshots[f]),sha);
  for(const[f,sha]of Object.entries(phase.reviewsSha256))assert.equal(hash(phase.reviewsRaw[f]),sha);
 }
});
for(const phase of archive.phases)test('reconstruct exact published request inputs and real assistant history: '+phase.key,async()=>{
 const record=JSON.parse(phase.raw),helper=record.runtimeInputSnapshots['server/investment-response-preferences.mjs'];
 assert.equal(hash(helper),record.runtimeInputSha256['server/investment-response-preferences.mjs']);
 assert.equal(hash(rootFile('server/investment-intent-admission.mjs')),record.runtimeInputSha256['server/investment-intent-admission.mjs']);
 const helperUrl='data:text/javascript;base64,'+Buffer.from(helper).toString('base64');
 const source=phase.policySource.replace("'./investment-response-preferences.mjs'",JSON.stringify(helperUrl)).replace("'./investment-intent-admission.mjs'",JSON.stringify(new URL('../investment-intent-admission.mjs',import.meta.url).href));
 const policy=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.deepEqual(policy.PROMPTS,record.promptSnapshots);
 for(const p of Object.values(policy.PROMPTS))assert.equal(p.sha256,await digestText(p.text));
 const cases=Object.values(record.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 for(const run of record.runs){
  const c=cases.find(v=>v.id===run.id);assert.ok(c,run.id);
  const inputs=c.turns||c.messages;const history=[];let index=0;
  for(const input of inputs){
   if(input.role!=='user'){history.push(input);continue;}
   history.push(input);const turn=run.turns[index++];assert.equal(turn.user,input.content);
   const payload={messages:history};if(legacy[run.mode])Object.assign(payload,{plain:true,system:legacy[run.mode]});
   const r=await policy.buildInvestmentRequest(payload);
   assert.equal(r.promptSha256,turn.requestPromptSha256);assert.equal(r.basePolicySha256,turn.basePolicySha256);
   assert.deepEqual(r.responsePreferences,turn.responsePreferences);
   for(const e of Object.values(r.responsePreferences.evidence)){
    assert.equal(history[e.messageIndex].role,'user');assert.equal(history[e.messageIndex].content.slice(e.start,e.end),e.text);
   }
   if(turn.requestMessagesSha256){assert.equal(hash(JSON.stringify(r.messages)),turn.requestMessagesSha256);assert.deepEqual(r.responseFormat,turn.responseFormat);}
   assert.equal(turn.cliInvoked,true);assert.ok(turn.modelUsage['claude-opus-5-5']);
   if(turn.status!=='COMPLETED'){
    const failedCase={policy138:'full138/FULL-H1-2',policy139:'source139/H-d-held-participle'}[phase.key];assert.ok(failedCase);assert.equal(run.id,failedCase);assert.equal(index,3);
    assert.equal(turn.status,'FAILED');assert.equal(turn.exitCode,1);assert.equal(turn.answer,null);
    assert.equal(turn.requestMessagesSha256,undefined);assert.equal(turn.responseFormat,undefined);
    assert.equal(run.allRequestedTurnsCompleted,false);break;
   }
   assert.equal(turn.status,'COMPLETED');
   history.push({role:'assistant',content:turn.answer});
  }
  assert.equal(index,run.turns.length);
 }
});
test('latest actual evaluation and the source-only correction retain separate runtime bindings',async()=>{
 const latest=archive.phases.at(-1),record=JSON.parse(latest.raw);
 const correction=JSON.parse(rootFile('server/qa/response-preference-correction.json'));
 assert.equal(correction.schemaVersion,1);assert.equal(correction.kind,'response-preference-source-correction');
 assert.equal(correction.archiveSha256,hash(rootFile('server/qa/concise-dialogue.json')));
 assert.equal(correction.baselinePhase,latest.key);
 assert.deepEqual(Object.keys(correction.runtimeCorrections),['server/investment-response-preferences.mjs']);
 assert.equal(correction.acceptanceTest,'server/tests/response-preference-usability.test.mjs');
 assert.equal(correction.acceptanceTestSha256,hash(rootFile(correction.acceptanceTest)));
 for(const field of ['newModelCalls','newBrowserRuns','customerProviderCalls','productionChanges'])assert.equal(correction[field],0);
 assert.equal(correction.historicalResponsesUnchanged,true);
 for(const [file,sha256] of Object.entries(record.runtimeInputSha256)){
  const delta=correction.runtimeCorrections[file];if(delta)assert.equal(delta.beforeSha256,sha256);
  assert.equal(hash(rootFile(file)),delta?.afterSha256??sha256,file+' current source runtime');
 }
 assert.equal(hash(rootFile('server/investment-prompts.mjs')),record.runtimeInputSha256['server/investment-prompts.mjs']);
 assert.deepEqual(PROMPTS,record.promptSnapshots);
 const r=await buildInvestmentRequest({messages:[{role:'user',content:'MDD 뜻은?'}]});assert.equal(r.promptSha256,await digestText(r.system));
});
test('source-only correction preserves the captured 146 and 6 requests without claiming new responses',async()=>{
 const correction=JSON.parse(rootFile('server/qa/response-preference-correction.json'));
 assert.deepEqual(correction.replayedPhases,{policy142:146,policy143:6});
 for(const [key,expectedTurns] of Object.entries(correction.replayedPhases)){
  const record=JSON.parse(archive.phases.find(p=>p.key===key).raw);
  const cases=Object.values(record.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);let checked=0;
  for(const run of record.runs){
   const c=cases.find(v=>v.id===run.id),history=[];let index=0;
   for(const input of c.turns||c.messages){
    history.push(input);if(input.role!=='user')continue;
    const turn=run.turns[index++],payload={messages:history};
    if(legacy[run.mode])Object.assign(payload,{plain:true,system:legacy[run.mode]});
    const current=await buildInvestmentRequest(payload);
    assert.equal(current.promptSha256,turn.requestPromptSha256);
    assert.equal(hash(JSON.stringify(current.messages)),turn.requestMessagesSha256);
    assert.deepEqual(current.responsePreferences,turn.responsePreferences);
    assert.deepEqual(current.responseFormat,turn.responseFormat);
    history.push({role:'assistant',content:turn.answer});checked++;
   }
  }
  assert.equal(checked,expectedTurns);
 }
});
test('frozen132 helper reproduced 260 prior inputs; these are not current134 responses',async()=>{
 const phase132=archive.phases.find(p=>p.key==='policy132');
 const snapshot132=JSON.parse(phase132.raw);
 const helper132=snapshot132.runtimeInputSnapshots['server/investment-response-preferences.mjs'];
 const helperUrl='data:text/javascript;base64,'+Buffer.from(helper132).toString('base64');
 const source132=phase132.policySource.replace("'./investment-response-preferences.mjs'",JSON.stringify(helperUrl)).replace("'./investment-intent-admission.mjs'",JSON.stringify(new URL('../investment-intent-admission.mjs',import.meta.url).href));
 const historical=await import('data:text/javascript;base64,'+Buffer.from(source132).toString('base64'));
 const proof=JSON.parse(archive.previous132RequestEquivalenceRaw);
 assert.equal(hash(archive.previous132RequestEquivalenceRaw),archive.previous132RequestEquivalenceSha256);
 assert.equal(proof.currentSourceSha256.policy,hash(phase132.policySource));
 assert.equal(proof.currentSourceSha256.helper,hash(helper132));
 let total=0;
 for(const group of proof.groups){
  const phase=archive.phases.find(p=>p.key===group.phaseKey);assert.equal(group.rawSha256,phase.rawSha256);
  assert.equal(group.basePolicyTextsUnchanged,true);assert.deepEqual(group.changedWholeCaseIds,[]);
  const record=JSON.parse(phase.raw),cases=Object.values(record.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
  for(const [mode,p]of Object.entries(historical.PROMPTS)){
   assert.equal(p.text,record.promptSnapshots[mode].text);assert.equal(p.sha256,record.promptSnapshots[mode].sha256);
  }
  let subtotal=0;
  for(const run of record.runs){
   const c=cases.find(c=>c.id===run.id),history=[];let i=0;
   for(const input of c.turns||c.messages){
    history.push(input);if(input.role!=='user')continue;
    const old=run.turns[i++],payload={messages:history};if(legacy[run.mode])Object.assign(payload,{plain:true,system:legacy[run.mode]});
    const cur=await historical.buildInvestmentRequest(payload),row=group.rows[subtotal++];
    assert.equal(row.id,run.id);assert.equal(row.turn,i);assert.equal(row.unchanged,true);
    assert.equal(cur.promptSha256,old.requestPromptSha256);assert.equal(hash(JSON.stringify(cur.messages)),old.requestMessagesSha256);
    assert.deepEqual(cur.responseFormat,old.responseFormat);history.push({role:'assistant',content:old.answer});
   }
  }
  assert.equal(group.turns,subtotal);assert.equal(group.unchangedTurns,subtotal);assert.equal(group.cases,record.runs.length);total+=subtotal;
 }
 assert.equal(total,260);assert.deepEqual(proof.groups.map(g=>[g.phaseKey,g.cases,g.turns]),[['policy129',106,191],['policy130',13,33],['policy131',12,36]]);
});

test('historical full133 evaluation preserves every previous case with unchanged input and criteria',()=>{
 const current=JSON.parse(archive.phases.find(p=>p.key==='policy133').raw);
 assert.equal(current.runs.length,162);assert.equal(current.actualCliInvocations,351);assert.equal(current.completedResponses,351);
 const currentCases=Object.values(current.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 assert.equal(new Set(currentCases.map(c=>c.id)).size,currentCases.length);
 assert.deepEqual(new Set(current.runs.map(r=>r.id)),new Set(currentCases.map(c=>c.id)));
 for(const key of ['policy129','policy130','policy131','policy132']){
  const prior=JSON.parse(archive.phases.find(p=>p.key===key).raw);
  const priorCases=Object.values(prior.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
  for(const run of prior.runs){
   const old=priorCases.find(c=>c.id===run.id),now=currentCases.find(c=>c.id===run.id);
   assert.ok(old,run.id);assert.deepEqual(now,old,`${key}/${run.id}: raw user turns and original acceptance must remain unchanged`);
  }
 }
});

// These selected calls re-observe a declared subset; full133 is retained above.
test('current134 selected evaluation preserves prior conversation and original acceptance',()=>{
 assert.equal(archive.currentFinalPhase,archive.phases.at(-1).key);
 const phase=archive.phases.find(p=>p.key==='policy134'),current=JSON.parse(phase.raw);
 const prior=JSON.parse(archive.phases.find(p=>p.key==='policy133').raw);
 const cases=Object.values(current.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 const priorCases=Object.values(prior.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 assert.equal(current.runs.length,75);assert.equal(current.completedResponses,140);assert.equal(current.actualCliInvocations,140);
 assert.equal(new Set(cases.map(c=>c.id)).size,75);
 assert.deepEqual(new Set(current.runs.map(r=>r.id)),new Set(cases.map(c=>c.id)));
 let previous=0,newCases=0,newTurns=0;
 for(const c of cases){
  const old=priorCases.find(o=>o.id===c.id);
  if(old){
   // Adapter normalizes messages/turns, default mode and must/acceptance keys; values stay exact.
   assert.deepEqual(c.turns||c.messages,old.turns||old.messages,c.id);
   assert.deepEqual(c.acceptance||c.must||[],old.acceptance||old.must||[],c.id);assert.equal(c.mode||'dialogue',old.mode||'dialogue');previous++;
  }else{newCases++;newTurns+=current.runs.find(r=>r.id===c.id).turns.length;}
 }
 assert.equal(previous,58);assert.equal(newCases,17);assert.equal(newTurns,51);
});
test('current134 helper alone preserves 351 frozen133 requests, not latest134 wire',async()=>{
 const oldPhase=archive.phases.find(p=>p.key==='policy133'),record=JSON.parse(oldPhase.raw);
 const current=JSON.parse(archive.phases.find(p=>p.key==='policy134').raw);
 const helper=current.runtimeInputSnapshots['server/investment-response-preferences.mjs'];
 const helperUrl='data:text/javascript;base64,'+Buffer.from(helper).toString('base64');
 const source=oldPhase.policySource.replace("'./investment-response-preferences.mjs'",JSON.stringify(helperUrl)).replace("'./investment-intent-admission.mjs'",JSON.stringify(new URL('../investment-intent-admission.mjs',import.meta.url).href));
 const helperOnly=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.notEqual(hash(oldPhase.policySource),hash(rootFile('server/investment-prompts.mjs')));
 const cases=Object.values(record.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);let count=0;
 for(const run of record.runs){
  const c=cases.find(c=>c.id===run.id),history=[];let i=0;
  for(const input of c.turns||c.messages){
   history.push(input);if(input.role!=='user')continue;
   const turn=run.turns[i++],payload={messages:history};if(legacy[run.mode])Object.assign(payload,{plain:true,system:legacy[run.mode]});
   const r=await helperOnly.buildInvestmentRequest(payload);
   assert.equal(r.promptSha256,turn.requestPromptSha256);assert.deepEqual(r.responsePreferences,turn.responsePreferences);
   assert.deepEqual(r.responseFormat,turn.responseFormat);assert.equal(hash(JSON.stringify(r.messages)),turn.requestMessagesSha256);
   history.push({role:'assistant',content:turn.answer});count++;
  }
 }
 assert.equal(count,351);
});

test('current135 repeats declared UX and two failed calculations with unchanged acceptance',()=>{
 const current=JSON.parse(archive.phases.find(p=>p.key==='policy135').raw);
 const prior=JSON.parse(archive.phases.find(p=>p.key==='policy134').raw);
 const cases=Object.values(current.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 const priorCases=Object.values(prior.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 assert.equal(current.runs.length,22);assert.equal(current.completedResponses,41);assert.equal(current.actualCliInvocations,41);
 assert.equal(new Set(cases.map(c=>c.id)).size,22);
 assert.deepEqual(new Set(current.runs.map(r=>r.id)),new Set(cases.map(c=>c.id)));
 for(const c of cases)assert.deepEqual(c,priorCases.find(p=>p.id===c.id),c.id);
 assert.equal(current.runtimeInputSha256['server/investment-response-preferences.mjs'],prior.runtimeInputSha256['server/investment-response-preferences.mjs']);
 assert.notEqual(current.runtimeInputSha256['server/investment-prompts.mjs'],prior.runtimeInputSha256['server/investment-prompts.mjs']);
});


test('declared136 repeats every135 case and separately observes17 new cases without QA packaging additions',()=>{
 const current=JSON.parse(archive.phases.find(p=>p.key==='policy136').raw);
 const prior=JSON.parse(archive.phases.find(p=>p.key==='policy135').raw);
 const cases=Object.values(current.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 const priorCases=Object.values(prior.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 assert.equal(current.runs.length,39);assert.equal(current.completedResponses,86);assert.equal(current.actualCliInvocations,86);
 assert.equal(new Set(cases.map(c=>c.id)).size,39);
 assert.deepEqual(new Set(current.runs.map(r=>r.id)),new Set(cases.map(c=>c.id)));
 for(const c of priorCases)assert.deepEqual(cases.find(v=>v.id===c.id),c,c.id);
 const added=cases.filter(c=>!priorCases.some(p=>p.id===c.id));
 assert.equal(added.length,17);assert.equal(current.runs.filter(r=>added.some(c=>c.id===r.id)).flatMap(r=>r.turns).length,45);
 for(const turn of current.runs.flatMap(r=>r.turns)){
  assert.match(turn.requestMessagesSha256,/^[a-f0-9]{64}$/);assert.ok(turn.responseFormat);
  assert.equal(turn.status,'COMPLETED');assert.equal(turn.exitCode,0);
 }
});


test('current136 answer comparison is bound to the real25/44 subset without erasing source HOLD',()=>{
 const phase=archive.phases.find(p=>p.key==='policy136'),record=JSON.parse(phase.raw);
 const input=JSON.parse(phase.reviewsRaw['opus-answer136-focused-input.json']);
 const proof=JSON.parse(phase.reviewsRaw['opus-answer136-final-binding.json']);
 const runBinding=JSON.parse(phase.reviewsRaw['opus-answer136-focused-binding.json']);
 assert.equal(proof.rawSha256,phase.rawSha256);assert.equal(proof.inputSha256,phase.reviewsSha256['opus-answer136-focused-input.json']);
 assert.equal(proof.reviewSha256,phase.reviewsSha256['opus-answer136-focused-review.json']);
 assert.equal(runBinding.actualExit,0);assert.equal(runBinding.inputSha256,runBinding.afterInputSha256);
 assert.equal(runBinding.inputSha256,proof.inputSha256);assert.equal(proof.fullSourceConsumerModelApproval,false);
 assert.equal(input.currentCompletedSubset.length,25);assert.equal(input.currentCompletedSubset.flatMap(v=>v.turns).length,44);
 for(const v of input.currentCompletedSubset){
  const raw=record.runs.find(r=>r.id===v.id);assert.equal(v.mode,raw.mode);assert.deepEqual(v.acceptance,raw.acceptance);
  assert.deepEqual(v.turns,raw.turns.map(t=>Object.fromEntries(['user','answer','status','responseFormat'].map(k=>[k,t[k]]))));
 }
 assert.equal(input.old24.length,12);assert.equal(input.old24.flatMap(v=>v.turns).length,24);
 for(const previous of input.old24){const current=input.currentCompletedSubset.find(v=>v.id===previous.id);assert.deepEqual(current.acceptance,previous.acceptance);assert.deepEqual(current.turns.map(t=>t.user),previous.turns.map(t=>t.user));}
 assert.equal(proof.customerProviderCalls,0);
 assert.match(JSON.parse(phase.reviewsRaw['opus-helper136-review.json']).result,/SOURCE_HOLD/);
});


test('declared137 preserves all25 original cases and captures170 actual-history requests',()=>{
 const phase=archive.phases.find(p=>p.key==='policy137'),record=JSON.parse(phase.raw);
 const prior=JSON.parse(archive.phases.find(p=>p.key==='policy136').raw);
 const cases=Object.values(record.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 const oldCases=Object.values(prior.corpusInputSnapshots).flatMap(s=>JSON.parse(s).cases);
 assert.equal(cases.length,67);assert.equal(new Set(cases.map(c=>c.id)).size,67);
 assert.equal(record.runs.length,67);assert.equal(record.actualCliInvocations,170);assert.equal(record.completedResponses,170);
 assert.equal(Object.hasOwn(record,'inputsUnchangedAtFinish'),true);assert.equal(record.inputsUnchangedAtFinish,true);
 let unchanged=0,newTurns=0;
 for(const c of cases){const old=oldCases.find(o=>o.id===c.id);if(old){assert.deepEqual(c,old,c.id);unchanged++;}else{const turns=c.turns||c.messages;assert.equal(turns.every(t=>t.role==='user'),true,c.id);newTurns+=turns.length;}}
 assert.equal(unchanged,25);assert.equal(newTurns,126);
 assert.deepEqual(new Set(record.runs.map(r=>r.id)),new Set(cases.map(c=>c.id)));
 for(const run of record.runs)for(const t of run.turns){assert.match(t.requestMessagesSha256,/^[a-f0-9]{64}$/);assert.ok(t.responseFormat);assert.equal(t.exitCode,0);}
});

test('actual137 and bounded earlier source pass retain later independent sourceNO_GO',()=>{
 const phase=archive.phases.find(p=>p.key==='policy137');
 const review=JSON.parse(phase.reviewsRaw['opus-helper137-final-review.json']);
 assert.match(review.result,/NO_GO/);assert.match(review.result,/C1/);
 assert.match(review.result,/H4/);assert.match(review.result,/M6/);
 const binding=JSON.parse(phase.reviewsRaw['opus-helper137-final-binding.json']);
 assert.equal(binding.status,'COMPLETED');assert.equal(binding.actualExit,0);assert.equal(binding.account,'personal(1)');assert.equal(binding.respondent,'claude-opus-5-5');
 assert.equal(binding.inputSha256,hash(phase.reviewsRaw['opus-helper137-final-input.json']));assert.equal(binding.afterInputSha256,binding.inputSha256);
 assert.ok(phase.reviewsRaw['ux/phase137/finalized-source-review.json']);
 const finance=JSON.parse(phase.reviewsRaw['financial/policy137-review.json']);
 assert.ok(finance);assert.equal(archive.serviceGo,false);assert.equal(archive.customerProviderCalls,0);
});
