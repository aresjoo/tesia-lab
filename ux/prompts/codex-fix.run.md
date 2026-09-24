# CODEX 수정 라운드 — 역할: PRINCIPAL PRODUCT ENGINEER (병합 결과 검수 + 유효한 결함 수정)

작업 디렉터리: C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1 (브랜치 ux/product-model, 5개 표면이 병합된 상태)
이 앱은 목업입니다. 컴플라이언스·법률·리스크 고지·보안 감사 관점은 범위 밖입니다.

## 먼저 읽을 것
- ux/spec/UX_DECISION_LOG.md (전체, 특히 R1 갱신), ux/spec/UX_PAGE_SPEC.md, ux/spec/UX_STATE_MATRIX.md, ux/spec/UX_COPY_SYSTEM.md, ux/impl/AGENT_BRIEF.md (코드 규칙: 앵커, 접두, ES5, 검증 방법)
- ux/review/AGY_FINAL.md (UX 디렉터의 최종 비판) 와 **ux/review/CLAUDE_ADJUDICATION.md (제품 책임자의 판정: 이 표의 "수정한다" 항목은 반드시 구현, "기각한다" 항목은 구현 금지)**
- index.html의 "W1 토대" 블록(tfDerive, tfQaPreset), 그리고 각 표면 앵커 `/* ==JS:tx== */ ==JS:ac== ==JS:mk== ==JS:cx== ==JS:tm==` 아래 코드와 이들이 교체한 기존 함수(tfNFRoute, tfIntroView, tfTradeInactiveView, tfAcSheetView, tfPlanView, tfShareHub, tfSS3GridHtml, tfSS3Route, cpSetupView, tfBrokersView, tfBrokerView, tfTmAll, tfDashView, tfTmCtx, tfTmBrain, tfTmFeed)

## 임무
1. **회귀·상태 논리 검수**: 아래를 코드와 헤드리스 크롬(포트 9333, 정적 서버는 `node "C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/srv/serve.mjs" "<작업 디렉터리>" 8781` 로 띄움; CDP 드라이버 `C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs`, 예시 `verify-w1.mjs`/`final-crawl.mjs` 같은 폴더)으로 재현·판정한다.
   - 11 프리셋(tfQaPreset '01'~'11') 각각에서 #/trade, #/plan, tfBrokersView(), tfShareHub('find')가 tfDerive() 결과와 일치하는 CTA·청구 라인·연결 상태를 보이는가
   - 게스트 → 로그인(tfDevTgl('login')) → 같은 #/trade가 미활성 뷰로 바뀌는가, tfTradeInactiveLaunch() 뒤 터미널(active)로, 새로고침(?v= 강제 리로드) 후에도 유지되는가
   - 활성화: tfAcSheet('bitget') 폼 성공/부분 실패/재시도, tfAcSheet('card') 성공 후 derive.facts.plan, 완료 화면 1회 표시, TF_NF_RESUME/TF_UP_CTX 복귀
   - 따라하기: 시트 → 시작 → "따라가는 중" 인스턴스 → 중단 3택, #/share/t/<nick> 리다이렉트, 닉네임 식별자 불변(tfSSFind), cp 원장 정합(cpStart/cpClose 잔고)
   - 터미널: preview 격리(데모가 내 집계에 0), 긴급 정지 → 재개, 관망 접기, 데모 6개 미노출, tfNFRoute의 TF_PREVIEW 분기
   - 라우팅: 뒤로가기/새로고침/딥링크(#/share/s/세븐틴층, #/strategy/connect, #/plan/rebates) 모두 정상, TF_ONNF/TF_ONSHARE 플래그 누수 없음
   - 금지 어휘 스캔(#g-content 텍스트에서 UID, Fast API, PRO, 크레딧, 소진, 업그레이드, 위임, 체험 모드, 카피하기, 복제하기, 생각의 사슬, ·, —). 단 입력 라벨 "Bitget UID"와 D06 공식 라인의 "플랜"은 허용.
   - Runtime.exceptionThrown 0건, 390px 가로 스크롤 0.
2. **수정**: 발견한 P0/P1과 AGY_FINAL의 P0/P1 중 타당한 것을 index.html에서 직접 고친다. 규칙: 다른 표면의 구조를 갈아엎지 않는다(스펙·결정 로그 안에서 최소 수정), 앵커·접두 규칙 준수, ES5, 기존 라우트·함수명 유지. AGY 비판 중 결정 로그(D01~D31)에 반하는 요구는 기각하고 근거를 보고서에 적는다. P2(폴리시)는 손대지 않는다.
3. **보고서**: ux/review/CODEX_FIX_REPORT.md — 검수 표(항목/결과/재현), 수정 목록(함수·행·무엇을·왜), 기각한 AGY 항목과 이유, 남은 문제(수정 안 한 것과 이유), 검증 결과(문법·예외 0·뷰포트).
4. 마지막에 `git add -A && git commit -m "codex-fix: <요약>"` (메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`). 푸시 금지. 커밋 해시와 핵심 5줄을 출력.
