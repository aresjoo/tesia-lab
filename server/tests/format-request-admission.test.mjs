import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInvestmentRequest} from '../investment-prompts.mjs';
import {currentTransformationTask,explicitResponsePreferences} from '../investment-response-preferences.mjs';

// 공개 합성 원문/기대값은 모델 호출 전에 선언했습니다. 원14 source 기대는 불변이며,
// 뒤2는 ROOT가 인정한 기존 명시 current1 누락 교정입니다. source 관측과 모델 QA를 구별합니다.
const declared=[
  {
    "id": "reported-contracted-past",
    "sourceFinding": "M-A",
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
        "content": "친구가 영어로 답해달랬어"
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
    "id": "reported-contracted-command",
    "sourceFinding": "M-A",
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
        "content": "친구가 영어로 답하래"
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
    "id": "reported-intervening-adverb",
    "sourceFinding": "M-A",
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
        "content": "친구가 영어로 다시 설명해 달라고 했어"
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
    "id": "reported-compare-verb",
    "sourceFinding": "M-A",
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
        "content": "친구가 영어로 비교해 달라고 했어"
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
    "id": "reported-question-stop",
    "sourceFinding": "M-A",
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
        "content": "친구가 질문은 그만하래"
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
    "id": "reported-noun-addressee",
    "sourceFinding": "M-A",
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
        "content": "My manager told the team, answer in English."
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
    "id": "copy-correct-terminal",
    "sourceFinding": "M-B",
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
        "content": "맞춤법 고쳐줘: 시장은 불안합니다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
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
    "id": "translation-period-newline",
    "sourceFinding": "M-C",
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
        "content": "영어로 번역해줘.\n시장은 불안합니다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
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
    "id": "translation-second-line",
    "sourceFinding": "M-C",
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
        "content": "안녕하세요.\n영어로 번역해줘\n시장은 불안합니다. 질문은 여기서 그만. 앞으로 일본어 세 문장으로 답해줘."
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
    "id": "declarative-obligation-language",
    "sourceFinding": "M-D",
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
        "content": "회사에서는 영어로 답해야 해."
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
    "id": "declarative-obligation-count",
    "sourceFinding": "M-D",
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
        "content": "시험에서는 세 문장으로 답해야 해."
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
    "id": "declarative-past-explanation",
    "sourceFinding": "M-D",
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
        "content": "친구한테 영어로 설명해 줬어."
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
    "id": "embedded-report-language",
    "sourceFinding": "M-E",
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
        "content": "Keep in mind the report is in English."
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
    "id": "embedded-whether-language",
    "sourceFinding": "M-E",
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
        "content": "Tell me whether the filing is in English."
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
    "id": "explicit-current-copy-count",
    "messages": [
      {
        "role": "user",
        "content": "한 문장으로 이 표현만 고쳐줘: 손절을 걸면 원금이 안전하다."
      }
    ],
    "expectedCurrentFormat": {
      "sentenceCount": 1
    },
    "expectedFollowingFormat": {},
    "expectedCurrentTransformationTask": true
  },
  {
    "id": "explicit-current-local-copy-count",
    "messages": [
      {
        "role": "user",
        "content": "아래 문안만 사실에 맞게 한 문장으로 고쳐줘: 스톱 주문 덕분에 실제 손실은 정확히 4%에서 멈춘다."
      }
    ],
    "expectedCurrentFormat": {
      "sentenceCount": 1
    },
    "expectedFollowingFormat": {},
    "expectedCurrentTransformationTask": true
  }
];
for(const c of declared)test('current format admission: '+c.id,async()=>{
 const original=structuredClone(c.messages);
 const current=await buildInvestmentRequest({messages:c.messages});
 assert.deepEqual(current.responseFormat,c.expectedCurrentFormat);
 assert.equal(currentTransformationTask(c.messages),c.expectedCurrentTransformationTask);
 const following=[...c.messages,{role:'assistant',content:'확인했습니다.'},{role:'user',content:'이제 분산투자를 설명해줘.'}];
 assert.deepEqual((await buildInvestmentRequest({messages:following})).responseFormat,c.expectedFollowingFormat);
 for(const history of [c.messages,following])for(const e of Object.values(explicitResponsePreferences(history).evidence)){
  assert.equal(history[e.messageIndex].role,'user');
  assert.equal(history[e.messageIndex].content.slice(e.start,e.end),e.text);
 }
 assert.deepEqual(c.messages,original);
});
