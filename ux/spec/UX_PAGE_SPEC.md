# UX_PAGE_SPEC — 화면별 구현 스펙 (구현 에이전트 참조 정본)

공통 규칙
- 파일: index.html 단일. 라우트 문자열·기존 함수명은 유지하고 함수 본문을 교체한다. 새 함수는 `tfX*` 접두(파생 엔진 `tfDerive`, QA `tfQa*`, 이름 `tfStratTitle`).
- CSS: 새 규칙은 각 표면 전용 접두 클래스(`.tx-` 게스트/미활성, `.tm-` 터미널, `.mk-` 마켓, `.cx-` 거래소 연결, `.ac-` 활성화, `.us-` 이용 현황, `.qa-` QA)로만 추가하고, `</style>`(L4351) 바로 앞에 표면별 주석 블록으로 삽입한다. 기존 규칙 삭제는 해당 표면 클래스에 한정.
- 다크 토큰 사용(`var(--gt)`, `--gt2`, `--gt3`, `--gg`, `--surface`, `--border`). 라임 `#c8f43c`는 1차 CTA에만. 카드 남발·배지 남발·그라데이션 금지. 화면당 1차 CTA 1개.
- 모든 상태 읽기는 `tfDerive()` 결과에서. 저장은 기존 `tfSave()`.
- 데모 고지는 화면당 1곳 "시뮬레이션 데이터예요".
- 모바일 390px에서 가로 스크롤 0, 헤더 버튼 텍스트 소실 버그 수정(우상단 로그인/무료로 시작 pill이 빈 회색 블록으로 렌더되는 문제 조사·수정).

## S1 파생 상태 엔진 + QA 실험실
- `tfDerive()` 구현: UX_STATE_MATRIX.md 계약 그대로. `TFC.derive={USAGE_HIGH:1500,TRADE_HIGH:1500,PLAN_KRW:49000,INCLUDED:1000,UNIT_KRW:10,KRW_PER_CREDIT:10,WELCOME_KRW:1000}`를 index.html 상단 스크립트(TFC 로드 후)에서 `TFC.derive=TFC.derive||{...}`로 주입.
- QA 패널(tfDevPanelTgl 교체, 15908~): 섹션 ①시나리오 11버튼(tfQaPreset) ②오버레이 토글 6개 ③기대값 카드(현재 stateId·key·1차 CTA·청구 라인·자격·거래소·터미널 모드·확인 화면) + [PASS][FAIL] ④진척판 10행(클릭 순환) ⑤"고급" 접힘에 기존 토글. 폭 320px, 내부 스크롤.
- tfQaPreset: QA_SCENARIOS.md 표대로. 거래 충전은 `bcAppend('charge','volume',amt,'qa','qa-vol-'+id)`, AI 사용은 `bcAppend('debit','ai',-amt,'qa','qa-ai-'+id)`, 카드는 `bcCardOn(true)`+`t.payDone=true; t.plan='paid'`, UID는 `t.uidLinked=true; t.uid='38291042'`, API는 `t.api={ex:'bitget',last4:'QA01'}; t.conn=true; t.ob={st:'completed',ex:'bitget'}`. 완료 후 `tfDevRefresh()` 확장: tfintro/tfdash/nfplan/tfbrokers/tfss3 모두 재렌더.
- 노출: QA 버튼 생성 IIFE에 hostname/dev 플래그 조건.
- TF_DEV_ROWS의 'api' 라벨을 "거래소 연결 (Bitget)"로, 기본 ex를 bitget으로.

## S2 AI 트레이딩 3뷰
### 라우팅 (tfNFRoute L15040~)
```
#/trade: !user → tfTradeGuestView(); preview 플래그(TF_PREVIEW) → tfDashView(preview)
         user && ownedStrategies==0 → tfTradeInactiveView(); else tfDashView()
```
`tfIntroNeed`/`TF_INTRO_PEEK` 우회 제거. "터미널 미리 보기"는 `tfPreviewOpen()`이 `TF_PREVIEW=true`로 tfDashView(데모 6개만, 상단 바 "데모 체험 · [내 화면으로]") — 데스크톱만, 모바일은 미노출.

### tfTradeGuestView (tfIntroView 본문 교체, 함수명 유지 가능: tfIntroView 내부를 새 구조로)
섹션 순서·DOM:
1. `.tx-hero`: h1 "밤새 차트 보지 마세요.<br>TETH가 전략을 만들고, 검증하고, 24시간 대신 거래합니다" / p "매 판단의 이유까지 보여줘요" / CTA `무료로 시작`(authOpen('signup')) / 보조 "카드 등록 없이 시작해요". 우측(데스크톱) 또는 아래(모바일)에 `.tx-live` 라이브 카드: "TETH가 보고 있어요" · BTC/USDT · 포지션 없음 · 기다리는 것: 4시간봉 모멘텀 확인 · 다음 확인: 다음 봉 마감 · 마지막 확인: N초 전(1초 틱, 기존 tin-live 순환 로직 재사용 가능). 3D 타일 배경·비디오 제거.
2. `.tx-types`: "이런 전략을 돌려요" 3장 = [AI 판단] BTC 시장 맥락 판단 / "15분마다 진입·추가·축소·청산·대기를 결정해요" / 30일 +x% · MDD -y% ; [규칙] BTC 눌림목 추세 추종 / 부제 / 수치(tfRankSeeds 1위) ; [따라가기] ETH 추세 확인 후 진입 / "다른 사용자의 전략을 내 예산으로" / 팔로워 N. 카드 클릭 → 게스트는 authOpen('signup'), 따라가기 카드는 tfShareHub('find').
3. `.tx-logs`: "판단마다 이유가 남아요" + 에이전트 카드 1장 + 규칙 카드 1장(§S5 형식, 정적 fixture).
4. `.tx-steps`: 01 말하기 / 02 검증 / 03 연결·실행 (기존 3스텝 스타일 재사용, 문구 교체).
5. `.tx-control`: 한 줄 리스트 4개(예산 안에서만 / 승인한 뒤에만 / 출금 권한 없음 / 한 번에 멈춤) + `긴급 정지` 버튼 시각(비활성, 라벨 "터미널에서 언제든").
6. `.tx-cta`: CTA 반복 + 미니 푸터(전략 따라하기 / 인사이트 / 새 전략 만들기; 데스크톱만 "터미널 미리 보기").

### tfTradeInactiveView (신설)
1. `.tx-onb` 온보딩 4단계 바: 가입 ✓ / 모의로 보기 / 거래소 연결 / 첫 실행 (완료 판정: 모의=ownedStrategies 또는 paper 이력, 연결=derive.activation.api, 첫 실행=strat에 live 존재).
2. `.tx-head`: derive.statusLine 위에 "도현님, 아직 돌아가는 전략이 없어요" (초안 있으면 "검증을 마친 전략이 있어요").
3. 초안 없음 → `.tx-launch` 3행: [1차] 대표 전략 모의로 켜보기(`tfXLaunchDemo()`: tfRankSeeds 1위 파라미터로 t.cur/score 생성 → tfStartStrategy를 paper env로 호출 → 터미널) / 직접 만들기(gHome) / 공개 전략 골라보기(tfShareHub('find')). 초안 있음 → 초안 카드(tfStratTitle, 부제, +ret/MDD/승률) + [이 전략 실행하기](tfNav('#/strategy/connect')) + 활성화 진행 3행(요금 연동 / 실행 연결 / 예산).
4. 무료 체험 바(freeLeft/quota) — 수치는 "N회 남음" 표시(기존 비노출 규칙은 브리프가 덮음: 게이트 위치를 미리 보여주기 위함).
5. `.ac-card` 활성화 카드 1장(§S3 시트와 동일 컴포넌트, inline 변형).
6. 도움 행.

## S3 활성화 시트 + 연결 완료 + 이용 현황
### 시트 `tfAcSheet(ctx)` (tfPlanHtml 대체; tfCnStep 1단계 → 시트; tfUpSheet의 quota/plan/follow 진입도 이 시트로 통일)
```
TETH 활성화
추천  Bitget 연결                          약 1분 · 자산 이동 없음
      ✓ 거래하면 TETH 이용료가 상쇄돼요
      ✓ 출금 권한은 요구하지 않아요
      ✓ Claude, GPT, Gemini 등 멀티 AI 이용료를 TETH가 부담해요
      [Bitget 연결하기]      계정이 없어요 → 만들기(약 2분)
대안  카드로 이용하기 ₩49,000/월  (연결 없이 쓰고 싶다면)   [카드 등록]
막히면 24시간 상담원이 바로 도와드려요  [도움받기]
```
[Bitget 연결하기] → 기존 tfPlanPick('partner') 경로의 UID/API 입력을 **한 폼**(`tfApiHtml` 확장: Bitget UID + API Key + Secret, 안내 3줄)으로, 진행은 두 체크 행(요금 연동 ✓ / 실행 연결 ✓). 부분 실패는 실패 행만 재시도. 성공 → `tfAcDone()` 완료 화면(1회): 문구는 COPY_SYSTEM "연결 완료" + [전략 실행 이어가기](TF_NF_RESUME 또는 #/strategy/done).
[카드 등록] → 기존 tfPayHtml(월/연 선택 제거, 월 ₩49,000 고정, 데모 카드 폼) → 완료 시 `bcCardOn(true); t.payDone=true; t.plan='paid'`.
스텝퍼 4단계 라벨: 활성화 → 연결 → 확인 → 시작(1단계는 시트).

### 이용 현황 `tfPlanView('plan')` 교체 (탭 정산·알림은 유지, 제목 "이용 현황")
```
[상태 문장 derive.statusLine]
[상쇄 바 offsetPct] 플랜 ₩49,000 - 상쇄 ₩31,000 = 청구 ₩18,000   (비플랜: "이번 달 청구 ₩0 · 무료 체험 N회 남음")
줄이는 방법: derive.reduceHint (예: "거래소를 연결하면 거래 혜택으로 상쇄돼요") + CTA(derive.primary가 활성화류일 때만)
연결 상태  거래소 연결  Bitget 연결됨 / 미연결 [연결하기]
          카드       등록됨 / 없음 [등록]
```
금지 어휘 전부 제거. 관망(watch)은 상태 문장 "AI 기능이 잠시 멈춰 있어요. 카드 등록이나 거래소 연결 즉시 다시 켜져요"로.

## S4 전략 이름 `tfStratTitle(p, assetLabel, opt)`
```
asset: 비트코인→BTC, 이더리움→ETH, 솔라나→SOL, 나스닥→NASDAQ, 그 외 라벨 그대로
behavior: p.trendFilter ? '눌림목 추세 추종' : (p.rsiTh<=40 ? '급락 후 반등 포착' : '눌림목 스윙')
suffix: p.sl>=-3 ? ' · 보수형' : (p.tp>=15 ? ' · 공격형' : '')  (opt.long이면 ' · 장기')
title = asset+' '+behavior+suffix ;  subtitle = tfStratSub(p): "RSI "+p.rsiTh+" 아래로 눌렸다가 반등할 때 사고, +"+p.tp+"%면 팔고 "+p.sl+"%면 멈춰요" (+ trendFilter ? " 추세가 뚜렷할 때만." : "")
```
적용: tfRankSeeds 카드(제목=tfStratTitle, 작성자=nick 별도 행), 인트로 3장, 터미널 레일·헤더(user 전략), 상세(ss3d) 제목, 카피 프로필. 닉네임은 "작성자 세븐틴층"으로만.

## S5 판단 로그 렌더러
- `tfLogCardAgent(ev)`: `.tm-card.agent` = 헤더(시각 · 결정 동사 배지) / "확인한 것" 칩 행(BTC $64,120 · 1H 하락 · 4H 횡보 · 거래량 20봉 평균 -8% · 포지션 없음) / 이유 2~4줄 / 행동(주문 없음 | 시장가 매수 0.02 BTC) / 다음 확인.
- `tfLogCardRule(ev)`: `.tm-card.rule` = 헤더(시각 · 규칙 검사) / 규칙 행(RSI(14) ≤ 44 → 38 ✓ / 추세 필터 → ✗) / 결과 / 주문 / 리스크 규칙.
- 기존 tfTmFeed의 event.k 매핑: watch/scan → rule(미충족), entry → rule(충족+주문), risk → rule(리스크 규칙), exit → rule(청산). agent 카드는 kind==='agent' 전략(대표 전략 fixture)에만 결정론적 생성.
- 연속 미충족/관망 2회 이상 → 1칩 "관망 유지 · N회 · M분 [펼치기]".
- 삭제: `사용자 프롬프트`/`생각의 사슬`/`거래 결정` 접기, tfTmTicket의 서사 문장("총알을 아끼고…").

## S6 터미널 (tfDashView / tfTmBrain / tfTmAll)
- `tfTmAll()`: preview가 아니면 데모 6개 제외(user + clone + follow만). preview면 데모만.
- 상단 컨텍스트 바 `.tm-ctx`: 제목(tfStratTitle) · kind 배지 · 거래소/마켓(Bitget · BTC/USDT) · 상태 · 운용 ₩ · 오늘/누적 P&L · [일시정지] · [긴급 정지](2단계 확인) · 도움 아이콘. 기존 "위임 실행"/"KRW" 문자열 제거(user VM의 sym은 asset→'BTC/USDT' 매핑).
- 우 패널 `.tm-agent`: 상단 고정 상태 블록(TETH가 보고 있어요 / 마켓·포지션 / 기다리는 것 / 다음 확인 / 마지막 확인 N초 전) → 판단 카드 피드(S5) → "전략 관리" 행(손절/익절/예산 빠른 수정 → 기존 tfTmSay 경로) → 질문 칩 4개 + 입력(유지).
- 하단 탭: 유지. 스코프 토글을 탭 왼쪽. 데모 고지 1곳.
- 모바일: 헤더(제목·상태·긴급 정지) + 세그먼트 [차트 | 판단 | 포지션] (기존 차트/전략/Agent 탭을 재라벨·재배치, 전략 선택은 헤더 제목 탭 → 드로어).

## S7 전략 따라하기
- `tfShareHub`: 히어로+카운터 블록 삭제. 상단 = 탭(전략 찾기 / 따라가는 중 / 내 공유) + 정렬 칩(팔로워 수익 [기본] / 안정성 / 수익률 / 장기 검증) + 필터(시장 / 유형 / 위험도) + 검색.
- `tfSS3GridHtml` 카드 `.mk-card`: 제목(tfStratTitle) + kind 배지 + 부제 + "작성자 닉" → 30일 수익률(크게) + 배지("검증 기준" or "라이브") + 소형 곡선 → MDD · 운용 기간 · 팔로워 · 팔로워 수익 → 위험도(낮음/보통/높음 = MDD 기준) → [따라가기] + [자세히]. "수수료 반영" 마이크로 배지.
- 시드에 `fpnl`(팔로워 수익 근사 = fw × 운용액 500,000 × ret30/100, 시뮬레이션), `days`(운용 기간 = startI 기준 일수) 추가.
- 상세 `tfSS3Route` → 탭 5개: 개요(제목·부제·유형·작성자·"지금 뭘 하나" 상태 블록·[따라가기] 1차·⋯ 메뉴) / 성과(4타일 + 곡선/낙폭 + 월별 히트맵, 나머지 "자세히" 접힘) / 거래(체결 표) / 활동(판단 로그 S5) / 정보(만든 방법·사용 도구 "이번 판단에 사용: …"·버전).
- 따라가기 설정 `cpSetupView` 교체 → 바텀시트 `.mk-follow`: 예산(USDT) → 최대 손실(-20% 기본, 슬라이더) → 요약 2줄 → [따라가기 시작]. "고급" 접힘: 기존 포지션 처리(건너뛰기 기본) · 주문당 상한. 카피 프로필 라우트(#/share/t/)는 상세 개요로 리다이렉트(수치 1벌).
- 중단: 3택 모달(지금 정리 / 원본 청산 대기 / 직접 관리).
- 용어: 따라가기로 통일. ss3 설정복제는 "설정 가져오기"(⋯ 메뉴).

## S8 거래소 연결 (tfBrokersView / tfBrokerView)
- 제목 "거래소 연결". 사이드바 1급 버튼 추가(전략 따라하기 아래, 아이콘 link). 설정 메뉴 항목 라벨도 교체.
- `.cx-main` Bitget 카드: 로고 · "추천" · 상태 배지(derive.activation) · 3 불릿(약 1분 · 자산 이동 없음 · 거래하면 이용료 상쇄) · 지원(현물 · USDT 선물 · 따라가기) · [Bitget 연결하기](→ tfAcSheet('bitget')) · "계정이 없어요 → 만들기(약 2분)"(외부 링크, 2차) · 도움 행.
- `.cx-others`: Binance / OKX / Bybit 행(이름 · 지원 범위 · [연결]).
- `.cx-soon`: 접힘 "준비 중 15곳".
- tfBrokerView: 개요만(연결 방법 · 지원 기능 · 권한 3행 · FAQ). 리뷰 탭·평점·회사 정보·수수료 표 삭제(수수료는 "정보" 접힘).

## S9 홈(최소 수정)
- 타일 배지 "강력"/"HOT" 제거. 나머지 유지.

## 검증
- crawl.mjs 확장: 11 프리셋 × 화면 × 3뷰포트. 콘솔 예외 수집.
- 여정 6개 CDP 스크립트.
