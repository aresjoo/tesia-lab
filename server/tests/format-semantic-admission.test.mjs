import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
import {currentTransformationTask} from '../investment-response-preferences.mjs';

const declared=JSON.parse(readFileSync(new URL('./fixtures/format-semantic-admission.json',import.meta.url)));
for(const c of declared.cases)test('declared current command admission: '+c.id,async()=>{
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


for(const pattern of ['가:','“'])test('full supported history stays bounded for repeated delimiters: '+pattern,()=>{
 const content=pattern.repeat(Math.ceil(16000/pattern.length)).slice(0,16000);
 const messages=Array.from({length:4},()=>({role:'user',content}));
 assert.equal(messages.reduce((n,m)=>n+m.content.length,0),64000);
 const url=new URL('../investment-prompts.mjs',import.meta.url).href;
 const script='import {buildInvestmentRequest} from '+JSON.stringify(url)+';const r=await buildInvestmentRequest({messages:'+JSON.stringify(messages)+'});if(Object.keys(r.responseFormat).length)process.exit(2);';
 assert.equal(execFileSync(process.execPath,['--input-type=module'],{input:script,timeout:3000,stdio:'pipe'}).length,0);
});

for(const [tail,expected] of [['싶었어',{}],['분산투자를 설명해줘.',{questionsStopped:true}]])test('recursive stop conjunctions stay bounded and preserve tense: '+tail,()=>{
 const url=new URL('../investment-prompts.mjs',import.meta.url).href;
 const script='import assert from "node:assert/strict";import {buildInvestmentRequest} from '+JSON.stringify(url)+';for(const count of [40,1000]){const content="질문은 그만하고 ".repeat(count)+'+JSON.stringify(tail)+';assert.ok(content.length<=16000);const r=await buildInvestmentRequest({messages:[{role:"user",content}]});assert.deepEqual(r.responseFormat,'+JSON.stringify(expected)+');}';
 assert.equal(execFileSync(process.execPath,['--input-type=module'],{input:script,timeout:3000,stdio:'pipe'}).length,0);
});
