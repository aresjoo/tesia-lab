import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
import {currentTransformationTask} from '../investment-response-preferences.mjs';
// These source-only variants were withheld until the candidate was frozen; now public regression fixtures.
const cases=[
  {
    "id": "withheld-spaced-request-tail",
    "sourceFinding": "M1",
    "kind": "report",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어 한 문장으로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "친구가 영어로 답해 달라고 부탁했어"
      }
    ],
    "expectedCurrentFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedFollowingFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedCurrentTransformationTask": false
  },
  {
    "id": "withheld-asked-respond",
    "sourceFinding": "M1",
    "kind": "report",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어 한 문장으로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "My manager asked me to respond in Japanese."
      }
    ],
    "expectedCurrentFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedFollowingFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedCurrentTransformationTask": false
  },
  {
    "id": "withheld-inverted-chair",
    "sourceFinding": "M2",
    "kind": "translation",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어 한 문장으로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "영어로 번역해줘: “Markets are nervous,” said the chair. No more questions. From now on answer in Japanese."
      }
    ],
    "expectedCurrentFormat": {
      "language": "en"
    },
    "expectedFollowingFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedCurrentTransformationTask": true
  },
  {
    "id": "withheld-long-name",
    "sourceFinding": "M2",
    "kind": "translation",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어 한 문장으로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "영어로 번역해줘: “Markets are nervous,” Federal Reserve Chair Powell said. No more questions. From now on answer in Japanese."
      }
    ],
    "expectedCurrentFormat": {
      "language": "en"
    },
    "expectedFollowingFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedCurrentTransformationTask": true
  },
  {
    "id": "withheld-ko-news-tail",
    "sourceFinding": "M2",
    "kind": "translation",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어 한 문장으로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "영어로 번역해줘: “시장은 불안하다”는 소식이 나왔다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
      }
    ],
    "expectedCurrentFormat": {
      "language": "en"
    },
    "expectedFollowingFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedCurrentTransformationTask": true
  },
  {
    "id": "withheld-copy-typos",
    "sourceFinding": "M3",
    "kind": "copy",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어 한 문장으로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "오탈자 교정해줘: 시장은 불안합니다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
      }
    ],
    "expectedCurrentFormat": {
      "language": "ko"
    },
    "expectedFollowingFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedCurrentTransformationTask": true
  },
  {
    "id": "withheld-direct-okay-just",
    "sourceFinding": "M4",
    "kind": "direct",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "Okay, just tell me in English."
      }
    ],
    "expectedCurrentFormat": {
      "language": "en"
    },
    "expectedFollowingFormat": {
      "language": "en"
    },
    "expectedCurrentTransformationTask": false
  },
  {
    "id": "withheld-direct-say-this",
    "sourceFinding": "M4",
    "kind": "direct",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "Please say this in English."
      }
    ],
    "expectedCurrentFormat": {
      "language": "en"
    },
    "expectedFollowingFormat": {
      "language": "en"
    },
    "expectedCurrentTransformationTask": false
  },
  {
    "id": "withheld-report-language",
    "sourceFinding": "M5",
    "kind": "report",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어 한 문장으로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "The report is in English."
      }
    ],
    "expectedCurrentFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedFollowingFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedCurrentTransformationTask": false
  },
  {
    "id": "withheld-studied-language",
    "sourceFinding": "M5",
    "kind": "report",
    "messages": [
      {
        "role": "user",
        "content": "앞으로 한국어 한 문장으로 답해줘."
      },
      {
        "role": "assistant",
        "content": "요청한 형식을 유지하겠습니다."
      },
      {
        "role": "user",
        "content": "I studied bond prices in English."
      }
    ],
    "expectedCurrentFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedFollowingFormat": {
      "language": "ko",
      "sentenceCount": 1
    },
    "expectedCurrentTransformationTask": false
  }
];
for(const c of cases)test(c.id,async()=>{
 const raw=JSON.stringify(c.messages),now=await buildInvestmentRequest({messages:c.messages});
 assert.deepEqual(now.responseFormat,c.expectedCurrentFormat);
 assert.deepEqual((await buildInvestmentRequest({messages:[...c.messages,{role:'assistant',content:'응답 기록용 합성 문장입니다.'},{role:'user',content:'이제 분산투자를 설명해줘.'}]})).responseFormat,c.expectedFollowingFormat);
 if(c.expectedCurrentTransformationTask!==undefined)assert.equal(currentTransformationTask(c.messages),c.expectedCurrentTransformationTask);
 assert.equal(JSON.stringify(c.messages),raw);assert.deepEqual(now.messages.slice(-c.messages.length),c.messages);
 assert.equal(now.settingsPreview,null);
 for(const e of Object.values(now.responsePreferences.evidence)){
  assert.equal(c.messages[e.messageIndex].role,'user');assert.equal(c.messages[e.messageIndex].content.slice(e.start,e.end),e.text);
 }
});
