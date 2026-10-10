import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
import {currentTransformationTask} from '../investment-response-preferences.mjs';

const declared=JSON.parse(readFileSync(new URL('./fixtures/format-reported-language-regression.json',import.meta.url)));
test('reported-language regression preserves original declarations',()=>{
 for(const declaration of Object.values(declared.declarations))assert.equal(createHash('sha256').update(declaration.raw).digest('hex'),declaration.sha256);
 assert.equal(declared.cases.length,98);
 assert.equal(declared.unresolvedInterpretationCases.length,2);
 assert.equal(declared.unsupportedFormatCases.length,1);
 const limitation=declared.unsupportedFormatCases[0];
 assert.equal(limitation.strictAcceptance,'FAIL');
 assert.equal(limitation.expectedCurrentFields.language,'en');
 assert.equal(limitation.actualCurrentFields.language,'ko');
 assert.equal(limitation.supported,false);
 assert.ok(declared.unresolvedInterpretationCases.every(c=>c.interpretationBoundary===true));
});
function fields(actual,expected){
 for(const [key,value] of Object.entries(expected))assert.equal(actual[key],value,key);
 assert.equal(actual.questionsStopped,expected.questionsStopped,'reported commands must not grant question-stop authority');
}
for(const c of declared.cases)test('reported language and actual directive remain distinct: '+c.id,async()=>{
 const messages=structuredClone(c.messages),before=structuredClone(messages);
 const current=await buildInvestmentRequest({messages});
 fields(current.responseFormat,c.expectedCurrentFields);
 if(c.expectedCurrentValues)assert.deepEqual(current.responsePreferences.values,c.expectedCurrentValues);
 if(c.expectedCurrentTransformationTask!==undefined)assert.equal(currentTransformationTask(messages),c.expectedCurrentTransformationTask);
 if(c.expectedEvidence)assert.deepEqual(current.responsePreferences.evidence,c.expectedEvidence);
 const following=await buildInvestmentRequest({messages:[...messages,{role:'assistant',content:'기록용 합성 응답입니다.'},{role:'user',content:declared.followingUser}]});
 fields(following.responseFormat,c.expectedFollowingFields);
 if(c.expectedFollowingValues)assert.deepEqual(following.responsePreferences.values,c.expectedFollowingValues);
 assert.deepEqual(messages,before);
 assert.deepEqual(current.messages.slice(-messages.length),messages);
 for(const r of [current,following])for(const e of Object.values(r.responsePreferences.evidence)){
  const history=r===current?messages:[...messages,{role:'assistant',content:'기록용 합성 응답입니다.'},{role:'user',content:declared.followingUser}];
  assert.equal(history[e.messageIndex].role,'user');
  assert.equal(history[e.messageIndex].content.slice(e.start,e.end),e.text);
 }
});

test('unsupported colon-only format preserves the observed limitation',async()=>{
 const c=declared.unsupportedFormatCases[0];
 const r=await buildInvestmentRequest({messages:structuredClone(c.messages)});
 assert.equal(r.responseFormat.language,c.actualCurrentFields.language);
 assert.notEqual(r.responseFormat.language,c.expectedCurrentFields.language);
});
