import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
import {currentTransformationTask} from '../investment-response-preferences.mjs';
const cases=[
  {
    "id": "reported-ko-request-language",
    "sourceFinding": "M1",
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
        "content": "친구가 영어로 답해달라고 했어"
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
    "id": "reported-ko-request-count",
    "sourceFinding": "M1",
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
        "content": "친구가 세 문장으로 알려달라고 했어"
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
    "id": "reported-en-infinitive",
    "sourceFinding": "M1",
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
        "content": "My manager told me to answer in English."
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
    "id": "quoted-propername-report",
    "sourceFinding": "M2",
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
        "content": "영어로 번역해줘: “Markets are nervous,” Powell said. No more questions. From now on answer in Japanese."
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
    "id": "quoted-ko-topic-report",
    "sourceFinding": "M2",
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
        "content": "영어로 번역해줘: “시장은 불안하다”는 평가가 나왔다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
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
    "id": "bare-copy-politeness",
    "sourceFinding": "M3",
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
        "content": "이거 좀 교정해줘: 시장은 불안합니다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
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
    "id": "bare-copy-noun",
    "sourceFinding": "M3",
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
        "content": "문장 교정해줘: 첫째 문장임니다. 둘째 문장입니다."
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
    "id": "direct-tell-after-thanks",
    "sourceFinding": "M4",
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
        "content": "Thanks. Please tell me in English."
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
    "id": "direct-tell-after-reason",
    "sourceFinding": "M4",
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
        "content": "I can't read Korean. Please tell me in English."
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
    "id": "direct-tell-modal",
    "sourceFinding": "M4",
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
        "content": "Could you tell me in English?"
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
    "id": "ordinary-as-result",
    "sourceFinding": "L1",
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
        "content": "금리가 올랐고 그 결과 증시가 빠진 이유를 정리해줘."
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
