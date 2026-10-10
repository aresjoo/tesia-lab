import test from 'node:test';
import assert from 'node:assert/strict';
import {currentTransformationTask,explicitResponsePreferences,providedTransformationEvidence} from '../investment-response-preferences.mjs';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
const declared=[
 {
  "id": "ordinary-stop-correction",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "BTC 손절을 3%에서 2%로 바꿔줘."
   }
  ],
  "expectedCurrentFormat": {
   "language": "ko",
   "sentenceCount": 1
  },
  "expectedCurrentTransformationTask": false
 },
 {
  "id": "ordinary-indicator-difference",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "RSI와 MACD 차이를 정리해줘."
   }
  ],
  "expectedCurrentFormat": {
   "language": "ko",
   "sentenceCount": 1
  },
  "expectedCurrentTransformationTask": false
 },
 {
  "id": "ordinary-halving-summary",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "반감기를 요약해줘."
   }
  ],
  "expectedCurrentFormat": {
   "language": "ko",
   "sentenceCount": 1
  },
  "expectedCurrentTransformationTask": false
 },
 {
  "id": "ordinary-english-topic-summary",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "Please summarize the leverage risk."
   }
  ],
  "expectedCurrentFormat": {
   "language": "ko",
   "sentenceCount": 1
  },
  "expectedCurrentTransformationTask": false
 },
 {
  "id": "ordinary-topic-newline-stop",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "이 전략 장단점 정리해줘\n질문은 여기서 그만"
   }
  ],
  "expectedCurrentFormat": {
   "language": "ko",
   "sentenceCount": 1,
   "questionsStopped": true
  },
  "expectedCurrentTransformationTask": false
 },
 {
  "id": "modified-translation-meaning",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "뜻이 달라지지 않게 영어로 번역해줘: “첫째 문장입니다. 둘째 문장입니다.”"
   }
  ],
  "expectedCurrentFormat": {
   "language": "en"
  },
  "expectedCurrentTransformationTask": true
 },
 {
  "id": "modified-translation-natural",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "직역하지 말고 자연스럽게 번역해줘: “첫째 문장입니다. 둘째 문장입니다.”"
   }
  ],
  "expectedCurrentFormat": {
   "language": "ko"
  },
  "expectedCurrentTransformationTask": true
 },
 {
  "id": "modified-copyedit-meaning",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "의미를 유지해서 교정해줘: “첫째 문장입니다. 둘째 문장입니다.”"
   }
  ],
  "expectedCurrentFormat": {
   "language": "ko"
  },
  "expectedCurrentTransformationTask": true
 },
 {
  "id": "reported-local-language",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "친구가 영어로 번역해줘라고 말했어. 그 뜻은?"
   }
  ],
  "expectedCurrentFormat": {
   "language": "ko",
   "sentenceCount": 1
  },
  "expectedCurrentTransformationTask": false,
  "expectedFollowingFormat": {
   "language": "ko",
   "sentenceCount": 1
  }
 },
 {
  "id": "reported-persistent-count",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "친구가 세 문장으로 답해줘라고 말했어"
   }
  ],
  "expectedCurrentFormat": {
   "language": "ko",
   "sentenceCount": 1
  },
  "expectedCurrentTransformationTask": false,
  "expectedFollowingFormat": {
   "language": "ko",
   "sentenceCount": 1
  }
 },
 {
  "id": "quoted-initial-target-tail",
  "turns": [
   {
    "role": "user",
    "content": "앞으로 한국어 한 문장으로 답해줘."
   },
   {
    "role": "user",
    "content": "영어로 번역해줘: “시장은 불안합니다”라고 그는 말했다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
   }
  ],
  "expectedCurrentFormat": {
   "language": "en"
  },
  "expectedCurrentTransformationTask": true,
  "expectedFollowingFormat": {
   "language": "ko",
   "sentenceCount": 1
  }
 }
];
for(const c of declared)test(c.id,async()=>{
 assert.deepEqual((await buildInvestmentRequest({messages:c.turns})).responseFormat,c.expectedCurrentFormat);
 assert.equal(currentTransformationTask(c.turns),c.expectedCurrentTransformationTask);
 if(c.expectedFollowingFormat)assert.deepEqual((await buildInvestmentRequest({messages:[...c.turns,{role:'user',content:'이제 분산투자를 설명해줘.'}]})).responseFormat,c.expectedFollowingFormat);
 const {evidence}=explicitResponsePreferences(c.turns);
 for(const e of Object.values(evidence))assert.equal(c.turns[e.messageIndex].content.slice(e.start,e.end),e.text);
});
test('same-sentence comma detail keeps explicit three',async()=>{
 const messages=[{role:'user',content:'세 문장으로, 조금 더 자세히 RSI를 설명해줘.'}];
 assert.deepEqual((await buildInvestmentRequest({messages})).responseFormat,{sentenceCount:3});
});
test('independent later detail still replaces explicit three',async()=>{
 const messages=[{role:'user',content:'세 문장으로 답해줘. 이제 자세히 설명해줘.'}];
 assert.deepEqual((await buildInvestmentRequest({messages})).responseFormat,{sentenceCount:null});
});
test('quoted article tail does not produce unquoted auxiliary evidence',()=>{
 const messages=[{role:'user',content:'영어로 번역해줘: “시장은 불안합니다”라고 그는 말했다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘.'}];
 assert.equal(providedTransformationEvidence(messages),null);
 assert.deepEqual(explicitResponsePreferences(messages).values,{language:'en'});
});
test('closed quoted target preserves explicitly outside instruction bytes',()=>{
 const text='다음 인용문을 영어로 번역해줘: "가격은 변할 수 있습니다." 번역 대상은 여기까지야. 번역문 뒤에는 그 문장의 뜻을 한국어 한 문장으로 덧붙여줘.';
 const messages=[{role:'user',content:text}];
 assert.equal(providedTransformationEvidence(messages),null);
 assert.equal(currentTransformationTask(messages),true);
 assert.equal(messages[0].content,text);
});

test('comma between count and direct detail adjective preserves the number',async()=>{
 const r=await buildInvestmentRequest({messages:[{role:'user',content:'세 문장으로, 조금 더 자세히 설명해줘.'}]});
 assert.equal(r.responseFormat.sentenceCount,3);
});
