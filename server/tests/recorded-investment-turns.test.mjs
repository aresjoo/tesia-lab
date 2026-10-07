import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PROMPTS,buildInvestmentRequest,digestText} from '../investment-prompts.mjs';
import {createInvestmentOutputGate} from '../investment-output-gate.mjs';
const evidence=JSON.parse(readFileSync(new URL('./recorded-investment-turns.json',import.meta.url)));
const candidateProvenance=JSON.parse(readFileSync(new URL('./recorded-investment-candidate-provenance.json',import.meta.url)));
const hash=s=>createHash('sha256').update(s).digest('hex');
const active=evidence.evaluations.at(-1);
const legacySource=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const legacy=Object.fromEntries([['judgment','J'],['report','R']].map(([m,c])=>[m,legacySource.match(new RegExp("var BT_SYS_"+c+"='([^']*)';"))[1]]));
const readRuntime=file=>readFileSync(new URL('../../'+file,import.meta.url));
function assertHistoricalBindingWithCandidate(file,historicalSha256){
 const candidate=candidateProvenance.files[file];
 if(!candidate){assert.equal(hash(readRuntime(file)),historicalSha256,file);return;}
 assert.equal(candidate.historicalEffectiveSha256,historicalSha256,file+' historical base');
 const baseSnapshot=Buffer.from(candidate.baseSnapshotBase64,'base64');
 assert.equal(baseSnapshot.toString('base64'),candidate.baseSnapshotBase64,file+' canonical base64');
 assert.equal(hash(baseSnapshot),historicalSha256,file+' immutable base snapshot');
 assert.equal(hash(readRuntime(file)),candidate.candidateSha256,file+' current candidate');
 assert.notEqual(candidate.candidateSha256,historicalSha256,file+' candidate delta');
}
test('historical failures, actual calls and corpus/policy provenance remain separate from quality approval',async()=>{
 assert.equal(evidence.providerGatePass,false);assert.equal(evidence.hiddenHoldout,false);assert.equal(evidence.runtimeQualityApproval,false);
 for(const e of evidence.evaluations){
  assert.deepEqual(e.tools,[]);assert.equal(e.respondent,'claude-opus-5-5');assert.equal(e.providerGatePass,false);
  for(const p of Object.values(e.promptSnapshots))assert.equal(p.sha256,await digestText(p.text));
  for(const [f,h] of Object.entries(e.corpusSha256))assert.equal(hash(e.corpusInputSnapshots[f]),h);
  assert.equal(e.completedResponses,e.runs.flatMap(r=>r.turns).filter(t=>t.status==='COMPLETED').length);
  for(const r of e.runs)for(const t of r.turns)if(t.status==='COMPLETED')assert.ok(t.modelUsage['claude-opus-5-5']);
 }
 const partial=evidence.evaluations.find(e=>e.evaluationKey==='framed');
 assert.equal(partial.actualCliInvocations,20);assert.equal(partial.preCliInputGuardFailures,37);assert.equal(partial.semanticReviewStatus,'PARTIAL_INPUT_CHANGED');
 assert.ok(evidence.evaluations.find(e=>e.evaluationKey==='contract').manualReviews.some(r=>JSON.stringify(r.review).includes('gen_fx_budget_patch')));
 assert.equal(evidence.evaluations.find(e=>e.evaluationKey==='accepted').semanticReviewStatus,'NOT_REVIEWED');
});
test('frozen release evidence binds actual runtime and unchanged case inputs, without promoting simulated calls to live app',()=>{
 assert.equal(active.runs.length,55);assert.equal(active.completedResponses,92);assert.equal(active.actualCliInvocations,92);assert.equal(active.inputsUnchangedAtFinish,true);
 assert.deepEqual(active.promptSnapshots,PROMPTS);
 assert.equal(candidateProvenance.schemaVersion,1);assert.equal(candidateProvenance.kind,'recorded-investment-candidate-runtime-provenance');
 assert.equal(candidateProvenance.immutableBaseCommit,'8646b6525631d5e1f71e38a8e2e515f23571b5b5');
 assert.deepEqual(Object.keys(candidateProvenance.files).sort(),['server/index.mjs','server/investment-response-preferences.mjs','server/worker.mjs']);
 for(const [f,h] of Object.entries(active.runtimeInputSha256)){
  const correction=evidence.postEvalRuntimeCorrection;
  const expected=f==='index.html'?evidence.postEvalSourceCorrection.afterSha256:correction&&f===correction.file?correction.afterSha256:h;
  assertHistoricalBindingWithCandidate(f,expected);
 }
 const correction=evidence.postEvalRuntimeCorrection;
 if(correction){
  assert.equal(correction.file,'server/investment-response-preferences.mjs');
  assert.equal(correction.beforeSha256,active.runtimeInputSha256[correction.file]);
  assert.equal(correction.basePolicyUnchanged,true);assert.equal(correction.responseFrameUnchanged,true);
  assert.equal(hash(correction.afterSnapshot),correction.afterSha256);
  assert.equal(correction.recordedRequestReplay.summary.turns,92);
  for(const key of ['valuesUnchanged','evidenceUnchanged','builderPreferenceUnchanged','systemShaUnchanged'])assert.equal(correction.recordedRequestReplay.summary[key],92,key);
  assert.deepEqual(correction.recordedRequestReplay.changed,[]);assert.equal(correction.recordedRequestReplay.actualExit,0);
 }
 assert.equal(evidence.postEvalSourceCorrection.beforeSha256,active.runtimeInputSha256['index.html']);
 for(const [f,h] of Object.entries(active.corpusSha256))assert.equal(hash(readFileSync(new URL('./'+f,import.meta.url))),h,f);
 assert.match(active.scope,/not application SDK role wire/);
 const browser=evidence.reviewReceipts.sourceBrowser;for(const [f,h] of Object.entries(browser.inputSha256))assertHistoricalBindingWithCandidate(f,h);
 assert.equal(browser.aggregate.passCount,42);assert.equal(browser.aggregate.failCount,0);
 const binding=evidence.reviewReceipts.opusDeliveryFinalBinding;assert.deepEqual(binding.before,binding.after);for(const [f,h] of Object.entries(binding.before))assertHistoricalBindingWithCandidate(f,h);
 assert.ok(evidence.reviewReceipts.opusDeliveryFinal.modelUsage['claude-opus-5-5']);
 const policyBinding=evidence.reviewReceipts.opusStructuralClosureBinding;assert.deepEqual(policyBinding.before,policyBinding.after);for(const [f,h] of Object.entries(policyBinding.before))assertHistoricalBindingWithCandidate(f,h);
 assert.ok(evidence.reviewReceipts.opusStructuralClosure.modelUsage['claude-opus-5-5']);
 assert.equal(evidence.postEvalSourceCorrection.beforeSha256,evidence.postEvalSourceCorrection.afterSha256);
 assert.equal(evidence.historicalPostEvalSourceCorrection.file,'index.html');
 assert.notEqual(evidence.historicalPostEvalSourceCorrection.beforeSha256,evidence.historicalPostEvalSourceCorrection.afterSha256);
});
for(const run of active.runs)test('actual history, format frame and fragmented schema replay: '+run.id,async()=>{
 const history=[];
 for(const [index,t] of run.turns.entries()){
  history.push({role:'user',content:t.user});
  const payload={messages:history};if(legacy[run.mode])Object.assign(payload,{plain:true,system:legacy[run.mode]});
  const r=await buildInvestmentRequest(payload);
  assert.equal(r.promptSha256,t.requestPromptSha256);assert.equal(r.basePolicySha256,t.basePolicySha256);assert.deepEqual(r.responsePreferences,t.responsePreferences);
  assert.equal(t.answerSha256,hash(t.answer));assert.equal(t.cliInvoked,true);
  const events=[],gate=createInvestmentOutputGate(v=>events.push(v),{allowDisplay:t.allowDisplay,allowTitle:t.allowTitle,allowQuestions:t.allowQuestions});
  for(let i=0;i<t.answer.length;i+=7)gate.send({text:t.answer.slice(i,i+7)});gate.send({done:true});
  assert.equal(events.at(-1)?.done?'PASS':'BLOCKED',t.gateReplay.status);
  assert.equal(events.map(v=>v.text||'').join(''),t.gateReplay.completedText);
  for(const e of Object.values(r.responsePreferences.evidence))assert.equal(history[e.messageIndex].content.slice(e.start,e.end),e.text);
  history.push({role:'assistant',content:t.answer});
 }
});
