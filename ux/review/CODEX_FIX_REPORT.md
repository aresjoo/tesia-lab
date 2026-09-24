# CODEX 병합 검수 및 수정 보고서

기준: `ux/product-model`, 시작 HEAD `b1f7992`. 판정 우선순위는 `CLAUDE_ADJUDICATION.md` → `UX_DECISION_LOG.md` R1 → 화면 스펙이다. 제품 목업의 상태·흐름·표현만 검수했다.

## 검수 결과

Chrome 153/CDP 9333, 지정 정적 서버 8781에서 재현했다. 최종 실행 `rtk proxy node ux/review/CODEX_VERIFY.mjs all`은 exit 0. 1440×900과 390×844에서 88개 상태 화면과 43개 여정 검사를 통과했다. 추가 상세/터미널/시트 10개 화면도 확인했다.

| 항목 | 결과 | 재현 및 증거 |
|---|---|---|
| 11 프리셋 × trade/plan/brokers/market | 88/88 통과 | `tfQaPreset('01'~'11')` 후 각 진입. stateId, 상태 문장, CTA, 활성화 카드 조건, 청구식, 연결 배지, 기본 검증 기간을 실제 DOM과 비교. `../shots/codex-fix/matrix.json` |
| 게스트 → 로그인 → 같은 trade | 통과 | 01, `tfNav('#/trade')`, `tfDevTgl('login')`: tfintro → tfinactive |
| 모의 실행 및 강제 새로고침 | 통과 | `tfTradeInactiveLaunch()` 후 tfdash, owned=1, env=paper. 새 `?v=`로 열어도 유지 |
| Bitget 부분 실패/재시도 | 통과 | mock UID `38291042`, API `BAD123456789`는 API만 실패. API 교체 후 완료. UID `00000000` 실패도 반대 방향으로 검증. 성공한 행 유지 |
| 완료 화면 1회와 저장 | 수정 후 통과 | 완료 DOM 1개 → 계속 → 0개. 즉시 reload 후 API 유지. 이미 연결한 계정의 연결 확인은 완료 화면을 재생하지 않음 |
| 카드 활성화 | 통과 | mock `4242 4242 4242 4242`, `12/30`, `123`으로 폼 → 확인 → 성공. `derive.facts.plan`, cardOn, payDone=true |
| 완료 후 복귀 | 통과 | `TF_NF_RESUME`의 같은 봇 ID가 live로 복귀. 따라가기 활성화는 `TF_UP_CTX.ctx='cp-follow'`로 닉네임과 입력 예산 123 USDT 복원 |
| 따라가기 딥링크 | 수정 후 통과 | `#/share/copy/세븐틴층`: 상세 위 시트 표시. 부팅 복원 및 hashchange 종료 이후에 열도록 순서 수정 |
| 따라가기 시작과 원장 | 통과 | 1,000 USDT 중 100 배정 → 잔고 900, add 원장 1개. 종료 시 `기존 잔고 + cpCalc.est`, out 1개. 중복 종료로 잔고가 늘지 않음 |
| 중단 3택 | UI/즉시 정산 경로 통과, 엔진 한계 있음 | 지금 정리 / 원본 청산 대기 / 직접 관리 표시. 기존 엔진의 후속 처리 차이는 아래 한계에 별도 기록 |
| 닉네임 및 프로필 리다이렉트 | 통과 | `tfSSFind('세븐틴층')` 식별자 불변. `#/share/t/세븐틴층` → `#/share/s/세븐틴층/all` 개요 |
| 따라가기만 소유한 trade | 수정 후 통과 | derive active/owned=1인데 미활성 뷰가 나오던 결함 제거. cpCalc 기반 USDT 관리 행 표시. 원화 규칙 계정과 수치 합산하지 않음 |
| preview 격리 | 수정 후 통과 | guest + preview + `tfNFRoute('#/trade')`에서도 tfdash. 데모 6개, 내 owned=0. 닫으면 일반 화면에는 데모 0개 |
| 긴급 정지/재개 | 통과 | 첫 클릭은 확인만 표시, 확정 후 off. API 없는 paper도 다시 live로 재개. 규칙+따라가기 혼합 계정은 규칙 off, 따라가기 closed/정산 1회 |
| 관망 접기 | 통과 | 실제 규칙 피드의 158회 연속 관망을 1칩으로 표시, 펼치면 `aria-expanded=true` |
| QA 에이전트 fixture | 판정 유지, 라벨 수정 | 일반 규칙 피드 0개, logs 오버레이에서만 2개. `QA 예시, 시뮬레이션` 명시 |
| 뒤로가기/딥링크/새로고침 | 통과 | 검증 초안의 `#/strategy/connect` reload, `#/plan/rebates` → history.back → trade, `/all/perf` 및 `/1y/perf` 실제 성과 탭 확인 |
| 라우트 플래그 | 수정 후 통과 | trade: NF=true/SHARE=false, 마켓: 둘 다 false. 허브가 해시를 먼저 지우며 NF가 잔류하던 경로 수정 |
| 금지어 | 검사 화면 0건 | `#g-content.innerText`에서 지정된 UID/Fast API/PRO/크레딧/소진/업그레이드/위임/체험 모드/카피하기/복제하기/생각의 사슬/가운뎃점/em dash 검사. Bitget UID 입력 라벨 허용. D06 청구식의 플랜 유지 |
| 문법·예외·뷰포트 | 통과 | inline script 2개 `vm.Script` 파싱. Runtime.exceptionThrown 0건. document 및 g-scroll 가로 넘침 0px. `git diff --check` 통과 |

### 프리셋별 청구 및 1차 액션

두 뷰포트에서 같은 결과다. 연결 화면의 연결 완료 CTA는 소유 전략 0개일 때 `첫 전략 실행하기`이며 거래 화면으로 연결한다. 마켓은 모든 프리셋에서 전체 기간 백테스트를 제공하고 로그인/실행 연결 자격은 따라가기 시트에서 검사한다.

| # | 파생 key | trade 1차 액션 | 청구 결과 | 연결/카드 |
|---|---|---|---|---|
| 01 | guest | 무료로 시작 | 비노출, plan 접근은 로그인 | 없음/없음 |
| 02 | signed | 대표 전략 모의로 켜보기 | 0원, 무료 7회 | 없음/없음 |
| 03 | linked-zero | 대표 전략 모의로 켜보기 | 0원 | 완료/없음 |
| 04 | linked-low | 대표 전략 모의로 켜보기 | 25,000 - 15,000 - 1,000 = 9,000원 | 완료/없음 |
| 05 | linked-high | 대표 전략 모의로 켜보기 | 0원, 거래 상쇄 | 완료/없음 |
| 06 | plan-high-unlinked | 거래소 연결 | 49,000 + 15,000 = 64,000원 | 없음/등록 |
| 07 | plan-low-unlinked | 대표 전략 모의로 켜보기 | 49,000원 | 없음/등록 |
| 08 | plan-high-high | 대표 전략 모의로 켜보기 | 49,000 + 15,000 - 50,000 = 14,000원 | 완료/등록 |
| 09 | plan-high-low | 대표 전략 모의로 켜보기 | 49,000 + 15,000 - 15,000 = 49,000원 | 완료/등록 |
| 10 | plan-low-high | 대표 전략 모의로 켜보기 | 49,000 - 49,000 = 0원 | 완료/등록 |
| 11 | plan-low-low | 대표 전략 모의로 켜보기 | 49,000 - 15,000 = 34,000원 | 완료/등록 |

## 수정 목록

행은 이번 수정 후 `index.html` 기준이다. 기존 전역 이름과 라우트를 유지했고 새 JS는 해당 표면 앵커에 ES5 스타일로 추가했다.

| 함수·행 | 무엇을 / 왜 |
|---|---|
| `tfTradeInactiveView` 15251 | #02 API·카드 모두 없을 때만 활성화 카드, 아니면 상태 한 줄. #03 활성화 CTA 우선 및 런처 보조 처리. #11 폼 직행 옵션. #16 회원 preview 링크 제거 |
| `tfBrokersView` 14691, `tfCxCta` 15900 | #04 연결된 계정의 온보딩 불릿을 실제 연결 상태로 교체하고 소유 전략 수에 따라 CTA 변경 |
| `tfTmPx` 15939, `tfTmStatusBlock`, `tfLogCardRule`, `tfTmSayQ` 16082 | #05 시세·주문·손절·익절을 USDT로 통일. 원화 예산/P&L 유지. 질문 응답의 전봉 RSI가 현재 봉을 읽던 불일치도 수정 |
| `cpSetupRoute` 11584 | #06 부팅 복원 대기, 상세 렌더 후 다음 태스크에서 따라가기 시트 열기. 이전 hashchange 정리와 충돌 방지 |
| `mkCard` 15620, `mkPd` 15596 | #10 결측 팔로워 손익 컬럼 숨김, 실수치만 조건부 표시. 불일치 #6 기본 전체 기간으로 랜딩과 검증 범위 일치 |
| mk CSS 4222, `tfShareHub` 11021, `tfMkSearchToggle` 15590 | #13 모바일 탭 1행, 필터 가로 스크롤 1행, 검색 접기. 기존 필터 기능 유지 |
| tm CSS 4453, `tfTmCtx` 10244 | #17 모바일 운용/P&L 요약 추가, 긴급 정지 우측 14px. 기존 relative 강제 규칙과 헤더 겹침도 실제 픽셀로 보정 |
| `tfBrokerView` 14763 | 판정표가 명시 수용한 #20에 한해 지원 기능의 카피 트레이딩 → 따라가기. 다른 P2 폴리시는 미수정 |
| `tfTmFeed` 10340 | #07 삭제 요구는 기각하고 판정이 허용한 QA 라벨만 수정 |
| `tfNFRoute` 14437, `tfShareHub` 11021, `tfDashView` | preview 분기를 guest보다 먼저 적용. 마켓 및 터미널 전환 시 NF/SHARE/STRAT 플래그 정리 |
| `tfBotCtl` 13146 | 연결 없이 시작한 paper 전략이 긴급 정지 후에도 연결 없이 재개되도록 수정 |
| `tfAcSheetView` 15347, `tfAcFinish` 15521, `tfPayConfirm` 9893 | 폼 직행 옵션, 완료 시 `tfSaveNow()`로 즉시 저장. 저장 디바운스 전에 새로고침하면 연결이 사라지는 재현 해결 |
| `tfAcGo`, `tfAcDoneHtml` 15530 | 이미 연결된 계정의 완료 화면 반복 제거. D27 상쇄 문구를 covered/partial에만 표시 |
| `tfAcCardDone` 15554, `tfAcAfter` 15565, `tfMkActivate` 15589 | 카드 완료의 봇 복귀 처리 및 따라가기 연결 게이트의 닉네임/예산 복원. 기존 설정 가져오기 follow 컨텍스트와 구분 |
| `cpStart` 11635 | 실행 연결 자격과 폼 존재를 시작 경계에서 재검사. 연결 없는 시작과 시트가 사라진 뒤 null 입력 접근 방지 |
| `tfTmFollowHtml` 15929, `tfTmFollowView`, `tfDashView` | active인데 미활성 화면으로 밀려나던 따라가기 전용 계정 표시. 기존 cp 원장 수치와 USDT를 재사용하는 최소 관리 행 |
| `tfTmHalt` 16121, `tfTmHaltGo`, `cpClose` 11332 | 혼합 계정 긴급 정지에서 따라가기까지 포함. silent 옵션으로 기존 정산 원장 경로를 재사용하며 여러 번 화면 이동하지 않음 |

## 수정 없이 통과한 수용 항목과 기각

- #01: `f7b78d4`의 무료 혜택 항을 확인했다. 프리셋 04의 수식 양변이 일치한다. 과금 상수는 변경하지 않았다. 스펙의 옛 10원 상쇄 단위를 현재 코드의 25원 및 비플랜 무료 혜택 규칙으로 바로잡았다.
- #08: 제품 책임자의 판정은 **첫 미완료 단계**다. 기존 `curI`가 이미 이를 구현한다. 연결만 완료한 03에서 2단계가 현재인 것은 이 판정에 부합한다. AGY 원문의 “마지막 완료 이후 단계” 요구로 변경하지 않았다.
- #14: 시작 HEAD에 이미 Bitget의 차트 심볼 매핑이 있다(`19207e9`). 소유 전략 VM과 위젯에 `BITGET:BTCUSDT`가 전달됨을 재확인했다.
- #15: 3.1초 후 토스트 `.show=false`. 영구 잔류가 아니므로 수명/공용 DOM을 수정하지 않았다.
- #07 삭제: 일반 사용자 경로에는 AI fixture가 없다. QA 오버레이의 명시적 예시를 삭제하지 않는다(D26 및 판정표).
- #09: 가운뎃점은 발주자 카피 규칙 위반. 쉼표와 기존 차별화 제목(`54a5f10`)을 유지한다.
- #12: AI 수익률 +18.4% 삽입은 엔진에 없는 성과 발명이다(D26, 카피 규칙 2). 미구현 수치 추가 금지.
- #18: 정상 `/1y/perf` 경로에서 성과 탭, 4타일과 차트가 활성화된다. 기존 크롤 호출 오류이므로 제품 코드는 유지한다.
- #19: preview 데모 이름 및 개발 QA 버튼 폴리시는 P2이며 명시 기각이다. 수정하지 않았다.
- AGY의 추가 삭제 제안 중 게스트 통제 섹션의 비활성 긴급 정지 버튼은 S2 명시 요소라 유지한다. 검증 기간 선택은 제거하지 않고 모바일 컨트롤 행에 보존한다.

## 남은 한계와 미검증

1. **따라가기 중단 3택의 후속 엔진은 기존 목업 한계**다. `mkStopGo`는 선택한 stopMode를 기록하고 모두 `cpClose`로 즉시 정산한다. 원본 청산을 기다리는 이벤트 스트림이나 포지션 소유권 이전 엔진은 구현돼 있지 않다. 3택 UI와 원장 정합만 검증했고 세 가지 실거래 동작이 구현됐다고 판정하지 않는다. 이번 표면 최소 수정에서 새 실행 엔진/상태 체계는 추가하지 않았다.
2. 따라가기 계정은 별도 USDT 관리 행으로 표시하며, 기존 규칙 VM의 원화 합계에는 섞지 않는다. 긴급 정지한 따라가기는 정산 종료되므로 다시 따라가기 시트로 시작한다. 규칙/paper 전략은 기존 재개 버튼으로 재개한다.
3. 차트는 외부 TradingView, 판단 피드는 결정론적 과거 시뮬레이션이다. 거래소/단위는 맞췄지만 현재 차트 가격과 과거 판단 봉의 가격이 같다는 보장은 하지 않는다. 실제 거래소 API·실결제·서버 모델은 검증 범위 밖이다.
4. AGY 스킬의 네 관점 리뷰는 4개 모두 실행 시도 및 재시도했다. PowerShell 실행 정책 오류 후 래퍼 실행은 진행됐으나 CLI의 `You are not logged into Antigravity`, 홈 로그 쓰기 거부와 외부 네트워크 제한으로 0/4 완료했다. 외부 독립 리뷰 완료로 보고하지 않는다.
5. 이번 병합 표면은 기존처럼 한국어 직접 문구를 사용한다. 7개 언어 전체 회귀와 관련 없는 정책/소개/다운로드 사용자 흐름은 이번 결과에 포함하지 않는다. 요청대로 법률·컴플라이언스·보안 감사 및 P2 폴리시는 수행하지 않았다.

## 재현 방법과 산출물

지정 서버 실행:

```powershell
rtk proxy node "C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/srv/serve.mjs" "C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1" 8781
rtk proxy node ux/review/CODEX_VERIFY.mjs all
rtk proxy git diff --check
```

`matrix`, `journeys`, `extra` 인자로 분리 실행할 수 있다. `CDP_DRIVER`로 제공된 `cdp.mjs` 경로를 지정할 수 있고 `CODEX_QA_OUT`으로 결과 디렉터리를 바꿀 수 있다. Chrome 9333이 필요하다. 검증은 8781의 localStorage를 QA 상태로 교체하므로 같은 원점에서 동시에 다른 검증을 돌리지 않는다.

- `../shots/codex-fix/matrix.json`: 88개 실제 DOM/derive/CTA/금지어/가로 넘침 비교 기록.
- `../shots/codex-fix/journeys.json`: 핵심 여정 30개 assertion 및 예외 목록.
- `../shots/codex-fix/extra.json`: 복귀/딥링크/혼합 계정 13개 assertion와 추가 화면 10개.
- `../shots/codex-fix/*.png`: 스크린샷 99장. 모바일 마켓, 터미널 헤더/요약, 따라가기 시트, 데스크톱 06 CTA 및 03 연결 완료 카드는 직접 픽셀 확인했다. 모든 캡처의 레이아웃을 사람 수준으로 전수 시각 판정했다고 주장하지 않는다.

작업 전부터 존재한 `ux/logs/codex-fix.log`, `ux/prompts/codex-fix.run.md`는 보존했다. 임시 드라이버와 우체통은 `.mailbox/`에 있어 커밋 대상에서 제외된다. 푸시하지 않는다.
