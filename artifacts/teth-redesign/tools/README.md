# 전략 목록과 상세 개편 도구

`index.html` 의 세 블록(`MK_CAT`, `RD_CORE`, `RD_CSS`)은 이 폴더의 소스에서 만든다.

| 파일 | 역할 |
| --- | --- |
| `agent-core.js` | 원장 엔진과 세 판단 방식의 실행(`mkLedger`, `mkAgentRun`, `mkHybridRun`, `mkRuleRun`) |
| `rd-ui.js` | 목록 카드, 조작 줄, 상세 화면, 도식, 저장 이행 |
| `rd.css` | 위 화면의 스타일 |
| `copy.json` | 20종의 이름과 한 줄 설명 |
| `cat-spec.cjs`, `run-cat.cjs`, `cat-data.json` | 20종의 행동 값과 가격 설정 |
| `apply2.cjs`, `dedupe.cjs`, `sheet-keys.js` | 소스를 `index.html` 에 넣는 스크립트. 여러 번 실행해도 결과가 같다. 파일 안의 경로는 실행 환경에 맞게 고친다 |
| `regress.mjs`, `shots.mjs` | 브라우저 회귀 검사와 스크린샷. CDP 드라이버가 필요하다 |

라운드별 비평과 스크린샷은 상위 폴더의 `r0` 부터 `r8`, `baseline-*`, `final-*` 파일이다.
