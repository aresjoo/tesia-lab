import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
import {currentTransformationTask,explicitResponsePreferences} from '../investment-response-preferences.mjs';
const declared=[
  {
    "id": "bare-copyedit-unquoted",
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
        "content": "교정해줘: 첫째 문장임니다. 둘째 문장입니다."
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
    "id": "modified-copyedit-unquoted",
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
        "content": "의미를 유지해서 교정해줘: 첫째 문장입니다. 둘째 문장입니다."
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
    "id": "bare-summary-unquoted-target",
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
        "content": "요약해줘: 시장은 불안합니다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
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
    "id": "bare-copyedit-quoted-newline",
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
        "content": "교정해줘\n“첫째 문장임니다. 둘째 문장입니다.”"
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
    "id": "ordinary-content-topic",
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
        "content": "어제 FOMC 회의 내용을 정리해줘."
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
    "id": "ordinary-global-substring",
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
        "content": "금리 인상이 글로벌 증시에 미치는 영향을 요약해줘."
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
    "id": "ordinary-asset-transfer",
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
        "content": "BTC 비중 절반을 ETH로 옮겨줘."
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
    "id": "ordinary-this-week",
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
        "content": "Please summarize this week's BTC move."
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
    "id": "ordinary-result-newline-stop",
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
        "content": "백테스트 결과를 요약해줘\n질문은 여기서 그만"
      }
    ],
    "expectedCurrentFormat": {
      "language": "ko",
      "sentenceCount": 1,
      "questionsStopped": true
    },
    "expectedFollowingFormat": {
      "language": "ko",
      "sentenceCount": 1,
      "questionsStopped": true
    },
    "expectedCurrentTransformationTask": false
  },
  {
    "id": "reported-tell-language",
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
        "content": "친구가 영어로 알려줘라고 했어"
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
    "id": "reported-tell-count",
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
        "content": "친구가 세 문장으로 알려줘라고 했어"
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
    "id": "reported-speak-language",
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
        "content": "친구가 영어로 말해줘라고 했어"
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
    "id": "direct-english-tell",
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
        "content": "Please tell me in English."
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
    "id": "quoted-article-go-connective",
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
        "content": "영어로 번역해줘: “시장은 불안하다”고 그는 말했다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
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
    "id": "quoted-english-comma-inside",
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
        "content": "영어로 번역해줘: “Markets are nervous,” he said. No more questions. From now on answer in Japanese."
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
  }
];
for(const c of declared)test(c.id,async()=>{
 const original=JSON.stringify(c.messages);
 assert.deepEqual((await buildInvestmentRequest({messages:c.messages})).responseFormat,c.expectedCurrentFormat);
 assert.equal(currentTransformationTask(c.messages),c.expectedCurrentTransformationTask);
 assert.deepEqual((await buildInvestmentRequest({messages:[...c.messages,{role:'user',content:'이제 분산투자를 설명해줘.'}]})).responseFormat,c.expectedFollowingFormat);
 for(const e of Object.values(explicitResponsePreferences(c.messages).evidence)){
  assert.equal(c.messages[e.messageIndex].role,'user');assert.equal(c.messages[e.messageIndex].content.slice(e.start,e.end),e.text);
 }
 assert.equal(JSON.stringify(c.messages),original);
});
for(const [speech,language] of [['They tell me in English.','ko'],['Please tell me in English.','en']])test('reported/direct symmetry '+speech,async()=>{
 const messages=[{role:'user',content:'앞으로 한국어로 답해줘.'},{role:'user',content:speech}];
 assert.deepEqual((await buildInvestmentRequest({messages})).responseFormat,{language});
 assert.deepEqual((await buildInvestmentRequest({messages:[...messages,{role:'user',content:'집중투자를 설명해줘.'}]})).responseFormat,{language});
});
