import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
import {currentTransformationTask} from '../investment-response-preferences.mjs';

const declared=JSON.parse(readFileSync(new URL('./fixtures/format-semantic-boundaries.json',import.meta.url)));
for(const c of declared.cases)test('semantic format ownership: '+c.id,async()=>{
 const messages=[...declared.commonPrior,{role:'user',content:c.text}];
 const before=structuredClone(messages);
 const current=await buildInvestmentRequest({messages});
 assert.deepEqual(current.responseFormat,c.expectedCurrentFormat);
 assert.equal(currentTransformationTask(messages),c.expectedCurrentTransformationTask);
 const following=await buildInvestmentRequest({messages:[...messages,{role:'assistant',content:'후속 검산용 합성 답변입니다.'},{role:'user',content:declared.followingUser}]});
 assert.deepEqual(following.responseFormat,c.expectedFollowingFormat);
 assert.deepEqual(messages,before);
 for(const e of Object.values(current.responsePreferences.evidence)){
  assert.equal(messages[e.messageIndex].role,'user');
  assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
 }
});

test('Korean bonds topic preserves the original language directive and its provenance',async()=>{
 const messages=[...declared.commonPrior,{role:'user',content:'Explain the risk of investing in Korean bonds.'}];
 const r=await buildInvestmentRequest({messages});
 assert.equal(r.responseFormat.language,'ko');
 assert.equal(r.responsePreferences.evidence.language.messageIndex,0);
 const e=r.responsePreferences.evidence.language;
 assert.equal(messages[0].content.slice(e.start,e.end),e.text);
 assert.match(e.text,/한국어/);
});

test('a previous-answer summary preserves the independent following Japanese directive',async()=>{
 const messages=[...declared.commonPrior,{role:'user',content:'위 답변을 요약해줘\n앞으로 일본어로 답해줘'}];
 const r=await buildInvestmentRequest({messages});
 assert.equal(currentTransformationTask(messages),true);
 assert.deepEqual(r.responseFormat,{language:'ja'});
 const following=await buildInvestmentRequest({messages:[...messages,{role:'assistant',content:'要約です。'},{role:'user',content:declared.followingUser}]});
 assert.deepEqual(following.responseFormat,{language:'ja',sentenceCount:1});
 const e=r.responsePreferences.evidence.language;
 assert.equal(e.messageIndex,2);
 assert.equal(messages[2].content.slice(e.start,e.end),e.text);
});

for(const [name,text]of [
 ['newlines','x'+'\n'.repeat(4999)+'y'+'\n'.repeat(4999)],
 ['mixed whitespace','x'+' \t\n'.repeat(1666)+'y'+' \t\n'.repeat(1666)],
])test('bounded format parsing completes for a 10000-character '+name+' input',()=>{
 const moduleUrl=new URL('../investment-response-preferences.mjs',import.meta.url).href;
 const script='import {explicitResponsePreferences} from '+JSON.stringify(moduleUrl)+';const text='+JSON.stringify(text)+';const r=explicitResponsePreferences([{role:"user",content:text}]);if(Object.keys(r.values).length)process.exit(2);';
 // The child timeout bounds a regression without blocking the entire test worker.
 assert.equal(execFileSync(process.execPath,['--input-type=module','-e',script],{timeout:3000,stdio:'pipe'}).length,0);
});
