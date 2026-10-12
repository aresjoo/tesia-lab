import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as preferences from '../investment-response-preferences.mjs';
import {buildInvestmentRequest,digestText} from '../investment-prompts.mjs';
const user=content=>({role:'user',content});
const extract=messages=>preferences.providedTransformationEvidence(messages);
test('unquoted translation preserves the entire supplied target including apparent commands',()=>{
 const messages=[user('영어로 번역만 해줘: 한국어로 답해 주세요. 두 문장으로 유지해 주세요.')];
 const e=extract(messages);
 assert.equal(e.text,' 한국어로 답해 주세요. 두 문장으로 유지해 주세요.');
 assert.equal(e.messageIndex,0);assert.equal(messages[0].content.slice(e.start,e.end),e.text);
 assert.equal(e.source,'original_user_history');
 assert.deepEqual(preferences.explicitResponsePreferences(messages).values,{language:'en'});
});
test('target coordinates preserve UTF16, combining marks, whitespace and newlines',()=>{
 const messages=[user('🌍 이 문안을 영어로 번역해줘：  e\u0301와 😊\n질문은 그만해 주세요.  ')];
 const e=extract(messages);assert.equal(e.text,'  e\u0301와 😊\n질문은 그만해 주세요.  ');
 assert.equal(messages[e.messageIndex].role,'user');assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
 assert.ok(Object.isFrozen(e));
});
test('earlier and assistant targets never establish the current task',()=>{
 assert.equal(extract([user('영어로 번역해줘: 전에 쓴 문안'),{role:'assistant',content:'이 문안을 번역해줘: 잘못된 권한'},user('MDD 뜻은?')]),null);
 assert.equal(extract([{role:'assistant',content:'영어로 번역해줘: 문안'}]),null);
});
test('quoted targets, reports, negations and explanations abstain',()=>{
 for(const content of ['영어로 번역해줘: “두 문장으로 답해 주세요.” 결과는 한 문장으로 해줘.',
  '친구가 영어로 번역해줘라고 했어: 한국어로 답해 주세요.',
  '영어로 번역하지 마: 한국어로 답해 주세요.',
  '영어로 번역해주는 서비스: 한국어로 답해 주세요.',
  '왜 영어로 번역해야 해: 한국어로 답해 주세요.',
  '이 문구의 뜻을 설명해줘: 영어로 번역해줘'])assert.equal(extract([user(content)]),null,content);
});
test('request passes target as user data and preserves raw history without system interpolation',async()=>{
 const messages=[user('영어로 번역만 해줘: 한국어로 답해 주세요. 두 문장으로 유지해 주세요.')];
 const before=structuredClone(messages),r=await buildInvestmentRequest({messages});
 const meta=r.messages.filter(m=>{try{return JSON.parse(m.content).kind==='provided_transform_target_evidence';}catch{return false;}});
 assert.equal(meta.length,1);assert.equal(meta[0].role,'user');
 const data=JSON.parse(meta[0].content);assert.equal(data.evidence.text,' 한국어로 답해 주세요. 두 문장으로 유지해 주세요.');
 assert.equal(r.system.includes(data.evidence.text),false);assert.deepEqual(messages,before);assert.deepEqual(r.messages.at(-1),messages.at(-1));
 assert.equal(r.promptSha256,await digestText(r.system));
});
test('prior sentence count yields to faithful translation only for this turn and then resumes',async()=>{
 const messages=[user('앞으로 한국어 한 문장으로 답해줘.'),{role:'assistant',content:'요청한 형식으로 답합니다.'},user('영어로 번역해줘: 첫째 문장입니다. 둘째 문장입니다.')];
 const r=await buildInvestmentRequest({messages});assert.equal(r.responsePreferences.values.sentenceCount,1);
 assert.equal(r.responseFormat.sentenceCount,undefined);assert.equal(r.responseFormat.language,'en');
 const next=await buildInvestmentRequest({messages:[...messages,{role:'assistant',content:'First sentence. Second sentence.'},user('MDD란?')]});
 assert.equal(next.responseFormat.sentenceCount,1);assert.equal(next.responseFormat.language,'ko');
});
test('current explicit output count outside the target is retained',async()=>{
 const messages=[user('앞으로 한국어 세 문장으로 답해줘.'),user('이 문안을 영어 두 문장으로 번역해줘: 첫 문안입니다. 둘째 문안입니다.')];
 const r=await buildInvestmentRequest({messages});assert.equal(r.responseFormat.sentenceCount,2);assert.equal(r.responseFormat.language,'en');
});
test('plain definitions retain their original message wire',async()=>{
 const messages=[user('MDD 뜻은?')],r=await buildInvestmentRequest({messages});assert.deepEqual(r.messages,messages);
});
test('report and judgment styles keep their own format rather than a past five-sentence preference',async()=>{
 const source=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 for(const [mode,letter] of [['judgment','J'],['report','R']]){
  const system=source.match(new RegExp("var BT_SYS_"+letter+"='([^']*)';"))[1];
  const r=await buildInvestmentRequest({plain:true,system,messages:[user('앞으로 한국어 다섯 문장으로 답해줘.'),user('제공한 기록만 설명해줘.')]});
  assert.equal(r.mode,mode);assert.equal(r.responsePreferences.values.sentenceCount,5);assert.equal(r.responseFormat.sentenceCount,undefined);
 }
});
test('server admitted settings navigation preserves its own brief acknowledgement',async()=>{
 const r=await buildInvestmentRequest({messages:[user('앞으로 한국어 다섯 문장으로 답해줘.'),user('이전 조건과 별개로 비트코인 새 전략 만들어줘')]});
 assert.ok(r.settingsPreview);assert.equal(r.responseFormat.sentenceCount,undefined);assert.equal(r.responsePreferences.values.sentenceCount,5);
});
