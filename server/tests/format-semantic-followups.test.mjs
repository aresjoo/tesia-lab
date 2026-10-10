import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
import {currentTransformationTask} from '../investment-response-preferences.mjs';

const declared=JSON.parse(readFileSync(new URL('./fixtures/format-semantic-followups.json',import.meta.url)));
for(const c of declared.cases)test('declared semantic continuation: '+c.id,async()=>{
 const messages=structuredClone(c.messages),before=structuredClone(messages);
 const r=await buildInvestmentRequest({messages});
 assert.deepEqual(r.responseFormat,c.expectedCurrentFormat);
 if(c.expectedCurrentTransformationTask!==undefined)assert.equal(currentTransformationTask(messages),c.expectedCurrentTransformationTask);
 const next=await buildInvestmentRequest({messages:[...messages,{role:'assistant',content:'후속 검산용 합성 답변입니다.'},{role:'user',content:declared.followingUser}]});
 assert.deepEqual(next.responseFormat,c.expectedFollowingFormat);
 assert.deepEqual(messages,before);
 for(const e of Object.values(r.responsePreferences.evidence)){
  assert.equal(messages[e.messageIndex].role,'user');
  assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
 }
});

for(const length of [10000,16000])test('colon parsing completes within a bounded child process: '+length,()=>{
 const url=new URL('../investment-prompts.mjs',import.meta.url).href;
 const spaces=Math.floor((length-2)*2/3);
 const text='x'+' '.repeat(spaces)+'y'+':'.repeat(length-2-spaces);
 assert.equal(text.length,length);
 const script='import {buildInvestmentRequest} from '+JSON.stringify(url)+';const r=await buildInvestmentRequest({messages:[{role:"user",content:'+JSON.stringify(text)+'}]});if(Object.keys(r.responseFormat).length)process.exit(2);';
 assert.equal(execFileSync(process.execPath,['--input-type=module','-e',script],{timeout:3000,stdio:'pipe'}).length,0);
});
