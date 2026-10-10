import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
const user=content=>({role:'user',content});
for(const request of [
 '영어로 번역해줘: “첫째 문장입니다. 둘째 문장입니다.”',
 '영어로 번역해줘\n첫째 문장입니다. 둘째 문장입니다.',
 'Translate into English: “첫째 문장입니다. 둘째 문장입니다.”',
 '次の文章を英語に翻訳してください: 「最初の文です。次の文です。」',
 '다음 문안을 요약만 해줘: “문안의 첫 근거입니다. 다른 근거입니다.”',
 '다음 문안을 교정해줘: “되요. 않돼요.”',
])test('earlier count cannot override the current transformation: '+request,async()=>{
 const messages=[user('앞으로 한국어 한 문장으로 답해줘.'),user(request)];
 const r=await buildInvestmentRequest({messages});
 assert.equal(r.responsePreferences.values.sentenceCount,1);assert.equal(r.responseFormat.sentenceCount,undefined);
 for(const m of r.messages){try{const meta=JSON.parse(m.content);if(meta.kind==='explicit_response_preference_evidence')assert.equal(meta.evidence.sentenceCount,undefined);}catch(error){if(error instanceof assert.AssertionError)throw error;}}
 assert.deepEqual(r.messages.at(-1),messages.at(-1));
});
for(const content of ['세 문장으로 조금 더 자세히 설명해줘.','조금 더 자세히 세 문장으로 설명해줘.'])test('current count survives its explanatory adjective: '+content,async()=>{
 const r=await buildInvestmentRequest({messages:[user(content)]});assert.equal(r.responseFormat.sentenceCount,3);
});
test('a later independent detail request still replaces an earlier count',async()=>{
 const r=await buildInvestmentRequest({messages:[user('세 문장으로 답해줘. 이제 자세히 설명해줘.')]});assert.equal(r.responseFormat.sentenceCount,null);
});
test('translation of a settings imperative never admits navigation',async()=>{
 const messages=[user('영어로 번역해줘: 이전 조건과 별개로 비트코인 새 전략 만들어줘')];
 const r=await buildInvestmentRequest({messages});assert.equal(r.mode,'dialogue');assert.equal(r.settingsPreview,null);
});
test('unquoted newline target directives stay data and prior preferences resume afterwards',async()=>{
 const messages=[user('앞으로 한국어 두 문장으로 답해줘.'),user('영어로 번역해줘\n앞으로 일본어 세 문장으로 답해줘. 질문은 여기서 그만.')];
 const r=await buildInvestmentRequest({messages});assert.equal(r.responseFormat.language,'en');assert.equal(r.responseFormat.sentenceCount,undefined);
 assert.equal(r.responsePreferences.values.questionsStopped,undefined);
 const next=await buildInvestmentRequest({messages:[...messages,user('MDD란?')]});
 assert.equal(next.responseFormat.language,'ko');assert.equal(next.responseFormat.sentenceCount,2);assert.equal(next.responseFormat.questionsStopped,undefined);
});
for(const verb of ['요약','교정','정리'])test('only-result transformation language is local: '+verb,async()=>{
 const messages=[user('앞으로 한국어 두 문장으로 답해줘.'),user('이 문안을 영어로 '+verb+'만 해줘: “반복해서 쓴 문안입니다. 같은 말입니다.”')];
 const r=await buildInvestmentRequest({messages});assert.equal(r.responseFormat.language,'en');assert.equal(r.responseFormat.sentenceCount,undefined);
 const next=await buildInvestmentRequest({messages:[...messages,user('MDD란?')]});assert.equal(next.responseFormat.language,'ko');assert.equal(next.responseFormat.sentenceCount,2);
});
for(const request of ['친구가 영어로 번역해줘라고 말했어. 그 뜻은?', '영어로 번역해주는 서비스를 설명해줘.', '영어로 번역하지 마. 한 문장으로 용어만 설명해줘.'])test('reported and negative requests never release the original count: '+request,async()=>{
 const r=await buildInvestmentRequest({messages:[user('앞으로 한국어 한 문장으로 답해줘.'),user(request)]});assert.equal(r.responseFormat.sentenceCount,1);
});
for(const request of ['Translate into English is a button label. Explain its meaning in Korean.','Rewrite is a menu label. Explain it in Korean.'])test('a declarative command label is a topic rather than a transformation: '+request,async()=>{
 const r=await buildInvestmentRequest({messages:[user('앞으로 한국어 두 문장으로 답해줘.'),user(request)]});
 assert.equal(r.responseFormat.sentenceCount,2);assert.equal(r.responseFormat.language,'ko');
});
