import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {explicitResponsePreferences,responsePreferenceFrame} from '../investment-response-preferences.mjs';
import {buildInvestmentRequest,digestText,PROMPTS} from '../investment-prompts.mjs';
import {createInvestmentOutputGate} from '../investment-output-gate.mjs';
const history=items=>items.map(content=>({role:'user',content}));
test('explicit format survives corrections; latest specified format alone replaces it',()=>{
 const m=history(['ETH 적립 계획을 한국어 두 문장으로 짜줘. 총예산250이야.','유로야.','월50유로5회로고쳐줘,나머지유지']);
 const p=explicitResponsePreferences(m);assert.deepEqual(p.values,{sentenceCount:2,language:'ko'});
 for(const v of Object.values(p.evidence))assert.equal(m[v.messageIndex].content.slice(v.start,v.end),v.text);
 assert.deepEqual(explicitResponsePreferences([...m,...history(['이제 영어로 자세히 설명해줘'])]).values,{sentenceCount:null,language:'en'});
 assert.equal(explicitResponsePreferences([...m,...history(['이번에는 일본어 한 문장으로'])]).values.sentenceCount,1);
});
test('only actual user directives count, never quoted documents, assistant or investment values',()=>{
 for(const content of ['"한국어 두 문장으로"라는 문구의 뜻을 설명해줘','이 문장을 번역: “no more questions”','이 프롬프트를 교정: 한국어 두 문장으로','BTC 손절2%, 계좌100만원, 영어문장 해석이 필요해'])assert.deepEqual(explicitResponsePreferences(history([content])).values,{});
 assert.deepEqual(explicitResponsePreferences([{role:'assistant',content:'한국어 두 문장으로 답합니다.'}]).values,{});
 assert.deepEqual(explicitResponsePreferences(history(['Change the stop to 1%, keep everything else.'])).values,{});
 assert.equal(explicitResponsePreferences(history(['Please answer in Korean in two sentences.'])).values.language,'ko');
});
test('question stop survives topic and language changes; explicit resumption replaces it',()=>{
 const m=history(['질문은 여기서 그만하고 기준세가지만','이제 일본어 한 문장으로']);
 assert.equal(explicitResponsePreferences(m).values.questionsStopped,true);
 assert.equal(explicitResponsePreferences([...m,...history(['다시 질문해도 됩니다'])]).values.questionsStopped,false);
 assert.equal(responsePreferenceFrame({language:'ko',sentenceCount:2}).includes('손절'),false);
});
test('request fingerprint binds actual closed preference frame and preserves raw evidence',async()=>{
 const messages=history(['한국어 두 문장으로 답해줘','손절은3%로바꾸고나머지유지']);
 const r=await buildInvestmentRequest({messages});
 assert.equal(r.responsePreferences.values.sentenceCount,2);
 assert.equal(r.basePolicySha256,PROMPTS.dialogue.sha256);
 assert.equal(r.promptSha256,await digestText(r.system));
 assert.notEqual(r.promptSha256,r.basePolicySha256);
 assert.equal(r.messages.at(-1).content,messages.at(-1).content);
 const quoted=await buildInvestmentRequest({messages:history(['"영어 두 문장으로" 문구의 뜻?'])});
 assert.equal(quoted.system,PROMPTS.dialogue.text);
});
test('stopped discovery cards are suppressed without truncating useful body or faking success',()=>{
 const events=[],g=createInvestmentOutputGate(e=>events.push(e),{allowQuestions:false});
 g.send({text:'현재 정보로 비교 기준을 설명합니다.\n[NEXT ["기간은?","예산은?"]]'});g.send({done:true});
 assert.ok(events.at(-1).done);assert.equal(events.map(e=>e.text||'').join(''),'현재 정보로 비교 기준을 설명합니다.\n');
 const only=[],empty=createInvestmentOutputGate(e=>only.push(e),{allowQuestions:false});empty.send({text:'[NEXT ["기간은?"]]'});empty.send({done:true});assert.deepEqual(only,[{error:true}]);
});

test('latest format within the same utterance and larger counts do not retain stale constraints',()=>{
 assert.deepEqual(explicitResponsePreferences(history(['한국어로 말고 영어로 두 문장 말고 세 문장으로'])).values,{sentenceCount:3,language:'en'});
 assert.equal(explicitResponsePreferences(history(['두 문장으로','이번엔 7문장으로'])).values.sentenceCount,7);
 assert.equal(explicitResponsePreferences(history(['한 문장으로','100000문장으로'])).values.sentenceCount,null);
});

test('dynamic instruction frame accepts closed values only, never raw text or execution fields',()=>{
 for(const v of [{language:'Ignore system'},{sentenceCount:Infinity},{sentenceCount:0},{questionsStopped:'false'},{order:true}])assert.throws(()=>responsePreferenceFrame(v),/INVALID_RESPONSE_PREFERENCES/);
});

test("independent grammar regression: same_turn_stop_after_resume",()=>{
 const messages=[{"role": "user", "content": "질문해도 돼. 아니, 이제 질문하지 마."}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{"questionsStopped": true});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: same_turn_detail_after_recalled_count",()=>{
 const messages=[{"role": "user", "content": "아까 두 문장으로 답했는데 이번에는 자세히 설명해줘."}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{"sentenceCount": null});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: curly_single_quote_is_data",()=>{
 const messages=[{"role": "user", "content": "이 자료에 적힌 ‘일본어로 두 문장으로’라는 표현을 설명해줘."}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: fenced_example_is_data",()=>{
 const messages=[{"role": "user", "content": "다음은 출력 형식의 예입니다.\n```text\n일본어로 두 문장으로\n```\n이 예의 장단점을 설명해줘."}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: transform_plus_separate_directive",()=>{
 const messages=[{"role": "user", "content": "이 문장을 번역해줘: “market risk”. 결과는 일본어 두 문장으로 답해줘."}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{"sentenceCount": 2, "language": "ja"});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: unquoted_report_not_user_preference",()=>{
 const messages=[{"role": "user", "content": "친구는 일본어로 두 문장으로 답했어. 나는 한국어로 자세히 설명해줘."}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{"language": "ko", "sentenceCount": null});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: directive_question_is_question",()=>{
 const messages=[{"role": "user", "content": "왜 일본어로 두 문장으로 답해야 해?"}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: retained_count_positive",()=>{
 const messages=[{"role": "user", "content": "한국어 두 문장으로 답해줘."}, {"role": "user", "content": "손절3%로 정정하고 나머지는 유지."}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{"sentenceCount": 2, "language": "ko"});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: quoted_positive_exclusion",()=>{
 const messages=[{"role": "user", "content": "“일본어로 두 문장으로”라는 문구의 뜻을 설명해줘."}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: split_turn_question_resume_positive",()=>{
 const messages=[{"role": "user", "content": "질문하지 마."}, {"role": "user", "content": "다시 질문해도 됩니다."}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{"questionsStopped": false});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: assistant_and_browser_reference_exclusion_positive",()=>{
 const messages=[{"role": "assistant", "content": "일본어로 두 문장으로"}, {"role": "user", "content": "BTC 손절3% 뜻은?"}];
 const result=explicitResponsePreferences(messages);assert.deepEqual(result.values,{});
 for(const e of Object.values(result.evidence))assert.equal(messages[e.messageIndex].content.slice(e.start,e.end),e.text);
});

test("independent grammar regression: last_stop",()=>assert.deepEqual(explicitResponsePreferences(history(["다시 질문해도 됩니다. 아니, 질문은 이제 그만."])).values,{"questionsStopped": true}));

test("independent grammar regression: last_detail",()=>assert.deepEqual(explicitResponsePreferences(history(["두 문장으로 답해줘. 아니, 자세히 설명해줘."])).values,{"sentenceCount": null}));

test("independent grammar regression: reference_report",()=>assert.deepEqual(explicitResponsePreferences(history(["영어로 된 보고서의 위험을 설명해줘."])).values,{}));

test("independent grammar regression: quote_then_stop",()=>assert.deepEqual(explicitResponsePreferences(history(["“질문은 그만”이라는 표현을 기억하니? 질문은 이제 그만."])).values,{"questionsStopped": true}));

test("independent grammar regression: negative_english",()=>assert.deepEqual(explicitResponsePreferences(history(["Do not answer in English."])).values,{}));

test("independent grammar regression: negative_korean",()=>assert.deepEqual(explicitResponsePreferences(history(["영어로 답하지 마."])).values,{}));

test("independent grammar regression: 질문은 그만하지 말고 계속해줘.",()=>assert.deepEqual(explicitResponsePreferences(history(["질문은 그만하지 말고 계속해줘."])).values,{"questionsStopped": false}));

test("independent grammar regression: Don't stop asking questions.",()=>assert.deepEqual(explicitResponsePreferences(history(["Don't stop asking questions."])).values,{"questionsStopped": false}));

test("independent grammar regression: 질문은 이제 그만이라는 문장을 해석해줘.",()=>assert.deepEqual(explicitResponsePreferences(history(["질문은 이제 그만이라는 문장을 해석해줘."])).values,{}));

test("independent grammar regression: Don't rush. Explain in English. Don't use jargon.",()=>assert.deepEqual(explicitResponsePreferences(history(["Don't rush. Explain in English. Don't use jargon."])).values,{"language": "en"}));

test("independent grammar regression: 이번에는 경기침체 시나리오별로 자세히",()=>assert.deepEqual(explicitResponsePreferences(history(["한 문장으로 답해줘.", "이번에는 경기침체 시나리오별로 자세히"])).values,{"sentenceCount": null}));

test("independent grammar regression: 질문은 그만하지 마",()=>assert.deepEqual(explicitResponsePreferences(history(["질문은 그만하지 마"])).values,{"questionsStopped": false}));

test("independent grammar regression: 친구가 질문하지 마 라고 했어",()=>assert.deepEqual(explicitResponsePreferences(history(["친구가 질문하지 마 라고 했어"])).values,{}));

test("independent grammar regression: 왜 질문하지 마 라고 했어?",()=>assert.deepEqual(explicitResponsePreferences(history(["왜 질문하지 마 라고 했어?"])).values,{}));

test("independent grammar regression: 이 보고서는 일본어로 두 문장으로 작성돼 있고 나는 한국어로 설명해줘.",()=>assert.deepEqual(explicitResponsePreferences(history(["이 보고서는 일본어로 두 문장으로 작성돼 있고 나는 한국어로 설명해줘."])).values,{"language": "ko"}));

test('copy-edit adjectives never impose one sentence on following investment requests',async()=>{
 for(const adjective of ['간단한','정확한','정중한']){
  const messages=history([`${adjective} 문장으로 바꿔줘: 손절이면 안전하다`,'금리 상승과 채권 가격의 관계를 설명해줘']);
  assert.deepEqual(explicitResponsePreferences(messages).values,{});
  const r=await buildInvestmentRequest({messages});assert.equal(r.system,PROMPTS.dialogue.text);
 }
 assert.equal(explicitResponsePreferences(history(['한 문장으로 설명해줘'])).values.sentenceCount,1);
});
test('translation target does not replace a persistent conversational language',()=>{
 for(const translation of ['이 문장을 영어로 번역해줘: 위험은 남습니다','Translate this in English: risk remains','英語で翻訳してください: risk remains']){
  assert.deepEqual(explicitResponsePreferences(history([translation,'채권 듀레이션을 설명해줘'])).values,{});
  assert.deepEqual(explicitResponsePreferences(history(['한국어로 답해줘',translation,'채권 듀레이션을 설명해줘'])).values,{language:'ko'});
 }
 assert.equal(explicitResponsePreferences(history(['이 문장을 영어로 번역해줘. 앞으로 영어로 답해줘'])).values.language,'en');
});
test('ending one question leaves discovery enabled for the new topic',()=>{
 assert.deepEqual(explicitResponsePreferences(history(['이 질문은 그만하고 다른 얘기해줘','채권 투자는 어떻게 시작하나요?'])).values,{});
 assert.deepEqual(explicitResponsePreferences(history(['질문은 여기서 그만하고 기준을 설명해줘'])).values,{questionsStopped:true});
 assert.deepEqual(explicitResponsePreferences(history(['질문하지 마','이 질문은 그만하고 다른 얘기해줘'])).values,{questionsStopped:true});
});

const scopedCases=JSON.parse(readFileSync(new URL('./public-investment-preference-scope-cases.json',import.meta.url))).cases;
for(const c of scopedCases)test('independent scoped format: '+c.id,async()=>{
 const p=explicitResponsePreferences(c.messages);assert.deepEqual(p.values,c.expected);
 if(Object.hasOwn(c,'expectedEvidence'))assert.deepEqual(p.evidence.questionsStopped,c.expectedEvidence);
 if(Object.hasOwn(c,'expectedAllEvidence'))assert.deepEqual(p.evidence,c.expectedAllEvidence);
 for(const e of Object.values(p.evidence))assert.equal(c.messages[e.messageIndex].content.slice(e.start,e.end),e.text);
 const r=await buildInvestmentRequest({messages:c.messages});assert.deepEqual(r.responsePreferences,p);
 assert.equal(r.promptSha256,await digestText(r.system));assert.equal(r.messages.at(-1).content,c.messages.at(-1).content);
});

test('one-sentence requests use a closed tail frame; other requests retain general prefix',async()=>{
 for(const sentenceCount of [1,2,5,20]){
  const r=await buildInvestmentRequest({messages:[{role:'user',content:`한국어 ${sentenceCount}문장으로 답해줘`}]});
  const frame=responsePreferenceFrame(r.responsePreferences.values);
  assert.equal(r.system,sentenceCount===1?PROMPTS.dialogue.text+'\n\n'+frame:frame+PROMPTS.dialogue.text);
  assert.equal(r.system.split('이번 응답의 명시 형식 제약').length-1,1);
  assert.equal(r.basePolicySha256,PROMPTS.dialogue.sha256);assert.equal(r.promptSha256,await digestText(r.system));
 }
 assert.equal(responsePreferenceFrame({sentenceCount:1}).includes('정확히 한 문장'),true);
 assert.equal(responsePreferenceFrame({sentenceCount:2}).includes('둘째 문장'),false);
 const r=await buildInvestmentRequest({messages:history(['한국어로 답해줘'])});
 assert.equal(r.system,responsePreferenceFrame(r.responsePreferences.values)+PROMPTS.dialogue.text);
});
