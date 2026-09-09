# TETH 버그 수정·검수 보고서

<a id="integration-baseline"></a>
## 최신 main 위 UI·UX 통합 진행

현재 상태는 **2단계 내부 세션·대화 연결 + 공개 연구 문서 상세 차트의 로컬 검수본**이다. 아래 §1~8의 `53badf6` 기준 기록은
이전 디자인 작업본의 검수 이력이며 최신 main의 통과 증거가 아니다.
이식 중 발견한 문제와 새 검증은 이 절에 구분한다. 기존 파일은 삭제하지 않았다.

| 항목 | 현재 근거/범위 |
|---|---|
| 통합 브랜치 / base | `feat/web/ui-service-integration` / `c156d10746f35a757c4280b8063b82acacf2dd0a` |
| UI 출처 | 기존 `53badf6` 작업본의 미커밋 Client UI, 원본 `acccc7f802ac34333d666431b994717a0507e6c3` |
| PM 소비 | 최신 확인 `e75bd73846c305478202fe5510701569a8ce1c03` README/활성 Ledger·차트 경계, PM 수신5598068038. APIv0.5 source 후보 미발행과 실제 producer 미인계를 확인했다. 과거5694 기준 검수는 각 이력에 구분하고 PM writer 파일은 변경하지 않음 |
| FE 단독 쓰기 | Client 컴포넌트·스타일·UI 테스트·문서, internal controller/transport 소비 및 private 빌드. 공용 계약/Backend/PM writer 변경 없음 |
| 최신 코드 보존 | `src/main.tsx`, `src/components/SignalCanvas.tsx`, `src/backtest-data.ts`, `src/funnel-v2.css`, `src/reporting/`, generated 계약 및 feature flag. `internal-poc/`의 제한 변경은 아래 2단계에 명시 |
| 격리 | 구 UI4174 listener만 사용자 승인으로 TERM 정상 종료, 기존 코드/미커밋 변경 보존. 공개 UI4176·내부8789 유지. 테스트4175/4177은 시험 후 자동 종료. 공개 API/외부 provider/credential/배포 변경0 |
| 이식하지 않은 시험 | 중간 구형 TesiaApp에 의존하는 `client-shell`, `client-conversation`, `research-parity`, `research-navigation`, `research-document`, `responsive-readability` 6개 suite는 원래 작업본에 보존. 최신 dashboard 및 현행 Client UI suite로 분리하며 삭제/전체 승계 완료로 표시하지 않음 |
| 검증 구분 | 1단계 전체736개: 710 PASS/26 SKIP/실패0. 2단계의 실패→교정→검증은 바로 아래 별도 기록하며 이전 통과로 대체하지 않음 |
| 독립 점검 | agy `gemini-3.8-flash-high`의 상태 매핑 점검, 별도 `rtk claude_account 1`/`claude-opus-5` 코드 검수. 모델 의견은 자동 시험/Go 판정을 대체하지 않음 |

<a id="professional-renderer-preparation"></a>
### 현 디자인의 전문 캔들 렌더러 준비 — 제품 연결 전

사용자는 기존 디자인을 유지한 실제 차트 연결과 PM/Contracts/Backend 협업을 승인했다. 독립 Sol High 조사에서 **검증된 FULL_760D 1m/15m 원천 reader는 있지만 발행된 OHLC/LOD 차트 계약과 producer는 없음**을 확인했다. API v0.1의 runtime-v0.4 합성 projection을 sealed runtime-v0.8로 재해석하지 않는다. dirty `runtime_v08_private_view`는 Backend main의 권위가 아니다. 정본 §16/PM writer 예약과 additive 계약·소유권 복구 요청을 [Web #25](https://github.com/beak1011/tesia-web/issues/25#issuecomment-5596039535)에 전달했다. 이는 공용 계약 승인/발행 완료가 아니다.

`ClientProfessionalPriceChart`·`chart/price-chart-view`·`client-professional-chart.css`를 **독립 표시 컴포넌트**로 준비했다. 기존 전문 작업본의 LWCharts 캔들·EMA·거래량·눈금·크로스헤어 패턴을 현재 `g0/g2/g3/gt/gt2/gl/gb2/gg/gr` 색·로컬 폰트·44px 동작 영역에 맞췄다. 렌더러에 합성 생성/fetch/job 상태/주문 권한이 없으며 `PriceChartView`는 HTTP 스키마나 검증 receipt가 아니다. 테스트 및 DEV 전용 `?chart-workspace-preview=1`에서만 합성 입력으로 mount한다. **현재 tfw-chart/공개 제품/내부 API 미연결, 실제730일 BUY/SELL 복원 미완료**다. 전체 창 재생→차트/대화 전환은 아래 로컬 workspace에서 준비했다. 공개 entry 번들에 이 준비물이나 fixture/test host가 포함되지 않는다.

#### 계약 대기 중 진행 가능한 UI 작업

PM의 Web #25 댓글5596291474(2026-09-09 14:26 KST)는 요청 수신과 contract-first 후속 배정을 확인했다. 발행된 차트 계약/producer 수신은 아직 아니다. 사용자가 승인한 선행 UI 작업만 로컬에 반영한다. PM 정본 상태 표/Decision Log는 활성 별도 writer 소유이므로 복제하거나 변경하지 않았다.

| ID | 상태 | 발견·수정 및 범위 |
|---|---|---|
| BF-101 | FIXED_LOCAL_CANDIDATE | 기존 연구 차트의 autoSize ResizeObserver 콜백에서 동기 DOM 변경 desktop221/mobile283건을 계측했다. 초기 실측+단일 rAF resize로 변경하고 중복/숨김0 크기를 제외, observer/frame을 해제한다. native 콜백 중 DOM 변경0 회귀를 추가. 기존 간헐 경고 직접 재현과 구분한다. |
| BF-102 | FIXED_WORKSPACE_CANDIDATE | 작업 공간 첫 검수에서 Skip2개 중복 노출 발견. renderer 단독 동작은 유지하되 workspace에서는 상단1개만 제공. 같은 canvas로 재생→차트/원장/대화 전환하고 닫기·모션 감소·지연 타이머를 처리한다. |
| BF-103 | HARDENED_WORKSPACE_CANDIDATE | 체결 선택 시 해당 봉/크로스헤어와 개별 원장을 연결하고 질문의 참고 체결을 전달. 검색/방향/50개 추가 보기, 같은 봉 여러 체결 상세를 유지. 초안은 부모 소유이며 잘못된 입력이 재생 중 도착해도 대화가 숨겨진 상태로 남지 않게 한다. |
| BF-104 | HARDENED_WORKSPACE_CANDIDATE | agy 지적 중 긴 숫자의 임의 줄바꿈/제목 원문 잘림/뒤로가기44px 최소 폭을 보완. 참고 해제44px는 접근성을 위해 유지. 좁은 화면에서는 대화 전환, 짧은 높이에서는 대화·입력부 스크롤을 제공한다. |
| BF-105 | FIXED_RENDERER_CANDIDATE | 직접 재생 캡처에서 빈 시리즈 초기화 뒤 초반 봉이 왼쪽으로 밀려 사라지는 현상 발견. 재생 범위를 시작 시 실측/캐시하고 tick마다 논리 범위를 유지한다. 매 tick DOM 실측은 없다. 재생 중 스크롤/줌/크로스헤어는 정지, 완료 후 복원. 같은 identity의 실제 내용 변경도 옛 범위를 버리고 새 전체 결과에 맞춘다. |
| BF-106 | FIXED_WORKSPACE_CANDIDATE | Opus가 지적한 데스크톱 대화→모바일 축소 포커스 유실을 focus capture의 현재 패널 추적으로 교정. 클릭 위치와 대화 초안/포커스를 유지한다. 체결 행 선택은 현재 검색·필터를 유지하며 차트에서 선택할 때만 대상 원장을 펼친다. |
| BF-107 | HARDENED_RENDERER_CANDIDATE | 저장 PNG에 시장·주기·출처·전체 입력 범위·현재 조회 화면 고지를 직접 합성한다. 재생 중 저장은 disabled 및 handler guard로 차단. 출처 문자열이 실제 export canvas에 그려지는 테스트 추가. 임의 sourceLabel을 upstream 검증으로 승격하지 않는다. |
| BF-108 | HARDENED_RENDERER_CANDIDATE | interval 설치 후 첫 tick 실행 및 playing/disposed guard로 동기 종료 뒤 남는 interval 경로를 방어. stable callbacks·memo 차트/체결 행·validation memo로 대화 입력 때 기존 원장 포맷과 차트 재렌더를 줄인다. 입력 자동 높이 실측은 유지하며 10000행 저사양 실기기 성능 합격으로 확대하지 않는다. |
| BF-109 | HARDENED_WORKSPACE_CANDIDATE | onAsk Promise 수신·동기 ref lock·실제 pending 상태·일반화된 실패 문구와 수동 재전송 추가. 입력은 소유자가 성공 확인 후 지우며 실패/재시도/언마운트 뒤 reject에서 예외가 유출되지 않는다. 외부 busy도 중복 호출을 막지만 서버 idempotency/권한은 대체하지 않는다. |
| BF-110 | FIXED_WORKSPACE_CANDIDATE | 새 메시지 자동 따라가기 누락을 MutationObserver/ResizeObserver의 단일 rAF로 보완. 첫20개 검수에서 숨김/폭 축소 후 마지막 메시지81px 가림을 재현해 geometry 갱신과 사용자 스크롤 판단을 분리했다. 이전 기록200px 위치·초안만 변경·숨겨진 동안 새 메시지·버튼 복귀를 자동 시험한다. |
| BF-111 | HARDENED_WORKSPACE_CANDIDATE | 후반 체결을 선택하면 앞선 수천 행까지 mount하던 누적 더 보기를50행 페이지로 교체. 처음/이전/다음/마지막 페이지, 필터 복귀·해당 페이지 체결 참고 질문을 추가.10000건 fixture에서도 원장50행 유지. 개별 봉 보조 상세의 기존 별도 펼치기는 이 원장 페이지와 구분한다. |
| BF-112 | FIXED_WORKSPACE_CANDIDATE | Opus 검수에서 차트 identity 교체 시 in-flight 잠금/실패 알림 유실과 원장 offset 이중 차감을 발견. 전송 상태를 결과 key 바깥 안정 wrapper로 옮기고 원장 상대좌표를 사용한다. 페이지 초기화 뒤 선택 행을 따라가며 전송 중 결과 교체 후 호출1회/실패 초안·알림 유지, 마지막 행 scrollTop>500을 검증한다. |

검증/한계: 기존 테스트 fixture를 `src/dev/chart-workspace-fixture.ts` 한 곳으로 옮겨 미리보기와 공유했다. 일반 제품 경로는 불변이며 실제 데이터/API 연결 완료로 해석하지 않는다. 새 질문은 검수 화면 메모리에만 남고 AI 응답을 가장하지 않는다. 재생은60초 완료 결과 설명이며 backend RUNNING을 연장하지 않는다. writer와 자동 검증의 상세 후속 결과는 아래에 지속 갱신한다.

- ResizeObserver 별도 검수: 수정 전2 FAIL/2 PASS → 수정 후 기존 포함28 PASS/30.1s. `/tmp/teth-research-resize-red.log`, `/tmp/teth-research-resize-green.log`. 단독 baseline에서 간헐 경고 자체는 미재현이므로 해결 확정으로 확대하지 않는다.
- 첫 workspace 통합54개:50 PASS/4 FAIL. 두 건은 Skip 중복, 두 건은 Playwright가 한글을 키 이름으로 해석한 시험 코드 오류여서 `keyboard.insertText`로 교정했다. 다음54 PASS/35.6s, `/tmp/teth-workspace-regression-green.log`. 실제 캡처390/1440px를 직접 확인했다.
- agy `gemini-3.8-flash-high`의 좁은 읽기 전용 토큰/배치 검수 완료. 현재 토큰은 dark 고정이며 가상의 light 테마 결함은 채택하지 않았다. 파란 버튼 전경은 기존 클라이언트의 흰색 규칙에 맞췄다.44px 해제 버튼 축소 제안은 채택하지 않았다. `/tmp/teth-workspace-agy-review.log`.
- StrictMode 잘못된 입력/중간 모션 변경 추가58 PASS/35.4s (`/tmp/teth-workspace-final-regression.log`), 필터 유지 최종 차이12 PASS/9.1s 및 캡처12 PASS/8.4s는 각각 별도 실행이다. 원본 진입/공개·private 임시 build 경계6 PASS/14.2s (`/tmp/teth-workspace-boundary.log`). 공개 bundle에서 DEV route/TEST_ONLY_PRICE_VIEW/합성 입력 문구 부재를 자동 검증한다.
- personal(1) `claude-opus-5` 독립 읽기 전용 검수는 중4/하1 의견을 보고했고 BF105~108로 보완했다. `/tmp/teth-workspace-opus-review.log`. 원장/차트 렌더 memo 개선과 입력 textarea의 필요한 실측은 구분하며 모든 성능 위험을 해소했다는 판정은 아니다. Opus가 실행하지 못한 공개 산출물 확인은 위 자동 build 경계로 별도 확보했다. 최종 수정 뒤 Opus 재승인까지 받았다고 표시하지 않는다.
- Opus 보완 첫62개는61 PASS/1 FAIL(기존 canvas 동일성)였다. 실행 중 renderer 수정/HMR이 겹쳐 유효한 최종 판정으로 사용하지 않는다. 이후 소스 수정을 멈춘 상태로 동일 suite를 다시 실행한다. `/tmp/teth-workspace-opus-fixes.log`.
- 소스 고정 최종 회귀 **62 PASS/37.1s**, `/tmp/teth-workspace-reviewed-final.log`. export canvas의 출처 그리기,120→5000봉 동일 identity 범위 갱신, 재생 초기 범위, 대화 포커스의1440→390px 유지까지 포함한다. 이 실행에서 ResizeObserver 경고0. 직접 재생/모바일 대화/390·1440px 캡처 검수, lint/TypeScript/diff-check 통과. 실제 provider/LOD/원천 바인딩 또는 production Go 증거가 아니다.
- 최종 공개 진입/public·private 임시 build 경계 **6 PASS/14.3s**, `/tmp/teth-workspace-boundary-final.log`. live dist/DB·공용 계약·PM writer 쓰기0, 코드 commit/push/운영 승격0. 테스트4175/4177 종료 확인. 종료 시4176은 유지되지만8789 listener는 별도 상태 확인에서 부재 관찰(이번 FE 작업에서 중지/재시작하지 않음). 실제 연결 전 Backend runtime 상태 재확인 필요. 이 관찰만으로 원인을 추정하지 않는다.

#### 실제 연결 대기 후속 검수

PM origin/main `e75bd73846c305478202fe5510701569a8ce1c03` README와 활성 Ledger를 확인했다. 차트 API v0.5 exact27 source-only 후보는 Contracts 단독 writer 소유이며 아직 미발행이다. 후보 `docs/service-result-charts.md`의 미발행/producer 부재·owner private·bounded viewport/gap/provenance·source/run 결속 설명만 읽었고 SDK/스키마를 FE에 복사하거나 pin/API를 변경하지 않았다. Contracts main `a004bf7`, Backend main `70b2525`에는 새 차트 producer handoff가 없다. PM 정본/Decision Log는 별도 writer에 인계하며 직접 쓰지 않는다. 위 검수/계약 대기 기록을 차트 실연결 완료로 해석하지 않는다.

- agy `gemini-3.8-flash-high`가 수정 전 범위에서 전송 lock/실패 상태, 새 메시지 스크롤, 누적 원장 DOM 증가3건을 확인. BF109~111로 보완했다. `/tmp/teth-workspace-hardening-agy.log`. 작은 UI 검수이며 계약/보안 Go가 아니다.
- 첫 새/기존 workspace20개 **18 PASS/2 FAIL**, 숨김 복귀 후81px 미추적을 양 프로젝트에서 재현. 교정 후 **20 PASS/9.1s**. `/tmp/teth-workspace-hardening-tests.log`, `/tmp/teth-workspace-hardening-green.log`.
- 원본 연구/차트 포함 **68 PASS/39.3s**, `/tmp/teth-workspace-hardening-regression.log`. 오류 원문 비노출·중복 호출1회·실패 초안 보존·늦은 reject 해제·10000체결의50행 상한·320/390/861폭·스크롤 보존 포함. 이 숫자는 실제 API 통합이나 전 서비스 전수 시험이 아니다.
- personal(1) `claude-opus-5`가 전송 잠금 수명·행 좌표·숨김 스크롤3건을 독립 검토했다. `/tmp/teth-workspace-hardening-opus.log`. BF112와 마지막 읽기 위치 저장을 반영하고, 단일 rAF의 따라가기보다 새 사용자 스크롤을 우선한다. 실제 API/보안·최종 서비스 Go 검수가 아니다.
- 후속 캡처/빌드 결합12개 **11 PASS/1 FAIL**, 새3회 반복18개 **17 PASS/1 FAIL**, 추가5회30개 **26 PASS/4 FAIL**은 모두 기록한다. 일부 모바일 시험에서 숨겨진 대화의 `scrollHeight-clientHeight-scrollTop=0`을 하단 도달로 잘못 인정하고 숨겨진 노드에200px 이동을 시도했다. 스크롤 기대값을 약화하지 않고 clientHeight>0을 만족해야 거리 검사하도록 강화했다. `/tmp/teth-workspace-hardening-boundary.log`, `/tmp/teth-workspace-hardening-repeat.log`, `/tmp/teth-workspace-hardening-stable.log`. 이 실패 실행을 합격 증거에 합산하지 않는다.
- 가시성 검사를 강화한 뒤에도30개 **26 PASS/4 FAIL**이 재발했으므로 시험 조건만의 문제라는 가설을 폐기했다. 임시 setter 계측에서 사용자 이동200 뒤 UI rAF가2915를 쓰는 순서를 확인했다(6개4 PASS/2 FAIL, `/tmp/teth-scroll-debug.log`). 숨김에서 돌아온 직후의 새 스크롤을 저장 위치보다 우선하도록 교정했다. debug 계측 코드는 제거했다. 이후 동일5회 **30 PASS/27.3s**, `/tmp/teth-workspace-hardening-race.log`. 휠·터치·키보드의 실제 사용자 스크롤 의도도 예약된 follow보다 우선하고 Home 키 회귀를 추가했다.
- 전체 영향+빌드 경계74개 **73 PASS/1 FAIL**, `/tmp/teth-workspace-hardening-verified.log`. 재생 범위 조회 시험이 LWCharts의 draw queue 적용 전에 동기 getter를 읽었다. 설치된5.2.1 `_internal_setTargetLogicalRange`가 invalidate 후 draw에서 범위를 적용함을 확인하고 같은 범위 기준(`<0`, `>=119`)을 유지한 polling assertion으로 수정했다. 실패를 기능 통과로 바꾸지 않으며 소스 고정 전체 재실행으로 구분한다.
- PM의 새 [수신5598068038](https://github.com/beak1011/tesia-web/issues/25#issuecomment-5598068038)을 확인했다. APIv0.5 source `b81719f`는 네 read-only operation을 시험했으나 aggregate/SDK0.16rc1 빌드·설치 검수와 exact 발행 pin/producer handoff가 남았다. 현재 로그인 여정의 엔진 입력은 STRUCTURAL_SMOKE 합성이며 사용자별 actual producer는 별도 구현 필요다. 기존730일 sealed 결과를 새 사용자 전략에 붙이지 않는다.8789 부재는 GCP 장애 근거가 아니고 상시 검수용 exact profile 확인이 우선이다. 이 FE 작업에서 서버·DB·credential·Cloud·계약 writer 변경은 없다.
- 마지막 소스 고정 **74 PASS/46.7s**, `/tmp/teth-workspace-hardening-complete.log`. workspace·hardening·renderer·기존 연구/resize·원본 진입·공개/private 임시 build 경계를 포함한다. TypeScript/lint/diff-check PASS,74개 중 ResizeObserver loop 경고0. 전송 실패/읽기 위치 안내/320px 원장 캡처 직접 검수. 공개 bundle의 DEV/합성 fixture 미포함도 다시 검증했다. 최종 수정 후 Opus 재승인·actual 연결·운영 Go는 아니며 기존4176·dist/DB 불변, 테스트 프로세스 종료·코드 commit/push/배포0이다.

| ID | 상태 | 발견·수정 및 범위 |
|---|---|---|
| BF-095 | FIXED_RENDERER_CANDIDATE | 모바일 캡처에서 첫 BUY 라벨이 잘리고 거래량 구분선이 밝게 튀는 것을 발견. 전체 맞춤 시 양끝 여백 확보, pane separator를 현재 선 토큰으로 변경. 390px 후속 캡처 직접 대조. |
| BF-096 | HARDENED_RENDERER_CANDIDATE | 포함 봉이 없는 체결은 임의 미래 봉에 붙이지 않고 미배치 건수를 표시. 중복 ID·봉 역전/중첩·잘못된 OHLC/시간/정밀도·5000봉/10000체결 초과를 거절한다. grouped marker와 재생 공개 경계는 실제 렌더러가 공유하는 함수로 golden 검증. upstream source/hash/Decimal 계약 검증은 아직 아님. |
| BF-097 | FIXED_RENDERER_CANDIDATE | 초기 구현의 같은 봉 체결 배열 반복 복사와 지표별 차트 재생성을 제거. 그룹은 push/sort, 색은 캐시하고 가격 눈금·EMA·거래량은 동일 chart 인스턴스에서 변경한다. 한 봉10000체결은 방향별 마커와 50건 단위 원장으로 표시. 선택 봉 변경 시 펼친 개수 초기화. 실제 저사양 기기/동시 사용자 부하 합격은 아님. |
| BF-098 | FIXED_RENDERER_CANDIDATE | 재생 패널 삽입으로 차트가 밀리는 초기 구조를 overlay로 변경. 완료 입력을 60초/최대10Hz로 증분 표시하고 Skip은 로컬 재생만 종료. timestamp 기반 경과량으로 지연된 타이머를 따라잡고 모션 감소는 전체 결과와 안내 제공. 언마운트/identity 변경 시 타이머·차트 정리. 서버 RUNNING 연장·재실행·가상 PnL 없음. |
| BF-099 | HARDENED_RENDERER_CANDIDATE | rAF에만 의존한 오류 표시를 dispose guard가 있는 microtask로 변경. 키보드 봉 선택 시 가시 범위를 따라가고 별도 live 안내를 제공. 체결 시간을 UTC 초 단위로 구분하며 입력 precision을 캔들/EMA 축에 적용. 보조공학·실제 Safari 실기기 검증은 미완료. |
| BF-100 | FIXED_RENDERER_CANDIDATE | 후속 Opus 검수에서 부모가 같은 데이터의 새 객체를 전달하면 chart 재생성이 재생을 끊을 수 있음을 지적했다. 내용 동등성 비교로 입력 참조를 안정화하되 같은 identity라도 실제 내용 변경은 반영한다. 동일 입력 재전달 시 캔버스 동일/재생 지속, 내용 변경 시 갱신을 desktop/mobile로 검증했다. 초·분·시간·일 표시와 초 단위 축도 분기한다. |

검수 이력:

- 첫12개: 9 PASS/3 FAIL. 두 실패는 test host의 output도 status라는 locator 충돌, 하나는 진행률을 정확히0으로 고정한 시험 기대 오류였다. 제품 결함으로 세지 않고 locator/진행 범위 기대를 교정했다. 다음12 PASS/6.1s.
- 기존 연구 상세와 합친36 PASS/48.1s. 기존 연구 ResizeObserver 알림은 다시 관찰되어 OPEN009를 유지한다. 의도적으로 주입한 청크 실패는 별도이며 새 렌더러에서 같은 알림이 재현됐다고 표시하지 않는다. `/tmp/teth-price-chart-regression.log`.
- 상한/소수가격/결과 교체를 더한16 PASS/8.1s, Opus 개선 후16 PASS/8.0s, marker golden·접근성·미배치/재생 위치 검증 후16 PASS/8.3s. 마지막 `/tmp/teth-price-chart-reviewed-tests.log`. 이 숫자는 합성 렌더러 테스트이며 실제 OHLC 원천/HTTP 검증이 아니다.
- agy `gemini-3.8-flash-high`는 작은 읽기 전용 토큰/배치 검수에 사용했다. 모바일 버튼 그룹, 활성 상태, 체결 행 정렬 제안은 반영했다. tabular-nums가 한글을 왜곡한다는 추정은 근거가 없어 채택하지 않았다.
- personal(1) `claude-opus-5` 정적 검수에서 미배치 고지·반복 복사·차트 재생성·재생 위치·키보드/상세 순서를 점검했다. 검수 당시 이후에 추가된 상한 테스트/Map 개선은 미검수로 나온 시간차가 있어 코드와 실행 증거로 구분했다. `clock.install()`이 항상 정지한다는 의견은 실제 Playwright 실행 결과와 달랐으나 rAF 오류 표시 의존은 예방적으로 제거했다. 후속 독립 검수는 별도 기록한다.
- 임시 공개 build `/tmp/teth-price-chart-public.qKkoAp` 통과, 준비 renderer/test host/사설 chart endpoint 문자열 미포함 확인. live4176/8789·dist·DB 변경0. PM/Backend/Contracts writer 파일 쓰기0, Web 코드 commit/push/배포0.
- 후속 Opus 정적 검수는 이전 항목 반영/C0와 새 H1(동일 내용 재할당 시 재생 소실), M1(초 주기 표시)을 보고했다. BF-100으로 보완 후 **18 PASS/9.3s**, `/tmp/teth-price-chart-stability-tests.log`; 이 마지막 수정의 Opus 재재검수까지 완료했다고 표시하지 않는다. 그 직전 기존 연구+렌더러 **40 PASS/49.2s**, `/tmp/teth-price-chart-final-regression.log`와 캔버스 동일성·PNG 저장을 추가한16 PASS/8.4s는 별도 이력이다. 최종 TypeScript·lint·diff-check 통과. 기존 연구 ResizeObserver 경고는40개 실행에서도 관찰되어 OPEN009 유지, 신규 renderer 단독18개에서는 pageerror 미재현. PM 정본 상태/Decision Log는 다른 writer의 활성 파일이어서 요청 인계만 했으며 아직 반영 확인 전이다.

<a id="replay-result-recovery"></a>
### 원응답 replay 연결·완료 결과 복구

현재 PM은 Backend #105/Infra #61/AI #31/Contracts #29까지 기록하지만 이 시험의 설치 조합은 **Infra 승인 Backend #104 + AI #28 + Contracts 0.14.0rc1**이다. SDK rc2는 앞선 FE 소비를 유지한다. 최신 모든 서비스나 실제 provider가 연결됐다는 뜻이 아니다.

| ID | 상태 | 수정·검증 경계 |
|---|---|---|
| BF-090 | FIXED_LOCAL_CANDIDATE | 완료 report 조회 실패가 부트 전체 오류가 되거나 재시도 수단 없이 남던 결함. 초안·완료 job을 보존하고 결과 오류/진행 상태를 분리해 수동 GET 재조회를 제공한다. 첫 회귀1 FAIL 후 desktop/mobile2 PASS. |
| BF-091 | PREVENTIVE_HARDENING | report/manifest/IS/OOS는 하나의 in-flight 그룹으로 allSettled까지 기다린다. 부분 응답 중 반복 클릭을 차단하고 세션 epoch/요청 identity가 달라지면 오래된 결과를 적용하지 않는다. 무결성 검증은 그대로이며 401은 일반 네트워크 재시도가 아닌 세션 확인으로 분기한다. |
| BF-092 | VERIFIED_INTEGRATION | #102 수정이 포함된 #104 설치물에서 동일 body/key/If-Match 재전송200, 원응답 data/ETag 동일, 완성·미완성 대화 중복 없음 검증. 기존 #99용412→GET 시험도 별도 모드로 유지한다. |
| BF-093 | FIXED_LOCAL_CANDIDATE | logout 시 조회 epoch 무효화 후 logout이 실패하면 조회가 없는데도 '불러오는 중'으로 남을 수 있는 상태 문구를 조건부로 교정했다. 실제 loading일 때만 진행 안내, 그 외에는 완료/수동 재조회 안내를 제공한다. Opus 상태 전이 검수로 확인했으며 해당 logout·지연 결합 동선의 별도 브라우저 재현은 아직 없음. |
| BF-094 | FIXED_LOCAL_CANDIDATE | 내부 기본/fixture entry는 Geist만 import하고 시스템 한글 폰트에 의존해 Linux 캡처에서 한글이 네모로 표시됐다. 기존 로컬 Noto Sans KR Variable을 두 entry에 import하고 정확한 family를 지정했다. Client 화면의 원본 폰트/디자인은 유지한다. |

- `tests/internal-poc/run-service-candidate.mjs`는 명시 release/Web 경로와 core wheel SHA·설치 payload를 확인하고, 독립 SQLite/8790에서만 실제 HTTP 시험 후 SIGTERM/drain한다. live PG8789와 공개4176 자산/DB는 변경하지 않는다. 새 runtime DB는 복구·검수용으로 보존하며 공유 서비스나 운영 승격이 아니다.
- 고정 Backend wheel SHA `b5965d4ebdb7f179e92411341d2d64a79410e67dd4b8563f5a324bc543496025`, AI `9241104520c145a7d2fd398eb2ee2823b0f8def2986d6c9e717aa25e3425bd99`, Contracts `e9a8a401e0c2437eb42a528730810b08a6a5dcca00744e10f2a9ddb09b155e5f`. 전체24 wheel closure의 승인 설치물에서 core bytes를 재확인한 것이며 새 전체 공급망 인증은 아니다.
- 최초 candidate actual18 PASS/1.8m(실제12+fixture/public6), runtime 종료0·stderr0. `/tmp/teth-replay-actual.log`. synthetic 입력만 사용하며 외부 AI/Google/실제730일 거래는 실행하지 않았다.
- 결과 회귀는 네트워크 실패→초안/job 보존→수동 재조회, report 조기 실패+manifest 지연 동안 재시도 잠금, 무결성 불일치 거부, 401 세션 확인을 desktop/mobile에서 검증한다. `/tmp/teth-result-final.log` 2 PASS/9.5s. 이 결과 payload는 fixture이며 실제 시장 성과 증거가 아니다.
- agy `gemini-3.8-flash-high`는 좁은 읽기 전용 UX 검수로 단일 조회 잠금과 기록 보존 안내를 제안했다. impeccable/harden 기준으로 원본 token/간격/오류 상태만 보강했다. 모델 검수와 자동화·실제 연결 증거를 구분한다.
- 별도 personal(1) `claude-opus-5` 검수 및 호출부 보완 재검수: 최초 job 교차 High 의견은 버튼의 job-null 조건·submit 후 pending 제거·reset reload 확인 후 확정 결함이 아닌 예방 항목으로 정정됐다. latch에 backtestId를 명시하고 승인/재개 함수에도 job-null 방어를 보강했다. polling 중 작업을 임의로 취소하거나 새로운 실행 권한을 만들지 않는다. 모델 검토를 최종 서비스 GO로 표시하지 않는다.
- 전체852개 **814 PASS/38 SKIP**,4.8m (`/tmp/teth-replay-full.log`). 최종 후보 actual18 **18 PASS**,2.3m (`/tmp/teth-replay-actual-final.log`), 종료0/stderr0. 이 두 실행 뒤 BF-093/예방 가드를 추가했으므로 마지막 영향 재검증은 아래에 별도 기록한다.
- 전체 실행에서 상세 차트의 ResizeObserver loop 경고가 보였다. 기존 테스트가 모든 경고를 단언하지 않아 분석 반응형 검사에 pageerror 수집/0건 조건을 추가했다. 별도 desktop/mobile 각3회 **6 PASS**,26.7s (`/tmp/teth-chart-resize-red.log`; 이름과 달리 재현 실패 로그). 근본 원인 미확정으로 OPEN009에 남기며 경고를 숨기는 handler나 추정 resize 패치를 넣지 않았다.
- 영향 재검수의 첫 시도는 기존 시험4175가 종료되기 전 시작해 포트 점유로 실행 전 거절됐다. 제품 실패/통과에 합산하지 않고 이전 시험 종료 후 같은 설정으로 재실행했다.
- Opus 후 방어/문구 수정 영향116개 **104 PASS/12 opt-in SKIP**,51.2s (`/tmp/teth-replay-postreview.log`). 새 private build 실제 replay4개 **4 PASS**,31.5s (`/tmp/teth-replay-actual-postreview.log`), runtime 정상 종료0/stderr0.
- 직접 캡처에서 BF-094를 추가 발견해 수정했다. 폰트/결과 패널의 desktop/mobile 검수2개 **2 PASS**,11.5s (`/tmp/teth-result-visual-final.log`). 기본 화면과 원본 Client 화면의 한글·긴 설명·가로 넘침·실패 후 재조회 성공을 검사하고 양쪽 캡처를 직접 확인했다. 첫 Client 캡처 시도2 FAIL은 hash만 바꾸고 문서를 새로 부트하지 않은 시험 경로 문제여서 명시 reload로 교정했다. 실제 사용자용 화면 전환 기능을 변경한 것이 아니다.
- 최종 lint/TypeScript 및 public/private 임시 outDir build PASS. 보호된 live dist를 덮어쓰지 않았다. 추가 폰트 수정을 전체814 PASS에 소급 포함하지 않으며 영향 및 빌드 경계 재검증으로 구분한다.
- 폰트 수정 후 빌드 경계/Client fixture·공개 진입20개 **8 PASS/12 actual opt-in SKIP**,15.4s (`/tmp/teth-connection-boundary.log`). 내부 코드의 공개 산출물 미포함과 별도 빌드 보존을 재확인했다. 최종 listener는4176/8789만 유지하며4174/4175/4177/8790은 없다. 코드/DB 삭제·PM writer 수정·원격 push·운영/live 자산 승격0.
- 증거 SHA256: 전체 `bd878e035b7f4925ca9f5dbfb273aa3ce8d27512a4b916f6d8a9ac6b19195a6f`, 영향 `9d1565c96efea2c91f8535e6ca74eb8d864fca43253cd2c5da5d1dc685d2eaf1`, 실제18 `787f20b078857155aca3feac743e5d7d3c8834d5caed66879dd83c33c28e9b76`, 최종 replay4 `48eebe8f11efb663edaf22e0ae0a89c5841b70065ff2869c1313a60419508138`, 시각/복구2 `eed7ffb4cbb4993e535dde514a477214f877afcffd3989c15b044507a65aa01f`. 임시 로그는 로컬 증거이며 제품 자산·운영 결과가 아니다.

<a id="sdk-draft-recovery"></a>
### SDK rc2 소비와 실제 초안 복구

PM §16의 Contracts #28 소비 범위다. 원본 UI·공용 wire·Backend #99/AI #28 runtime pin·sealed730일 authority는 변경하지 않는다. SDK `0.8.0-rc.2` source `c37e5f822f87de725740111f9bee8bab8d72dba8`, manifest `391e9a907baa5d483c403b9d66d1bbb7ee6f021c7202c41c352ffa5aba56ac5a`를 pin한다. upstream 원문/타입/SDK/operation bytes와 기존 단일 type-only cast 차이를 자동 검사한다. generated guard를 로컬에서 완화하지 않는다.

| ID | 상태 | 수정·검증 경계 |
|---|---|---|
| BF-085 | FIXED_LOCAL_CANDIDATE | 정상 partial Draft GET을 거절하던 SDK를 Contracts 발행 rc2로 소비. 공용 fixture matrix22종으로 완성/미완성6종 수용, malformed16종 거절. 타입/승인 의미는 그대로다. |
| BF-086 | FIXED_LOCAL_CANDIDATE | 모든 owner-local 세션에서 캐시를 버리던 부트를 기존/신규 세션으로 분리. 기존 세션은 소유권 GET, 신규 세션은 reset. 기존 다른 소유자의 draftId를 저장해도 실제 GET404 후 로컬 reset. |
| BF-087 | FIXED_LOCAL_CANDIDATE | 초안 GET보다 먼저 입력/reset/logout이 열리는 race 방지. bootReady와 handler guard를 적용하고 실제 GET 응답 전달을 잠근 브라우저 시험으로 확인한다. |
| BF-088 | FIXED_LOCAL_CANDIDATE | SDK 구결함 우회용 cached partial fast path가 legacy 실제 adapter에도 적용되고 완료 job ID를 떨어뜨리던 경로 제거. 모든 복구가 SDK GET을 거치며 GET만으로 READY를 새로 만들지 않는다. 기존 job 조회/신뢰 검증은 새 실행 승인과 분리한다. |
| BF-089 | FIXED_LOCAL_CANDIDATE | 실제 모바일/데스크톱 캡처에서 복구 안내가 자동 follow로 가려짐. 복구 완료 시 한 번만 상단으로 정렬하고 다음 메시지부터 원래 스크롤을 유지한다. 미완성 초안의 녹색 후보 표시도 제거하고 서버 candidateState별 중립 문구/줄바꿈 없는 배지로 정렬한다. |

- 첫 pin acceptance는 구 rc1에 대해1 FAIL/1 PASS를 확인한 뒤 교체했다. 최초 영향27개는24 PASS/3 FAIL: 폐기된 partial 거절 기대2건과 완료 결과 복귀1건. 후속182개180 PASS/2 FAIL에서 반복 복귀의 cached fast path 문제를 확인했고 제거 후 vertical50 PASS를 확보했다. 실패를 통과로 재분류하지 않는다.
- 첫 actual 후보에서 기존 익명 세션 분기 오적용을 재현했다. 동일 시점 Opus도 지적했고 조건을 정확한 위치로 교정했다. 해당 실행은 중단했으며 PASS로 합산하지 않는다.
- 교정 후보 실제 HTTP18 PASS/1.8m: fixture/public6과 실제12(데스크톱/모바일 각각6). 대화·검증·익명 승인 차단·로그아웃·reload 지연 잠금·새 세션 초기화·다른 owner404·응답 유실412/GET 확인. `/tmp/teth-sdk-actual-recovery-final.log`. API는 실제8789, 새 정적 자산만 테스트 브라우저에 주입했다. live private dist 갱신/Backend #102 소비/공개 배포의 증거가 아니다.
- agy `gemini-3.8-flash-high`는 복구 안내/상태만 읽기 전용 검토했다. 초안 복구와 이전 대화 내용 복원을 구분하고 입력 잠금 시 다음 단계 안내를 보완했다. `impeccable/harden`에 따라 에러·복귀·조기 입력을 시험한다. personal(1) Opus 5 검수는 자동화와 별도로 기록하며 전체 서비스 Go로 승격하지 않는다.
- 전체852개 **814 PASS/38 SKIP**, 4.7m, `/tmp/teth-sdk-full.log` SHA `8a9f6caf610d5c0a14ac204c10ac8c32a50ef89a7f9eebc42770d3ce86d7e298`. SKIP은 프로젝트 조건26+별도 actual12이며 미실행을 PASS로 세지 않는다. 이후 BF-089/승인 handler bootReady 추가는 별도 영향/actual 재검증으로 구분한다. 실제 질문/쿠키/CSRF를 trace/로그에 저장하지 않으며 테스트는 synthetic 입력만 사용한다.
- 마지막 수정 후 영향68개 **56 PASS/12 opt-in SKIP**, 36.2s. `/tmp/teth-sdk-last-affected.log` SHA `3c1ffdfa8816214d0f2ca209563974c06be9360402164609789b0f42e5c3209e`. TypeScript/private 임시 outDir build·lint·diff-check PASS. 공개/private 빌드 격리는 위 전체 회귀에 포함하며 실행 중인 dist-internal-poc는 덮어쓰지 않았다.
- 최종 후보 actual reload/소유권·화면4개 **4 PASS**, 31.6s. `/tmp/teth-sdk-final-screen.log` SHA `6298ebc01662c3fd14520ea2ec89d0d4312ef5bd9d76cb3e870a85d2354b0ac9`. `/tmp/teth-sdk-final-screen-results/`의 desktop/mobile `draft-recovered.png`를 직접 확인해 복구 안내 시인성·중립 배지·줄바꿈을 검수했다. 시험 종료 후 listener는4176/8789만 유지하고4174/4175/4177은 없음. 원격 push/main 병합/운영 및 live private 자산 승격0.
- personal(1) Opus 5 재검수에서 cached bypass 제거/분기 교정은 재확인했다. 승인 함수에도 bootReady를 넣고 seam workflow를 복구 완료 전 숨기는 방어를 추가했다. 결과 읽기 실패의 수동 재조회는 OPEN008로 남겼다. 모델의 삭제 실패 시 무조건 reset 허용 제안은 저장물이 없다는 근거가 없으므로 채택하지 않는다. ETag 강도는 generated SDK가 이미 검사하며 Paper는 별도 승인 전략 binding/수동 시작 계약을 가진다. report 검증과 Paper 자체 계약을 동일 권한으로 합치지 않는다. caller는 모듈 상수/안정 참조로 확인했으며 모델 의견을 전체 서비스 Go로 요약하지 않는다.

### 원본 연구 문서 → 상세 차트 통합

현재 사용자 승인 범위는 클라이언트 원본 UI를 유지한 선택적 확장 아티팩트다. 실제730일 결과/라이브/전체 전문 작업본 통합의 완료 증거가 아니다. 변경 전 HEAD `5c79fa7ea00cbad953ddfe03d43c8ce719db03f9`, PM 읽기 기준 `a40ce9a`, 클라이언트 시각 정본 `acccc7f`를 유지한다. PM 상태 표/정본은 다른 writer 소유이며 이 작업으로 수신·출시 승인 상태를 바꾸지 않는다.

- 진입: Backtest v1/v2·Final Report의 `차트로 자세히 보기`. 동일 세션/문서의 질문·답변·초안을 사용한다. 브라우저 Back/Forward와 복귀 버튼을 원래 문서/스크롤/포커스에 연결한다.
- 공급: `CLIENT_RESEARCH_FIXTURE`를 공유한다. v1 27거래/v2 10거래, 수익·낙폭·승률·거래별 PnL을 바꾸지 않는다. 가격 표본과 봉 번호만 있으므로 선 차트/자산 곡선/거래손익 막대를 제공한다. 없는 OHLC/거래량을 합성하거나 막대를 거래량으로 표기하지 않는다. Holdout 가격을 Research 차트에서 제외한다.
- 표시: 원본 토큰·로고·폰트·레일 유지,860px 이하 단일 면. 최초16초 결과 재생은 Skip/감소 모션으로 건너뛸 수 있고 작업 실행과 독립이다. 전체910개 슬롯과 축을 유지하며 최대 약12.5Hz로 갱신, hidden에서는 그리지 않는다. 실제 대규모 결과의 성능 평가로 승격하지 않는다.
- 보존: 별도 `web-lightweight-backtest-workspace`의 dirty/untracked 코드, `SignalCanvas`/reporting/API/generated 계약/기존 internal runtime·dist는 변경하지 않았다. 운영 배포·main 병합·이번 변경의 push 없음.

| ID | 상태 | 발견·교정·근거 |
|---|---|---|
| BF-078 | FIXED_LOCAL | 첫 시각 검수에서 ClientLogo가 img인데 svg 크기 규칙만 적용해 우측 로고가 과대 표시됨. 원본 로고22×16px 제한과 bounding-box 회귀로 교정. |
| BF-079 | FIXED_LOCAL | 320/390px 원본 메뉴와 상세 복귀 버튼이 겹침. 메뉴 영역56px 확보, 버전 정보 두 번째 행으로 분리, 실제 두 버튼의 비겹침 단언. |
| BF-080 | FIXED_LOCAL | 축소 화면의 BUY/SELL 라벨 밀집·기본 pane 구분선/지표 색 우선순위가 원본 토큰과 불일치.44px 라벨 간격·화살표 보존·토큰 구분선·지표 색 specificity 교정. resize 중 선택 구간 유지. |
| BF-081 | FIXED_LOCAL | 초기 재생이 마지막 미래 whitespace 한 점만 남겨 미재생 봉 범위를 압축함. 모든910개 인덱스 슬롯을 유지하고 전체 결과의 가격/손익 축을 고정한다. 재생 중 crosshair·pan/zoom 비활성, 완료 후 복원. |
| BF-082 | FIXED_LOCAL / 예방 회귀 | 선택적 차트 청크 실패 시 문서 보존·키보드 복귀와 자동 포커스 경계 강화. 재생 완료/중도 복귀 cleanup·새로고침·저장 차단·독립 버전·초안 회귀 추가. |
| BF-083 | FIXED_LOCAL | Opus 검수의 자산곡선 quote→가격 재생 단위 잔류, 숨긴 긴 초안의 재생 후 높이, 모바일 거래→질문 CTA 위치와 보조기술의 매수/매도 지점 누락을 교정한다. mode/재생 경계에서 quote 초기화, playing 의존 측정, 거래 목록 안 CTA·포커스, thread region 및 봉 번호 라벨,44px 터치 영역으로 검증한다. |
| BF-084 | FIXED_LOCAL / 예방 회귀 | 차트 생성 오류 후 성공해도 오류 층이 남을 수 있어 성공 초기화·실패 시 aria-hidden 및 초기화 전체의 정리 경계를 추가했다. 생성 실패→모드 변경 재시도2개 PASS. 최초 getContext 주입은 생성이 아니라 StrictMode의 canvas 해제에 예외를 던져 다른 경로를 시험했다. 테스트를 table 생성 실패로 한정해 목적을 바로잡았으며 그 실패를 정상 브라우저의 운영 장애로 주장하지 않는다. |

검수 이력:

1. 최초 신규12개 PASS, tsc/lint PASS. 이후 실제320/390/768/1024/1440px 캡처에서 BF-078~081을 찾아 교정했다. 자동 통과를 시각 완성으로 대체하지 않았다.
2. 경계 보강18개 중16 PASS/2 FAIL. 두 실패는 원본 Final Report의 실제 heading이 전략명인데 `Final Report` heading을 찾은 잘못된 테스트 selector였다. 실제 article·선택 문서 근거로 교정했으며 UI 원문을 테스트에 맞춰 바꾸지 않았다.
3. 보강 후18개 PASS(20.1s), public build/lint PASS. 첫 전체798개 중764 PASS/34 SKIP/실패0(4.9m).34 SKIP은 기존 프로젝트 전용26개 및 명시 opt-in 실제 HTTP8개이며, 이번 작업에서 actual 서버를 재검증했다고 표시하지 않는다.
4. personal(1) `claude-opus-5` 독립 코드 검수 후 위 BF-083/084와 range 유한성/숨긴 컨테이너 가드, Holdout 경계909 고정·실제 제외 표본·청산 봉 유일성 단언을 보강했다. 현재 호출이 일치하는 doc/version의 가상 오호출, 고정84px pane의 미래 변경 위험 등은 실제 결함과 구분했다.24개 확장 시험 중22 PASS/2 FAIL은 BF-084의 잘못된 주입 대상을 확인한 실행이며 수정된 생성 실패 시험2 PASS를 별도로 확보했다.
5. 빌드된4176을 직접 열어 원본 Final Report→분석,390px 대화/복귀를 검수했다. 홈에서 차트 청크 로드0, 진입 후 JS/CSS2개 로드, 외부 요청0, pageerror0, 가로 넘침0px. `/tmp/teth-analysis-production-*.png`는 로컬 QA 증거이며 제품 자산/운영 서버 화면이 아니다. 전문 차트 JS는 지연 청크 약61KB gzip이며 대규모 실제 데이터의 부하 보장이 아니다.
6. 최종 전체804개 **770 PASS/34 SKIP/실패0**,5.0m (`/tmp/teth-analysis-full-final.log`). 이후 생성 실패 때 시각 재생을 종료해 거래 기록을 노출하고 오류 층이 라벨 위에 표시되도록 마지막 경계만 보완했다. 이 마지막 변경에는 신규24개를 포함한 연구/저장/백그라운드 영향56개 **56 PASS**,33.8s (`/tmp/teth-analysis-last-affected.log`)와 build/lint PASS를 별도로 실행했다. 전체804개와 마지막 영향56개의 실행 시점을 섞지 않는다.
7. 마지막 빌드 이전 주요 UI는1440px v1 전체27거래,390px 거래3 선택→질문→문서 복귀,768×600px 자산 곡선을 직접 캡처했다. pageerror0·가로 넘침0·복귀 후 차트 canvas0·문서 질문 보존을 확인했다. `/tmp/teth-analysis-final-{v1,selected,thread,768}.png`는 로컬 임시 증거다. 실제 기기/모든 보조기술/모든 언어·확대 조합 및 대규모 데이터 검증은 별도다.

이 변경의11개 경로는 `package.json`, `package-lock.json`, `src/client-restored-research.css`, `src/components/ClientResearchWorkspace.tsx`, 신규 `src/client-research-analysis.ts`, `src/client-research-analysis.css`, `src/components/ClientResearchAnalysis.tsx`, `tests/client-research-analysis.spec.ts`, `README.md`, `DESIGN.md`, 본 보고서다. 기존 lock의 libc 메타데이터를 보존하고 차트/캔버스2개 의존성만 추가했다. 공개4176 build만 갱신, 실행 중 private8789 build와 runtime은 건드리지 않았다. 이 작업은 로컬 미커밋 검수 상태이며 사용자 승인 없는 push/배포 없음.

증거 해시 SHA256: 전체 `a5fd5d6aa2d341d17f3ccff53b609479c818f132e351a6bec66d0a148fa4ad4e`, 마지막 영향 `d6629d8d0c38a004c472893863caac2078289c3a9c2f7c7ec8591c9024928e3d`. `/tmp` 파일은 일시 증거이며 본 실행 요약을 장기 기록으로 유지한다.

청크 실패 주입의 React console.error는 예상 오류로 구분한다. 모델 검수와 브라우저/자동 테스트를 서로 대체하지 않으며, 실제 서버/API/사용자 승인 없는 운영 승격은 수행하지 않았다.

agy `gemini-3.8-flash-high`는 토큰/타이포/밀도/모바일의 좁은 읽기 전용 일관성 검수에 사용했다. impeccable craft는 원본 보존형 실제 화면 검수·교정에 적용했다. 새 브랜드/이미지/화면 재창작은 하지 않았다. 별도 personal(1) `claude-opus-5` 코드 검수 의견과 자동 테스트는 구분한다.

### 2단계: 원본 대화 UI와 실제 owner-local 소비

#### 2026-09-09 후속 검수 및 최신화 구분

- Web/main `c156d10746f35a757c4280b8063b82acacf2dd0a`를 fetch 후 비교: 이번 변경 전 `origin/main...HEAD`는 behind0/ahead2, 미포함 Web 원격 branch0, 열린 Web PR0. 클라이언트 원본 `aresjoo/tesia-lab`의 원격 HEAD도 `acccc7f802ac34333d666431b994717a0507e6c3`로 이식 pin과 같다. Git에 공유된 Web 기준이며 미공유 로컬 실험/제외 후보까지 통합한 것은 아니다.
- 별도 main 확인: Backend `234072c7d5bf2d089b9f5f3babe3925c4f57d5fc`, Contracts `3e9097e38dc3cff9553c480900284b5165ca83c5`, AI `852762f0cc1227bbdae9fa54e635c42ee12765d4`, Infra `ecfc3152364c5c2f6a77312010ea56e4695c3533`. 모두 fetch 후 확인했고 각 dirty checkout은 수정하지 않았다. PM companion만 clean detached a40ce9a로 갱신했다.
- 최신 PM에서도 승인된 runtime 소비는 Backend #99/AI #28이다. Google #101은 launcher 미조립이며 실제 모델/730일 projection·Web/운영 연결 완료가 아니다. Web에 오래된 main이 남아서 생긴 미연결과, 서비스 계약·조립·검증이 남은 상태를 구별한다.
- PM README/§16의 FE 미인계 표기는 기존 [Web #25 전달 댓글](https://github.com/beak1011/tesia-web/issues/25#issuecomment-5586633878)과 갱신 시차가 있다. FE가 PM 수신을 대신 승인하거나 PM writer 문서를 덮어쓰지 않으며 같은 이슈로 확인을 요청한다.
- **BF-078 / FIXED_LOCAL**: 403/409/412/5xx도 설정 오류로만 보이던 안내를 고정 카피로 구분했다. 429는 defensive projector이며 SDK 허용 응답을 확장한 것이 아니다. raw 서버 message/field/meta는 표시하지 않는다. 401에서 현재 요청이 미실행됐다는 부정확한 단정을 제거했다.
- **BF-079 / FIXED_LOCAL**: 로컬 복구 저장 실패를 API 설정 또는 세션 만료로 해석하지 않고 승인 재개 정보 저장 문제로 표시한다. 진단코드/세션 복구 flag(false)는 유지한다.
- **BF-080 / FIXED_LOCAL**: 실제 소비의 composer가 잠긴 중에도 메시지 수정으로 입력값을 바꿀 수 있던 불일치. optional editDisabled와 handler guard를 적용해 편집만 막고 복사는 유지한다. 공개 원본의 기본값은 false로 보존한다.
- **BF-081 / TEST_ISOLATION**: transport의 저장소 무기록 검사에서 홈 UI의 비동기 저장이 섞여 sessionStorage 길이가1이 되는 실패를 확인했다. 해당 검사만 같은 origin의 빈 문서로 재진입한 뒤 저장소를 비워 실행한다. 저장소0·CSRF 원문 비노출·동일 key/ETag 검사 자체는 유지한다. origin 거절 시험과 제품 코드/정책은 바꾸지 않는다.
- agy `gemini-3.8-flash-high`는6개 상태 문구를 제공 텍스트만 읽기 전용 검토했다. 권한/보안 거절 및 상태 충돌의 원인을 단정하는 제안은 더 넓은 고정 문구로 보정했다. impeccable harden 기준을 적용했으며 재디자인/새 이미지 생성은 하지 않았다.
- 영향 회귀 **86 PASS**, 26.6s (`/tmp/teth-followup-errors-focused.log`), lint/tsc 및 public/private build PASS. 최초 전체778개는743 PASS/34 SKIP/1 FAIL, 5.0m (`/tmp/teth-followup-full-ui.log`), 위 BF-081을 발견했다. 전체 beforeEach 격리를 시도한 중간 회귀는 unsafe-origin 모듈 import6 FAIL/96 PASS였으므로 그 확장을 되돌리고 저장소 검사1개에만 격리했다. 이후 adapter suite3회 **102 PASS**, 21.9s (`/tmp/teth-followup-adapter-isolation-final.log`). 전체 재회귀778개는 **744 PASS/34 SKIP/실패0**, 5.1m (`/tmp/teth-followup-full-ui-final.log`). 이 전체 실행에 포함된 issue 시험은18개 버전이며 이후 Opus 의견으로 보강한20개 시험은 별도로 모두 통과했다. 34 SKIP은 기존 프로젝트 조건부26+별도 actual8이며 미실행을 합격으로 세지 않는다. 후속 시험 변경 뒤 lint/tsc/diff-check도 PASS.
- 실제 서버 연결은 새 빌드의 READY 이후 workers1/별도4177에서 **8 PASS**, 1.4m (`/tmp/teth-followup-actual.log`). 익명 대화·검증·승인 차단·로그아웃, 설정 중 응답 지속, 완성/미완성 초안의 응답 유실 경계를 시험했다. 실제 외부 AI나 실제730일 백테스트 검증이 아니며 동시성 OPEN-005는 유지한다.
- 이전 owner root `/tmp/teth-client-service-review.pcMdma`를 정상 drain(cleanupConfirmed:true)한 뒤 새 `/tmp/teth-service-followup.0vAgWB`에서 승인된 동일 runtime과 새 Web dist를 실행했다. 이전 DB는 보존했다. 공개4176과 내부8789만 로컬 갱신하며 운영 배포가 아니다.
- Opus 첫 검수 호출은 도구 호출문만 반환해 유효 판정으로 사용하지 않았다. 같은 personal(1)/`claude-opus-5`에 관련3개 전체 파일과 도구 없는 텍스트 검수 요청으로 재실행했다. Critical/High0, 접근성 Medium1 및 테스트 보강2개 의견을 받았다. 테스트는 편집 버튼4개 존재 단언과 미매핑400/404/422의 대문자 서버 message 비노출 검사로 보강했고 **20 PASS**, 6.1s (`/tmp/teth-followup-issue-review.log`)를 확인했다. generated `ApiResponseError`는 원문 message가 아닌 검증된 error.code를 Error.message에 넣으므로 해당 원문 누출 가정은 반증됐다. 접근성 의견은 편집 버튼에 포커스를 둔 채 별도 승인 버튼을 키보드로 동시에 실행하는 동선이 재현되지 않았고, issue 자식은 controller에서 role=alert를 이미 제공한다. 이를 이유로 native disabled를 제거하거나 잠긴 composer로 포커스를 강제 이동하지 않았다. 모델의 전체 서비스 승인으로 표시하지 않는다.
- 별도 public4176/private8789 빌드 화면을390/1440px에서 열어 입력 가능 상태, 가로 넘침0·자산 HTTP 오류0·pageerror0을 확인했다. 최초 진입 애니메이션 중 캡처와 준비 완료 캡처를 구분했고 후자는 감소 모션으로 검수했다. `/tmp/teth-followup-ready-{public,internal}-{390,1440}.png`4개를 직접 확인했다. 실제 기기·모든 화면·원본 동적 인사말의 완전한 내부 연결 parity 판정은 아니다.
- 변경 소유: `src/internal-poc/{service-status.ts,ClientServiceExperience.tsx,client-service.css}`, `src/components/ClientConversation.tsx`, `tests/internal-poc/{service-issue.spec.ts,client-service.spec.ts,service-v03-http-adapter.spec.ts}`, `README.md`, `DESIGN.md`, 본 보고서의10개 경로. 서버/generated/거래 의미·운영 배포 변경0.
- 로그 SHA256: 전체 재회귀 `1b5a43725da293684b6c4d465c25446a20319f9c1d4972a157f034bc48c2b50c`, 실제8개 `5e3dbb8f4e8a06e7977c698a549fffcb4eb90aac02c76992a7d27036f3f092a2`, 검수 후20개 `b6a97a7786c038fb7692f37eaa9f69d8efe25059c54a87958bcc2eab8461ea03`. 로컬 일시 증거이며 보고서의 실행 요약과 구분한다.

- UI 전용 branch에서 `InternalPocPresentation` seam을 추가했다. 원본 로고/홈/ClientConversation/Activity/언어 패널을 사용하며 API·세션·승인은 기존 controller가 소유한다. 공개 entry/Mock store를 actual로 바꾸지 않았다.
- 내부 진입은 `/internal-poc.html#/client`. fragment는 서버에 전송하지 않는다. `?ui=client`는 실제 서버의 query 차단으로 404가 확인되어 채택하지 않았다.
- 내부 빌드만 `TETH_OWNER_LOCAL_SERVICE_URL=http://127.0.0.1:8789`로 명시 opt-in한다. missing/duplicate meta target은 build 실패. 미지정/dev는 비활성, visitor origin에서 자동 활성화하지 않는다.
- 서비스 source는 Backend #99 `36f74a3cbcb0c32e014a54a3f8f84ab0fefb80cc` / AI #28 `852762f0cc1227bbdae9fa54e635c42ee12765d4`, `RESEARCH_SUMMARY_OFFLINE`이다. 기존 설치 wheel을 재빌드/변조하지 않았다.
  Backend wheel `a30155897a4886eed3f8d07afc0708bac9e300c324686b6c76f1d87449daec86`, AI wheel `9241104520c145a7d2fd398eb2ee2823b0f8def2986d6c9e717aa25e3425bd99`, Contracts `e9a8a401e0c2437eb42a528730810b08a6a5dcca00744e10f2a9ddb09b155e5f`를 실제 해시 비교했다.
- launcher는 승인된 Infra #43 source `91f41c5b5bb1bef2ed7da5cf690932ce2f6474a6`와 byte-equal인 기존 extracted bundle을 소비했다. PG/API/worker는 기존 상태를 덮지 않은 새 owner root에서 실행했다.
- 실제 익명 session → conversation → 서버 질문 → 조건 추가 → VALID → 익명 승인 차단 → REVOKED logout → 새 session을 데스크톱/모바일에서 시험한다. 테스트 trace/video는 비활성, cookie/CSRF·원응답 헤더는 기록하지 않는다.

#### 추가 교정

| ID | 상태 | 문제·교정·근거 |
|---|---|---|
| BF-069 | FIXED_LOCAL | 내부 서버는 HTML/CSS가 참조한 자산만 제공한다. 동적 Client 청크·로고가 누락되어 화면이 열리지 않았다. private Vite build가 해당 entry의 정적/동적 의존성 closure와 CSS/image만 HTML에 명시한다. fixture 의존성은 거절하며 공개 build에 포함하지 않는다. 실행 중 dist 재빌드로 stale HTML 자산이 사라지는 운영 오류도 확인하여 이후 정상 drain→새 root로 검증했다. |
| BF-070 | FIXED_LOCAL / 서버 한계 별도 | create/turn 응답 유실 뒤 새 identity를 만들던 경로를 memory-only pending identity와 중복 전송 latch로 교정. 명시 재시도는 원래 body/key/If-Match를 유지한다. HTTP412는 새 key로 재제출하지 않고 기존 SDK GET으로 최신 초안만 조회한다. 원래 답변·사용자 요청 반영 여부는 확인됐다고 주장하지 않으며 메시지에 uncertain 표식. GET만으로 candidateState를 READY로 만들지 않는다. |
| BF-071 | FIXED_LOCAL | `새 흐름`이 busy/pending approval/진행 job의 재개 핸들을 지울 수 있었다(Claude H1). 해당 상태의 reset을 차단하고 원 pending snapshot이 남는 회귀 추가. pending approval 중 입력·빠른 답변·검증도 잠가 재개 대상이 바뀌지 않는다. 승인 전 대화의 확인 불가능한 응답은 안내 안의 `새 전략에서 다시 시작`으로 탈출 가능하며 서버 초안/작업은 삭제·취소하지 않는다. |
| BF-072 | FIXED_LOCAL | SSE transport의 redirect 기본 follow와 5xx 강제 status cast(Claude H2). manual redirect와 허용 error status 외 fail-closed로 교정. 현재 서버 UI는 SSE를 사용하지 않으며 이 변경은 SSE 연결 완료가 아니다. 일반 request header/body 대기에도 120초 상한을 둔다. |
| BF-073 | FIXED_LOCAL | IS/OOS 표시를 배열 위치로 결정하던 코드와 실패 상태를 QUEUED로 표시하던 진행 트랙(Claude M1/M2). 명시 segment로 조회하고 unknown/terminal state를 실행 대기 단계로 만들지 않는다. |
| BF-074 | FIXED_LOCAL | 새 presentation에서 세션 복구/초안 미이관 안내가 빠지던 문제(Claude M3), 요청 중 무효한 stop 버튼, 원본과 다른 외곽 패널 바탕. 기존 shell 안 복구 안내·중지 capability 분리·client token 범위 보강. 실제 입력은 native maxLength1000으로 요청 제한과 일치시킨다. 공개 Mock 컴포넌트 기본 동작은 유지. |
| BF-075 | FIXED_LOCAL | Opus 재검수의 sessionStorage 예외. 대화/GET 응답 성공과 로컬 저장 실패를 분리한다. 최초 승인 키 저장 실패는 요청0이며 pending으로 진입하지 않아 입력/새 흐름을 잠그지 않는다. 이미 진행된 승인에서는 재개 전과 challenge·approve 응답 후 retry key 저장 실패 시 다음 mutation을 중지하고 동일 in-memory pending을 보존한다. snapshot 삭제 실패는 reset/reload를 차단한다. 신규 storage 회귀10개 PASS. |
| BF-076 | FIXED_LOCAL | 승인 action 자체에 pendingWorkflow 가드를 추가하고 presentation의 onSend를 1인자 wrapper로 제한했다. 금액 반올림을 원값이라 표기하던 caption을 표시 정밀도 안내로 교정했으며 엔진 decimal/계약은 바꾸지 않았다. |
| BF-077 | FIXED_LOCAL | 부트의 partial-schema 오류 catch에도 현재 generation 검사를 넣었다. 이전 비동기 복원 결과가 새 상태/저장 경고를 바꾸지 않도록 형제 경로와 같은 가드를 적용했다. |

#### 실제 연결에서 확인한 미해결 경계

| ID | 판정 | 정확한 경계 |
|---|---|---|
| INTEGRATION-OPEN-001 | VERIFIED_CANDIDATE_NOT_PROMOTED | #102 replay를 포함한 #104 설치물의 독립8790 actual E2E에서 원응답 data/ETag 동일200을 검증했다. 현재 유지8789는 #99이며 새 runtime/live 자산 승격·PG 동일 검증은 별도다. 새 키로 재전송하지 않는다. |
| INTEGRATION-OPEN-002 | FIXED_LOCAL_CANDIDATE | Contracts #28 exact SDK rc2 소비 후 실제 partial GET/reload/응답 유실 초안 재확인 PASS. 위 sdk-draft-recovery 증거 참고. live private 자산 승격/PM 후속 수신은 별도이며 원래 AI 답변 복원은 OPEN001이다. |
| INTEGRATION-OPEN-003 | NOT_CONNECTED | 실제 외부 AI/Google·Apple·이메일/새 summary wire/실제730일 report·전문 차트·주문 연속 연결은 미완료. 현재 anonymous service는 승인/백테스트를 허용하지 않는다. 별도 local-autoauth 합성 시험을 서비스 로그인으로 승격하지 않는다. |
| INTEGRATION-OPEN-004 | PARTIAL_CONNECTION | 실제 서버 초안의 새로고침 복구는 rc2 후보에서 검증. 전체 대화 내역/목록·내부 소개·다운로드·전체 계정 설정은 미연결. 초안 복구를 전체 대화 재생이라고 표현하지 않는다. |
| INTEGRATION-OPEN-005 | RUNTIME_CONCURRENCY_UNVERIFIED | 단일 승인된 owner-local 서버에6개 Playwright worker가 동시 접속한 반복에서 실제 응답/세션 초기화가 UI 기대시간을 초과하고 일부 bootstrap 오류가 발생했다. 정확한 서버 원인은 미확정이다. API 로그 BrokenPipeError10/PG 오류0을 값·헤더 없이 집계했으며 브라우저 조기 종료의 결과일 수 있어 원인으로 단정하지 않는다. 단독 기능 검증을 동시성/대규모 서비스 합격으로 대체하지 않는다. timeout/보안 정책을 늘려 우회하지 않고 PM/Backend/Infra 인계 대상으로 남긴다. |
| INTEGRATION-OPEN-006 | DEFERRED_TRANSPORT | Opus의 SSE chunk 경계 CRLF·buffer 상한·reader cancel 지적은 이번 실제 UI가 소비하지 않는 SSE transport의 후속이다. v0.1 서버의 이벤트 미공급 경계와 함께 별도 검증이 필요하다. 부트 오류 중 세션 재확인 대상이 아닌 오류의 수동 retry UX도 후속이다. |
| INTEGRATION-OPEN-007 | RECOVERY_FOLLOWUP | 대화 생성→첫 turn 완료 전 reload의 pending identity는 아직 memory-only. 전체 대화/원응답 영속 복구는 별도 계약 소비가 필요하다. 저장된 job이404가 된 경우 부트 오류 대신 초안만 유지하는 복귀 UX도 후속이며 이번 partial Draft 합격으로 닫지 않는다. |
| INTEGRATION-OPEN-008 | FIXED_LOCAL_CANDIDATE | 결과 오류를 job/초안과 분리해 명시 재조회·신뢰 실패·부분 응답 지연·401 회귀를 통과했다. 원본 토큰의 inline 복구 UI를 사용한다. 실제730일 결과/차트 연결이나 익명 승인 권한을 새로 열지 않는다. |
| INTEGRATION-OPEN-009 | FIX_CANDIDATE / STRESS_RECHECK_PENDING | native RO 콜백 동기 DOM 변경221/283건을 계측해 단일 rAF resize로 제거(BF101). 수정 후28개 및 workspace 통합54/58개에서 경고0. 과거 간헐 경고 자체는 단독 red에서 재현되지 않았으므로 운영/전역 스트레스 해결 확정은 아니다. 경고를 무시하거나 pageerror 검사를 완화하지 않았다. |
| INTEGRATION-OPEN-010 | CONTRACT_COORDINATION_REQUIRED | 실제 가격 원천/검증 reader는 있으나 발행된 OHLC/LOD producer·체결 시각 계약은 없다. auth sessionId 대신 owner-scoped 대화→승인 전략→job 복구와 같은 source/result/segment 결속이 필요하다. private dirty runtime_v08_private_view나 FE read model을 계약으로 승격하지 않는다. 사용자 승인 후 Web #25로 PM/Contracts/Backend writer 예약을 요청했고 PM 댓글5596291474에서 수신/contract-first 후속 배정을 확인했다. 정확한 계약·producer handoff는 미수신이다. 현 디자인의 독립 캔들·60초 재생/Skip 렌더러는 DEV 전용 차트·원장·대화 workspace와 합성 테스트로 준비했지만 tfw-chart/실제 API에 아직 mount하지 않았다. 현재 상세·변경 증거는 이 문서의 professional-renderer-preparation 절이 소유한다. 실제730일 연결·제품 교체·공개 권리·운영 승격은 미완료다. |

#### 2단계 검수 이력

- 설계 검토: agy의 8개 상태 매핑 체크리스트를 테스트에 반영. Claude는 제공 코드만 읽기 전용으로 검수했으며 전체 서비스/운영 Go를 부여하지 않았다. 실제 UI screenshot을 모델이 검수했다고 주장하지 않는다.
- 첫 10개: fixture/public6 PASS, 실제4 FAIL(명시 meta 미설정). 다음10개 역시6 PASS/4 FAIL(READY 이전 기동 race·테스트의 route.fetch CSRF 거절·대화 단계 기대값 오류). 제품 성공으로 재해석하지 않는다.
- 영향132개:126 PASS/6 FAIL. 실제 HTTP412/부분 초안 contract 실패와 fixture의 정상 입력 거절 뒤 편집 잠금 회귀를 발견했다.
- 교정 후50개:48 PASS/2 FAIL. 미완성 초안 GET 복구 불가를 별도 계약 경계로 확인했다. 원래 "복구 성공" 기대값을 지우고 완성 초안 복구/미완성 fail-closed 시험으로 분리한다.
- 첫 전체748개: **722 PASS/26 SKIP/실패0**, 5.2m. `/tmp/teth-client-service-full.log`.
- 추가 배경 진행 시험 포함 전체750개: 722 PASS/26 SKIP/2 FAIL, 5.1m. `/tmp/teth-client-service-final-full.log`. 새 시험의 동일 이름 버튼 두 개 strict selector 위반이며 기대값을 없애지 않고 `.g-composer` 범위로 한정했다. 교정 후 해당 데스크톱·모바일2개 PASS, 12.9s. 설정을 연 상태에서 실제 응답이 도착하고 닫은 후 같은 대화를 계속할 수 있음을 검증한다. 3초 응답 지연은 시험 wrapper에만 있고 제품 타이머가 아니다.
- 전체 재회귀750개: 721 PASS/26 SKIP/3 FAIL, 5.2m. `/tmp/teth-client-service-release-full.log`. 실제 응답 지연2개/실제 응답 유실 시험 대기1개가 실패했다. 이후 UI 시험의3초 타이머를 없애고 실제 응답 수신과 모달 준비 완료를 각각 기다리는 시험 전용 delivery gate로 교정했다. 제품 지연을 추가하지 않았다.
- 실제 접속 포함42개를6 worker로3회 반복:36 PASS/6 FAIL, 2.7m. `/tmp/teth-client-service-deterministic.log`. 실패는 초기 세션 ready 진입 전 loading/error이며 단독 통과로 닫지 않는다(INTEGRATION-OPEN-005).
- 분리 검증: UI/계약756개 **722 PASS/34 SKIP/실패0**, 4.6m (`/tmp/teth-client-service-ui-storage-full.log`). 단독 실제 HTTP8개×3회 **24 PASS/실패0**, 4.4m (`/tmp/teth-client-service-serial-actual.log`, workers1/별도4177). 전체 UI의34 skip은 기존 프로젝트 전용26+별도 actual8개다. 이 결과는 마지막 storage 입력 잠금/부트 catch 교정 전의 중간 증거이며 최종 전체 회귀와 구분한다.
- storage 추가 시험10개 첫 실행6 PASS/4 FAIL: 기존 fixture replay audit는 유실 주입 때만 기록되므로 일반 성공 응답의 audit를 null로 읽던 시험 오류였다(`/tmp/teth-client-service-storage-boundaries.log`). fixture 서버 상태와 실제 저장 시도된 pending의 step/identity를 관측하도록 교정 후 **10 PASS**, 8.0s (`/tmp/teth-client-service-storage-boundaries-fixed.log`). 승인 전/승인 응답 후/제출 전 저장 장애를 각각 확인한다.
- Opus5/personal1 최종 코드 검토는 제공3파일에서 C0/H0, storage 한정 재검토도 C0/H0였으며 모델의 중간 저장 시험 보강·초기 승인 입력 잠금·stale catch 지적을 반영했다. `LOCAL_RECOVERY_STORAGE_UNAVAILABLE`은 현재 `service-status.ts`의 Error fallback에서 requiresSessionRecovery=false임을 직접 확인했다. 후속 SSE/legacy 부트 UX와 운영 Go는 별도다.
- 최종 private build 실제 HTTP 회귀: **8 PASS/실패0**, 1.7m (`/tmp/teth-client-service-final-actual.log`). 이번 실행에는 confirmed logout 때 로컬 snapshot 삭제 실패를 주입해도 세션 종료·안내·새 session이 이어지는 검증을 포함한다. 실제 PG/API/worker이며 external AI·OAuth·실데이터/주문 검증은 아니다.
- 최종760개 UI/계약 회귀: **726 PASS/34 SKIP/실패0**, 4.6m, exit0 (`/tmp/teth-client-service-final-ui.log`). 34 SKIP은 기존 프로젝트 전용26+별도 단독 실행한 actual8개이며 새 실패를 skip으로 바꾸지 않았다. 최종 실제8개 로그 SHA-256 `7b17cc06c579de231fc6ba48c8097b8375fcecafe83d0919dc913322bab4d83c`.
- 최종 UI/계약 전체 로그 SHA-256: `13d5e30f2b79f1a4d2c23f40c91a6157065f4a7dcb51b7827788f789ed1cea50`.
- 최종 lint/TypeScript/public·private build PASS. 최종 public build 로그 SHA-256 `ce32f000c218dac86df35eef8619c17db17c1ad9d950048f479a352c4d44de74`, private build `a33b2fd2c0f721dda8e2f28738d4fc41f492f043e9ee8e32bb4f8c8ea9d88dc0`. 단독 actual24개 로그 `a9c3af8e313062f7e63ac71236ad59f4fae353fb12864186c87b9ec7f00cbb5d`, storage10개 로그 `b3b0cf12d3e61def48b8385ac20be26424caab75c30ebf3107b4e12195724a5d`.
- 직접 브라우저 검수: 1440/390/320px에서 실제 대화→조건 확인→검증, pageerror0/자산 요청 실패0/가로 넘침0, 확인 체크 전 승인 버튼 disabled를 확인했다. `/tmp/teth-service-home-{width}.png`, `/tmp/teth-service-validation-{width}.png`. Chromium 검사이며 Safari/실제 모바일 기기 검증으로 확대하지 않는다.
- 중간 실패 로그: `/tmp/teth-client-service-e2e.log`, `teth-client-service-e2e-actual.log`, `teth-client-service-focused.log`, `teth-client-service-reconciled-tests.log`도 보존한다.
- 최종 source의 TypeScript/public Vite build·ESLint·`git diff --check` PASS. 실제 서버가 제공하는 internal dist는 별도 attested build이며 실행 중 덮어쓰지 않았다. 두 로컬 entry HTTP200 확인. 첫 전체 로그 SHA-256 `d56e5da9b390b55c77b3735060fe003da1dbfb0b5e8f9ee304c937fbbef56b3d`, 내부 build 로그 SHA-256 `ae6cf2a08cb558a8e79868382f49d7e26fabe56faacbc621e7aa7b52560531f8`.
- 현재 Git inventory123경로(기존 tracked 변경21/신규102), 예약 범위 밖 변경0. 최신 main/chart/backtest-data/funnel/reporting11파일 및 generated16파일은 base와 byte 동일. 자산을 제외한 변경 텍스트의 제한된 token/private-key 패턴 검사에서 발견0이며 정식 gitleaks/보안 Go로 주장하지 않는다.

2단계 추가/변경 경로: `src/components/{ClientConversation.tsx,ClientComposer.tsx}`, `src/internal-poc/{InternalPocApp.tsx,api-adapter.ts,main.tsx,fixture-main.tsx,ClientServiceBoundary.tsx,ClientServiceExperience.tsx,client-service.css}`, `vite.internal-poc.config.ts`, `tests/internal-poc/{client-service.spec.ts,local-strategy-vertical.spec.ts,build-boundary.spec.ts}`, `README.md`, `DESIGN.md`, 본 보고서.

#### 현재 Git·인계 범위

현재 통합 변경123경로를 `feat/web/ui-service-integration`에서 코드·문서·회귀 시험과 함께 관리한다. PM 인계 대상은 Web #25이며 exact 소비 SHA와 예약 파일, 위 INTEGRATION-OPEN-001~006을 전달한다. 기존 dirty 포크/4174와 PM writer의 문서는 건드리지 않는다. 기능 검수 PASS와 모델의 제한 검토는 사용자 디자인 승인·PM 수신 확인·다중 사용자 적합성·공개 서비스 Go를 뜻하지 않는다. main merge/운영 배포0.

검증한 코드 checkpoint는 `ca79e1bcbf2ebbcd80db706a4c444debe39ec361`이다. 이후 인계 문서 commit은 코드·테스트를 변경하지 않는다. 최초 stage 후 새 DESIGN 문서의 기존 Markdown 하드브레이크 공백7개가 diff checker에 잡혀 문구/줄바꿈 의미를 유지하는 `<br>`로 교정했다. 최종 검사는 untracked 제외 working diff가 아니라 base부터의 전체123경로에 대해 수행한다.

이하 BF-063~068과 113개 파일 목록은 **1단계 시점의 기록**이다. 아래의 "실API0/보호50파일 동일"은 그 단계의 증거이며 2단계의 현재 변경 범위를 뜻하지 않는다.

### 이식에서 발견한 문제

- **BF-063, P1, FIXED_LOCAL**: 구형 `SignalCanvas.tsx` 전체 복사 시 최신 차트를 잃는 충돌.
  원본 `ConversationCosmos`만 별도 컴포넌트로 추출하고 홈/정보 페이지의 두 import를 수정했다.
  첫 build에서 정보 페이지의 누락 import를 발견했고 수정 후 build/lint가 통과했다.
- **BF-064, P2, FIXED_LOCAL**: 테스트가 5173/4174에 고정되어 다른 작업본을 검증하거나 서버를 충돌시킬 위험.
  독립 포트와 `baseURL` 기반 legacy fixture, 테스트용 `TEST_ORIGIN`으로 분리했다.
  보안 기대값/실제 API origin 정책은 수정하지 않았다.
- **BF-065, P2, FIXED_LOCAL**: 원본 UI와 최신 퍼널을 같은 entry에서 정적으로 import하면
  불필요한 차트 코드와 CSS를 함께 소비할 위험. 초기 entry 분기로 분리하고 요청 경계 시험을 추가했다.
  실제 대화에서 다른 화면으로 넘어가는 단계는 추가하지 않았다.

### agy 의견의 확인 상태

- `client-main-experience.css` 누락 의심: 컴포넌트 내부 import가 있으므로 재현 근거 없음.
- Mock hash의 초기 분기: 직접 접근 전용 회귀 경로이며 제품 내 링크가 아니다. 실제 결과 연결과 혼동하지 않는다.
- hidden wrapper/하단 높이 충돌 의심: 공개 페이지 왕복·모바일 회귀·시각 비교에서 중복 노출이나 가로 넘침은 재현되지 않았다. 전체 화면의 무결함 판정은 아니다.

### 첫 전체 회귀 이후 수정과 증거

- **BF-066, P2, FIXED_LOCAL**: 계정 fixture가 Vite 비공개 optimizer의 `browserHash`를
  직접 읽어 React import URL을 만들었다. 현재 Vite가 제공한 모듈 hash와 달라 HTTP 504가
  재현됐고 양쪽 프로젝트의 5개씩, 총 10개 시험이 화면을 띄우지 못했다.
  정식 HTML/TSX fixture로 옮겨 Vite가 React import를 해결하도록 수정했다. 인증 기대값은 그대로다.
- **BF-067, P2, FIXED_LOCAL**: 동적 entry 이후 `page.goto`만으로 React 화면이 준비됐다고
  판단하던 helper가 숨겨진 모바일 버튼을 선택했다. 언어 패널 준비, 연구 화면 재진입,
  legacy fixture의 본문 준비를 명시적으로 기다린다. 지연 시간 추가/timeout 확대/skip 추가 없음.
  중간 시험에서 최신 dashboard의 본문 ID가 `#main`인 점과 context.newPage가
  page fixture를 상속하지 않는 점도 확인해 양쪽 본문 ID 대기·새 탭의 명시 DEV 진입으로 교정했다.
- **BF-068, P2, FIXED_LOCAL**: 모바일 홈에서 저장 실패 알림이 배너 아래 메뉴를 덮었다.
  알림을 해당 헤더 아래 132px로 배치하고 열린 사이드바보다 낮은 z-index를 적용했다.
  기존 저장 실패→정보 페이지 실패→대화 복귀 시험과 production preview에서 통과했다.
  모바일 메뉴 하단118px/알림 상단132px를 확인했고 실제 클릭으로 정보 페이지에 진입했다.
- 초기 동적 bundle 로딩/실패 시 흰 바탕이 먼저 보이지 않도록 HTML의 초기 배경만
  원본 중성색으로 맞췄다. 문구·홈 배치·대화 동선·차트 데이터는 바꾸지 않는다.
- 최신 차트/서비스/보고서 등 보호 대상 **50파일 byte 동일**, 변경0.
  경로+bytes SHA-256: `373f57c8adf8a2ac24d1abd5e6832bd0057415a2e166187fc5f1616b88a5fce4`.
- 원본 4174와 통합 production preview 4176: 동일 랜덤 문구/시각을 고정했을 때
  1440·768·390px의 제목/별 배경/사이드바 rect·폰트·위치 속성이 동일했다.
  양쪽 가로 overflow0/브라우저 오류0. 390px 캡처는 PNG SHA-256까지 동일했다.
  이 측정은 선택된 홈 요소의 비교이며 사이트 전체 pixel parity 주장이 아니다.
- 1440·390px production preview에서 대화→Research Plan→연구→Critic 발견을 직접 실행했다.
  Activity/Artifacts 및 `저변동성 구간 과잉 거래` 샘플 표시를 확인했고 오류0/비GET전송0/가로넘침0이었다.
  실제 모델/백테스트 연결의 증거가 아니다.
- 로컬 증거 디렉터리: `/tmp/teth-ui-integration.ZmgQPN/`.
  `full-e2e.log`는 첫 실패 원본, `focused-e2e.log`는 수정 후 영향 회귀,
  `visual-comparison.jsonl`, `production-journey.jsonl`, 캡처는 직접 검수 근거다.

### 통합 검증 실행 이력과 남은 경계

| 실행 | 결과 | 범위/판정 |
|---|---|---|
| 첫 전체 | 690 PASS / 26 SKIP / 20 FAIL, 7.2m | 실패 원본 `full-e2e.log` 유지. 성공으로 요약하지 않음 |
| 수정 후 영향 136개 | 108 PASS / 24 SKIP / 3 FAIL / 1 INTERRUPTED, 3.4m | 잘못된 legacy 본문 대기 조건을 확인하고 종료(exit130). 완주/통과로 표시하지 않음 |
| 딥링크·새 탭 교정 | 2/2 PASS, 11.5s | 기존 기대값 유지. `deeplink-e2e.log` |
| 최종 전체 736개 | **710 PASS / 26 SKIP / 실패0, 4.6m, exit0** | 최신 main의 reporting/공개·내부 build 경계/서비스 adapter/browser bootstrap + 현행 Client UI + 최신 dashboard. 제외된 구형 6 suite는 별도 보존 |
| 최종 TypeScript/Vite·lint | PASS | `build.log`, `lint.log`, `git diff --check` 통과 |
| production 진입/복구 | PASS | DEV 파라미터 무시, 초기 bundle 실패→명시 재시도 복구, 모바일 저장 경고 중 메뉴 클릭. 실제 API 호출0 |

최종 전체 로그 SHA-256:
`657dd8e80a3132b6466a00dedb32944962c7b3390366562c71983ac46b9dc910`.
원래 작업본의 이식 입력79파일 hash 변경0, 최신 보호50파일 변경0,
기존 package-lock 의존성 변경0(원본 폰트2 추가만)이다.

이번 단계는 **원본 UI와 최신 기술 코드의 공존**까지만 검증했다.
대화/계정/연구/차트의 실제 API 연결, 공개 배포, 거래 권한, PM 원격 수신,
모든 원본 화면의 완전 일치는 완료가 아니다. 로컬 수정은 미커밋이며 push/merge/운영 승격0이다.
다음 단계는 PM §16과 FE #25의 실제 소비 surface를 결속한 뒤 대화/세션부터 연결하는 것이다.
v0.1 실행 계약과 v0.3 transport를 동일한 wire로 간주하거나 존재하지 않는 SSE/요약 필드를 만들지 않는다.


### 이번 통합 변경 파일 (113개)

아래는 통합 worktree의 Git 변경/추가 경로다. 이전 포크의 §7 목록과 구분한다.

- `Bugfix_report.md`
- `DESIGN.md`
- `README.md`
- `index.html`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `public/apple-touch-icon.png`
- `public/client-shots/about-backtest.webp`
- `public/client-shots/about-connect.webp`
- `public/client-shots/about-live.webp`
- `public/client-shots/about-plan.webp`
- `public/client-shots/about-report.webp`
- `public/client-shots/about-talk.webp`
- `public/client-shots/dl-chat.webp`
- `public/client-shots/dl-live.webp`
- `public/client-shots/dl-report.webp`
- `public/favicon.png`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/site.webmanifest`
- `public/teth-logo.png`
- `src/client-account-ui.css`
- `src/client-bootstrap.tsx`
- `src/client-conversation.css`
- `src/client-delegation-fixtures.ts`
- `src/client-delegation.css`
- `src/client-entry.ts`
- `src/client-experience-store.ts`
- `src/client-integration.css`
- `src/client-load-recovery.css`
- `src/client-main-experience.css`
- `src/client-percentage-input.ts`
- `src/client-preferences.css`
- `src/client-preferences.ts`
- `src/client-public-copy.json`
- `src/client-public-pages.css`
- `src/client-reference-copy.json`
- `src/client-reference.css`
- `src/client-research-activity.css`
- `src/client-research-cache.ts`
- `src/client-research-document.css`
- `src/client-research-fixtures.ts`
- `src/client-research-hub.css`
- `src/client-restored-research.css`
- `src/client-workspace.css`
- `src/components/ClientAccountUI.tsx`
- `src/components/ClientChrome.tsx`
- `src/components/ClientComposer.tsx`
- `src/components/ClientConversation.tsx`
- `src/components/ClientDelegationWorkspace.tsx`
- `src/components/ClientIcon.tsx`
- `src/components/ClientLoadBoundary.tsx`
- `src/components/ClientLocalePanel.tsx`
- `src/components/ClientMainExperience.tsx`
- `src/components/ClientPublicPages.tsx`
- `src/components/ClientResearchActivity.tsx`
- `src/components/ClientResearchChart.tsx`
- `src/components/ClientResearchDocument.tsx`
- `src/components/ClientResearchHub.tsx`
- `src/components/ClientResearchLog.tsx`
- `src/components/ClientResearchPreviewTools.tsx`
- `src/components/ClientResearchWorkspace.tsx`
- `src/components/ConversationCosmos.tsx`
- `src/components/DownloadPreview.tsx`
- `src/components/InternalLink.tsx`
- `src/components/SiteRouter.tsx`
- `src/conversation-shell.css`
- `src/mock-research-preview.ts`
- `src/research-library.ts`
- `src/research-view-model.ts`
- `src/site-navigation.ts`
- `src/use-client-placeholder.ts`
- `tests/client-account-ui.spec.ts`
- `tests/client-audit-fixes.spec.ts`
- `tests/client-backdrop-focus.spec.ts`
- `tests/client-background-progress.spec.ts`
- `tests/client-cross-surface.spec.ts`
- `tests/client-delegation-boundaries.spec.ts`
- `tests/client-delegation.spec.ts`
- `tests/client-failure-recovery.spec.ts`
- `tests/client-integration-entry.spec.ts`
- `tests/client-main-experience.spec.ts`
- `tests/client-navigation-input.spec.ts`
- `tests/client-preference-recovery.spec.ts`
- `tests/client-preferences.spec.ts`
- `tests/client-public-locales.spec.ts`
- `tests/client-public-pages.spec.ts`
- `tests/client-research-storage.spec.ts`
- `tests/client-restored-research.spec.ts`
- `tests/client-review-cycles.spec.ts`
- `tests/client-review-hardening.spec.ts`
- `tests/client-sidebar-alignment.spec.ts`
- `tests/client-state-boundaries.spec.ts`
- `tests/client-ui-continuity.spec.ts`
- `tests/client-user-journeys.spec.ts`
- `tests/client-visual-detail.spec.ts`
- `tests/dashboard.spec.ts`
- `tests/download-preview.spec.ts`
- `tests/fixtures/client-account-ui.html`
- `tests/fixtures/client-account-ui.tsx`
- `tests/fixtures/research-activity.html`
- `tests/fixtures/research-activity.tsx`
- `tests/fixtures/research-document.html`
- `tests/fixtures/research-document.tsx`
- `tests/internal-poc/browser-session-bootstrap.spec.ts`
- `tests/internal-poc/local-paper-session.spec.ts`
- `tests/internal-poc/local-strategy-vertical.spec.ts`
- `tests/legacy-fixture.ts`
- `tests/mock-report-integration.spec.ts`
- `tests/mock-strategy-flow.spec.ts`
- `tests/research-activity.spec.ts`
- `tests/test-origin.ts`

## 1. 문서 역할과 현재 판정

이 파일은 이 프론트 포크의 버그·이슈·수정·검증 이력을 계속 갱신하는 단일 정본이다. 날짜나 버전을 붙인 사본을 만들지 않는다. 제품/거래 계약은 [program 정본](../tesia-program/PM/TESIA_AI_POC_Product_Implementation_Plan.md), 원본 디자인·60개 이식 대조 항목은 [DESIGN.md](DESIGN.md) §18/19/21을 따른다.

- 기준일: 2026-09-08. 대상: `tesia-web` 현재 checkout과 이 작업이 갱신한 program PM 인계 문서.
- 코드 기준: `agent/web/teth-mock-ui-promotion-20260827`, HEAD `53badf6`. 원본 UI 고정 SHA: `acccc7f802ac34333d666431b994717a0507e6c3`.
- 판정: **local in_review**. 버그 0건·원본 전수 일치·실제 API 연결·운영 배포 완료 판정이 아니다.
- 이번 기록 이전 전체 회귀: **476개 중 456 passed / 20 skipped**. 신규 검수 결과는 §6에서 구분한다. 프로젝트/반복 실행 수를 서로 다른 버그 수로 계산하지 않는다.
- 최신 전체 재실행: **486개 중 466 passed / 20 skipped (3.7m)**. 직전 전체 실행의1실패는 숨기지 않고 §6과 OPEN-001에 유지한다.
- 기록 근거: Git 이력/현재 변경 파일, DESIGN의 누적 검수 기록, 테스트 코드와 실행 결과. 대화에서 요청했지만 현재 checkout에 구현/검증 근거가 없는 내용은 완료로 기재하지 않는다.
- `FIXED_LOCAL`: 재현·교정·로컬 회귀 근거가 있는 수정. `OPEN`: 원인/해결 미확정. `PENDING_INTEGRATION`: 별도 계약/통합 필요. `UNVERIFIED`: 이번 환경에서 확인하지 못함. 어느 상태도 운영 승격을 뜻하지 않는다.
- P1은 작업/초안 손실 또는 사용 불가, P2는 잘못된 UI 상태·입력·접근성, P3는 시각/안내 결함이다. **프론트 영향도 분류이며 거래 시스템 보안 등급이 아니다.**

## 2. 누적 버그 색인

아래 ID는 유지한다. 같은 원인의 재발·재검증은 기존 ID에 추가하고 새로운 재현 조건/독립 원인은 새 ID로 기록한다. BF-001~060은 기존 누적 기록을 통합한 항목이며 상세 실패→수정→검증 수치·수정 중 드러난 문제는 §8에 보존했다. 수정 파일은 §7 및 해당 테스트가 소비하는 컴포넌트에서 추적한다.

| ID | 영향 | 증상·재현 조건 | 원인 및 적용한 교정 | 회귀 근거 (`tests/`) | 상태 |
|---|---|---|---|---|---|
| BF-001 | P1 | 제공 Git/웹과 홈·대화·설정·연구가 서로 다른 UI | 부분 퍼널 이관이 원인. 원본 중심 React 진입/문서/상태 복원, 원본 Git와 공개 HTML 동일성 확인. 전체 계승 잔여는 별도 추적 | client-main-experience, client-restored-research | FIXED_LOCAL / 범위 제한 |
| BF-002 | P2 | Activity finding과 Critic 문서가 같은 내용으로 표시 | 별도 gDocCritic의 Builder 주장→반박→데이터/Verdict 복원, 시점별 v1/v2 분리 | research-parity, research-document, client-restored-research | FIXED_LOCAL |
| BF-003 | P2 | 설정 언어/통화·검색·선택, 타이핑/삭제 placeholder 누락 | 원본 7언어/37통화 및 검색·단일 선택·저장·반응형 패널, 입력 placeholder 주기 복원 | client-preferences, client-main-experience | FIXED_LOCAL |
| BF-004 | P2 | 정보/다운로드/정책이 내부 화면 대신 외부 Git 링크 | 내부 React 경로·정책 5탭·FAQ·다운로드 화면 계승 | client-public-pages, client-public-locales, download-preview | FIXED_LOCAL |
| BF-005 | P2 | 세션 왕복 시 읽던 대화/문서 위치 초기화 | 세션별 viewport 보존·250ms 저장/pagehide flush, 사용자가 읽는 중 자동 스크롤 억제 | client-ui-continuity | FIXED_LOCAL |
| BF-006 | P2 | 제목 길이/편집 동작 불일치, 수동 제목 덮어쓰기 | 편집 제한·Enter/Escape/포커스 정합성 및 수동 제목 구별 | client-ui-continuity, client-audit-fixes | FIXED_LOCAL |
| BF-007 | P2 | 메뉴/문서 탭 키보드 이동 및 복귀 누락 | 원본 동선을 보존하며 메뉴 키 처리·보이는 포커스 복구 | client-ui-continuity | FIXED_LOCAL |
| BF-008 | P2 | 320–860px 연구 헤더 메뉴와 뒤로가기 클릭 영역 겹침 | 헤더 그리드/클릭 영역 및 반응형 간격 교정 | client-ui-continuity, responsive-readability | FIXED_LOCAL |
| BF-009 | P2 | 낮은 화면에서 설정/긴 입력·문서 본문 잘림 | 높이 제한·스크롤·입력 크기와 브라우저 위치 복원 보정 | client-ui-continuity, responsive-readability | FIXED_LOCAL |
| BF-010 | P3 | 사이드바 안내 SVG와 로그인 문장 기준선 어긋남 | 공통 44px 버튼 규칙이 인라인 링크를 확대. 인라인만 예외, 독립 버튼 크기 유지 | client-sidebar-alignment | FIXED_LOCAL |
| BF-011 | P3 | 접힌 레일 중심축·긴 프로필·모바일 하단 배치 불안정 | 2px 축/말줄임/공개 링크 배치 교정. 펼친 계정/설정 순서 교환은 사용자 요청 개선 | client-sidebar-alignment | FIXED_LOCAL |
| BF-012 | P3 | 숫자 옆 한글 fallback과 Activity 체크 아이콘 정렬 불일치 | 폰트 계층 및 아이콘 기준선 보완 | client-visual-detail | FIXED_LOCAL |
| BF-013 | P2 | 비활성 탭·문서 설명·표 머리글/상태 시인성 부족 | 필수 텍스트 대비와 원본 계층 유지 | client-visual-detail, responsive-readability | FIXED_LOCAL |
| BF-014 | P3 | 좁은 문서에서 SVG 글자/수치가 축소되어 읽기 어려움 | 너비 전용 ResizeObserver 기반 SVG 좌표·표시 크기 보정 | client-visual-detail | FIXED_LOCAL |
| BF-015 | P2 | 390×280 긴 composer가 연구 본문을 모두 가림 | 입력/본문 높이 배분 수정, 검수 조건에서 본문 57.86px 확보 | client-visual-detail | FIXED_LOCAL |
| BF-016 | P2 | 태블릿 위임 헤더 겹침·작은 입력 글자 | 601–860px 헤더 배치와 16px 입력 크기 교정 | client-visual-detail | FIXED_LOCAL |
| BF-017 | P3 | 소개 페이지 스크롤 진입 시 투명 고정 헤더와 본문 겹침 | 초기 스크롤 상태부터 헤더 배경 반영 | client-visual-detail | FIXED_LOCAL |
| BF-018 | P1 | 다른 화면/숨긴 탭/새로고침에서 연구·응답이 중지됨 | 화면 이탈과 명시 중지 분리. 로컬 시작 시각/캐시로 복귀 상태 동기화, 가려진 렌더만 쉼 | client-background-progress | FIXED_LOCAL |
| BF-019 | P2 | 일반 연구 화면에 재생/계속 재생 조작 노출 | 원본 제품 상태 유지, fixture 조작은 DEV 명시 query로 격리 | client-background-progress | FIXED_LOCAL |
| BF-020 | P2 | 위임 단계 timeout 누적·연구 기록 완료 상태 지연 | 경과 시간 기준 단계/기록 완료 반영, 완료 전환 즉시 저장 | client-background-progress | FIXED_LOCAL |
| BF-021 | P2 | 웹폰트 준비 후 읽기 위치가 짧아진 scroll 범위로 덮임 | 폰트 준비 후 목표 위치 복원, 임시 clamp 저장 방지, 사용자 입력 시 보정 취소 | client-background-progress | FIXED_LOCAL |
| BF-022 | P1 | 저장 세션 하나 손상 시 정상 대화까지 사라짐 | 세션별 독립 검증·정상 기록 복구·손상 안내 | client-audit-fixes | FIXED_LOCAL |
| BF-023 | P2 | 연구 차트 포인터가 실제 봉과 약45px 어긋남 | 균등 인덱스 대신 실제 SVG 봉 좌표의 최근접점 사용 | client-audit-fixes | FIXED_LOCAL |
| BF-024 | P2 | 차트 키보드 조회 불가·조회 상태 불일치 | 방향키/Home/End, 마지막 입력 위치 복원 및 Holdout/포지션 표시 정합성 | client-audit-fixes | FIXED_LOCAL |
| BF-025 | P2 | 전략 조건 확정 후에도 자동 제목이 이전 분기에 남음 | 확정 조건 기반 자동 제목, 수동 제목 보존 | client-audit-fixes | FIXED_LOCAL |
| BF-026 | P2 | 숨긴 탭에서 인증 코드 재전송 대기가 늦어짐 | tick 횟수 대신 Date.now 마감 시각, 복귀 시 재계산 | client-audit-fixes | FIXED_LOCAL |
| BF-027 | P1 | 공개 페이지 왕복 후 로그인/언어 포털과 inert 잠금 잔류 | 경로 전환에서 일시적 포털만 해제, 대화는 유지 | client-audit-fixes | FIXED_LOCAL |
| BF-028 | P1 | 확장 composer native dialog가 로그인/공개 페이지를 가림 | 인증 handoff 전에 native dialog 닫기, 경로 cleanup, composer 복귀 포커스 | client-review-hardening | FIXED_LOCAL |
| BF-029 | P2 | 초장문 숫자가 Infinity여도 손절 수정 성공 표시 | 유한 값 검사·인라인 오류/aria 연결, 원래 값과 초안 보존 | client-review-hardening | FIXED_LOCAL |
| BF-030 | P2 | 빈 수정 적용/취소가 초안을 잘못 비움 | 빈 적용 비활성, 취소/접힘 보존, 성공한 초안만 정리 | client-review-hardening | FIXED_LOCAL |
| BF-031 | P2 | 캐시 복원 후 생성 전 문서·중복 탭 또는 선택 탭 0개 | 생성 시점/허용 문서 필터, 중복 제거·최대5개·활성 탭/Plan 보장 | client-review-hardening | FIXED_LOCAL |
| BF-032 | P1 | 드로어에서 공개 경로 왕복 후 body 스크롤 잠금 잔류 | 경로 cleanup 및 화면 너비 변경 후 보이는 trigger로 복귀 | client-navigation-input | FIXED_LOCAL |
| BF-033 | P2 | `3%에서2%`, `1,000%`, `2..5%`를 부분 수치로 적용 | 전체 퍼센트 문법·유한 값·모호성 검사, 전각 입력 지원, 잘못된 초안 보존 | client-navigation-input | FIXED_LOCAL |
| BF-034 | P2 | 대화의 12%→2%, 18%→8%, 부정문이 추천 선택으로 오인 | 숫자 경계·부정 의도 검사, 원본 선택지 임의 자동 적용 방지 | client-navigation-input | FIXED_LOCAL |
| BF-035 | P2 | 설정 하위 메뉴에서 숨긴 grab/다른 열로 포커스 이동 | 보이는 control 필터·명시적 진입/복귀 대상·640px 변경 대응, hover는 focus를 빼앗지 않음 | client-state-boundaries | FIXED_LOCAL |
| BF-036 | P1 | 행 코멘트 전송이 별도 하단 질문 초안도 비움 | 독립 입력의 상태·정리 시점 분리 | client-state-boundaries | FIXED_LOCAL |
| BF-037 | P1 | 손상 turn 하나 때문에 정상 turn/대화 전체가 탈락 | 세션 헤더와 turn별 검증 분리, 정상 기록 보존 | client-state-boundaries | FIXED_LOCAL |
| BF-038 | P1 | 저장 running/완료 불일치 또는 빈 응답 때문에 전송 고착 | 최신 유효 완료만 인정, 오래된/빈 running 해소. 없는 응답을 만들어 완료하지 않음 | client-state-boundaries | FIXED_LOCAL |
| BF-039 | P3 | 320px 행 수정 버튼 outline이 옆 라벨에 겹침 | inset outline과 최소 간격 보정 | client-state-boundaries | FIXED_LOCAL |
| BF-040 | P1 | 저장 쓰기 실패 중 연구→대화→연구 왕복 시 수정/초안 손실 | 허용 UI 필드의 같은 페이지 메모리 캐시·실패 안내·복구/세션 삭제 정리 | client-research-storage | FIXED_LOCAL |
| BF-041 | P1 | 정상 저장 상태에서도 문서 탭 이동 시 행별 코멘트 소실 | 문서ID/행별 초안 독립 보관 | client-research-storage | FIXED_LOCAL |
| BF-042 | P1 | 언어 저장 실패 뒤 통화 저장 성공이 이전 실패를 숨기고 패널 닫음 | 필드별 pending·재시도·모두 저장 후 닫기, storage 이벤트는 미저장 선택 덮지 않음 | client-preference-recovery | FIXED_LOCAL |
| BF-043 | P1 | 위임 UID 가이드 native dialog가 공개 경로에 남아 조작 차단 | 경로 변경 시 native 종료·재개방/Escape 복귀 보장 | client-delegation-boundaries | FIXED_LOCAL |
| BF-044 | P1 | 저장 실패 중 위임 질문 답변이 화면 왕복 후 사라짐 | 허용 UI 필드 메모리 보관·실패 안내/삭제 정리, credential은 제외 | client-delegation-boundaries | FIXED_LOCAL |
| BF-045 | P3 | 위임 저장 실패 안내가 모바일 고정 메뉴에 겹침 | 860px 이하 안내가 있을 때만 상단 공간 확보 | client-delegation-boundaries | FIXED_LOCAL |
| BF-046 | P2 | 복사 성공 후 다음 실패에도 성공 체크 잔류 | 실패 시 이전 성공 상태 초기화 | client-review-cycles | FIXED_LOCAL |
| BF-047 | P2 | 저장 오류 안내 닫기→회복→다시 실패 시 안내 누락 | 회복 시 dismissed 상태 초기화, 다음 오류는 독립 안내 | client-review-cycles | FIXED_LOCAL |
| BF-048 | P2 | 통화 검색 중 모바일 전환 시 언어 탭이 열림 | 검색 포커스 열과 활성 탭 동기화 | client-review-cycles | FIXED_LOCAL |
| BF-049 | P3 | 주/월 차트 선택에도 설명이 일봉으로 고정 | 선택 주기별 설명 일치. 실제 캘린더 집계 구현으로 간주하지 않음 | client-review-cycles | FIXED_LOCAL |
| BF-050 | P2 | 대화 메뉴가 공개 경로에도 남거나 메뉴 밖 Home/End를 가로챔 | 경로 전환 닫기 및 이벤트 target이 메뉴 내부인지 확인 | client-cross-surface | FIXED_LOCAL |
| BF-051 | P1 | 정보/다운로드 공유 언어 포털이 경로/hash 이동 후에도 잔류 | 경로/hash 변경에서 임시 포털 종료·잠금 복구 | client-cross-surface | FIXED_LOCAL |
| BF-052 | P2 | 오래된 복사 실패 응답이 최신 복사 성공을 덮어씀 | 질문/응답 양쪽 attempt token으로 최신 요청만 반영 | client-cross-surface | FIXED_LOCAL |
| BF-053 | P2 | UID/API 확인 중 필드를 바꾸면 옛 값 검증과 새 표시 불일치 | pending 입력 readOnly/aria-busy, 실패 후 편집·취소 후 늦은 완료 무시 | client-cross-surface | FIXED_LOCAL |
| BF-054 | P2 | Artifacts가 경로 이동 후 전역 Escape를 처리·축소 시 body로 포커스 소실 | 경로 cleanup·마지막 focus와 보이는 trigger/document 복귀 | client-cross-surface | FIXED_LOCAL |
| BF-055 | P1 | 공개 페이지 청크 실패로 대화 트리까지 사라지고 메모리 초안 손실 | 선택적 경계만 ErrorBoundary, 열린 대화 유지·돌아가기/명시 새로고침 | client-failure-recovery | FIXED_LOCAL |
| BF-056 | P1 | 도움말 청크 지연/실패 때 fallback이 없어 inert에서 탈출 불가 | 취소 가능한 loading/error dialog·Tab/Escape·배경 닫기·복귀 | client-failure-recovery | FIXED_LOCAL |
| BF-057 | P2 | 한글 조합 취소 Escape가 로그인/언어/제목/행 편집을 닫음 | isComposing 동안 전역/React Escape 핸들러 무시, 일반 Escape 유지 | client-failure-recovery | FIXED_LOCAL |
| BF-058 | P2 | 새 오류 패널 제목 role=status가 heading 역할을 제거 | status는 별도 wrapper, 제목 heading 유지 | client-failure-recovery | FIXED_LOCAL |
| BF-059 | P2 | 새 도움말 오류 배경 닫기 누락 및 클릭 뒤 포커스 body로 소실 | 배경 일치 조건에서 preventDefault/닫기, body 제외한 보이는 복귀 대상 | client-failure-recovery | FIXED_LOCAL |
| BF-060 | P2 | 느린 공개/도움말 로드 도중 복귀 후 늦은 결과가 사용자 흐름에 간섭할 위험 | 취소/복귀 경계, 초안·포커스·늦은 완료 비간섭 회귀 추가 | client-failure-recovery | FIXED_LOCAL / 예방 회귀 |
| BF-061 | P2 | 로그인·설정·프로필·피드백을 배경 클릭으로 닫으면 포커스가 body에 남음 | 배경 mousedown 기본 focus reset과 cleanup 복귀 충돌. 배경 일치 분기에서만 preventDefault 후 닫기 | client-backdrop-focus | FIXED_LOCAL |
| BF-062 | P2 | 개발 React에서 로그인 X/Escape 종료도 진입 버튼 대신 설정으로 복귀 | StrictMode effect 재실행이 이미 포커스된 내부 입력을 이전 대상으로 재기억. mount 단위 origin ref로 최초 진입점 유지, 숨긴 대상 fallback은 유지 | client-backdrop-focus | FIXED_LOCAL |

테스트 이름은 위 표의 basename에 `.spec.ts`를 붙인다. 상태 보존 구현은 `client-experience-store.ts`, `client-research-cache.ts`, `client-preferences.ts`, `client-percentage-input.ts` 및 해당 React 컴포넌트에 분산되어 있으며 §7은 파일 단위 전체 목록이다.

## 3. 기능 복원·구조 변경 (버그 수와 분리)

| 변경 | 현재 구현/범위 | 추적 근거 |
|---|---|---|
| 클라이언트 원본 진입·로고·파비콘·문구·배경 | ClientMainExperience/Chrome/Composer 중심, 원본 자산·복사본 JSON 사용. 옛 퍼널 DEV-only | DESIGN §18, index/manifest/public 자산, client-main-experience |
| 대화 세션/문서 | 초안·제목·삭제·기록, Plan→Activity→13종 문서와 원본 95초 사례. gDoc와 tf는 별도 | client-conversation/restored-research, research-* |
| 설정/계정/피드백 | 7언어/37통화 검색, 원본 로그인/가입/프로필/피드백 흐름의 로컬 UI | client-account-ui/preferences/public-locales |
| 연구 기록·예약 검증·랭킹·공유 | 원본 레이아웃·문구·상태 및 세션 연계. 서버 등록/공유 완료 아님 | ClientResearchHub/Log, research-library, client-user-journeys |
| 위임/실행 준비 | tf 계약·검증·보고·UID/API/내 트레이딩의 UI. 실제 거래 권한 없음 | ClientDelegationWorkspace, client-delegation* |
| 내부 공개 페이지·모바일 데모 | about/download/policies, 5탭 정책·FAQ·7언어 카피, 3장 디바이스 화면/상태바·카메라 | ClientPublicPages, DownloadPreview, public/client-shots |
| 사이드바 계정/설정 위치 | 펼친 하단 계정 왼쪽·설정 오른쪽, 접힌 레일 유지, DOM/Tab 순서 일치 | client-sidebar-alignment |
| 원본 데이터/카피 추출 스크립트 | 재현 가능한 자산 추출 보조 도구. 실제 전략 생성기가 아님 | scripts 전체 목록은 §7 |
| 기존 차트/백테스트·서비스 연동 작업 보존 | 다른 worktree/branch의 작업을 삭제·합치지 않음. 현재 원본 React에 통합 완료라고 주장하지 않음 | §4, §7 별도 worktree 목록 |

## 4. 미해결 이슈·확인하지 못한 범위

| ID | 상태 | 내용·영향 | 닫기 조건 |
|---|---|---|---|
| OPEN-001 | OPEN / P2 | 구형 추천 전환 간헐 오류. 과거 `세 추천 수정안은 카드에 약속한 서로 다른 결과를 재현한다`에 이어 이번 `전체 퍼널은 화면별 레이아웃·터치·Canvas 경계를 지킨다` desktop에서도 ATR 대기 timeout. 추천 비교 click 완료 후에도 view-result 잔류 확인 | 재현 trace의 근본 원인 교정 + 같은 조건 반복. 과거 단독3/5회·이번 단독5회 및 전체 재통과만으로 닫지 않음 |
| OPEN-002 | PENDING_INTEGRATION | 현재 원본 React 대화/연구/순위/계정은 로컬 fixture. 실제 승인 conversation/job/artifact/인증 계약 소비 완료 아님 | 정본 §16 단계3~6의 실제 요청/실패/중지/재접속/revision 증거 및 별도 Gate |
| OPEN-003 | PENDING_INTEGRATION | 보존된 전문 차트·실제 백테스트 재생·BUY/SELL/거래목록/PnL·우측 대화/하단 분석이 이 checkout에 통합 완료되지 않음 | 동일 run/trade ID·수치 정합성과 성능, Skip이 재생만 넘기는 실제 결과 회귀 |
| OPEN-004 | UNVERIFIED | iPhone13 프로젝트는 Chromium emulation이며 iOS Safari 실기기 아님. 전 언어×확대×기기 조합과 OS IME 실입력 전수 검증 미완료 | 실제 기기/입력기/확대 조합의 별도 증거. isComposing dispatch 통과를 실입력기 합격으로 쓰지 않음 |
| OPEN-005 | OPEN / 정책 결정 대기 | 원본 첫 전송 인증과 제품 비로그인 대화의 인증 시점 차이 | Product/PM 확정 후 계약·acceptance 선행 갱신. UI 복원으로 임의 결정 금지 |
| OPEN-006 | PENDING_INTEGRATION / 범위 제한 | 저장 불가 중 메모리 초안은 동일 페이지 왕복만 보장. 새로고침/탭 종료/다른 기기 지속 보존 아님 | 서버 저장/동기화 계약 및 장애/충돌 테스트 승인 |
| OPEN-007 | UNVERIFIED | DESIGN의 원본 hash·모션·화면별 미이식/미연결 항목 잔여 | DESIGN §18의 항목별 동일 상태 캡처/동작 증거. 테스트 합계로 일괄 완료 처리 금지 |
| OPEN-008 | OPEN / 미승격 | 현재 fork 변경은 미커밋 로컬 작업. 다른 브랜치/운영의 상태와 혼동 가능 | 선택 파일 검토→사용자 승인된 commit/PR/CI→별도 승격·SPA fallback/rollback smoke |
| OPEN-009 | UNVERIFIED / 근거 범위 제한 | 대화 속 과거 물방울 폐기 시안·운영 배포 등은 현재 checkout 로그만으로 전부 증명할 수 없음 | 해당 branch/release 증거를 확보한 건만 과거 변경으로 추가. 추측/미실행 검증 기재 금지 |

## 5. 검수·갱신 규칙

1. 작업 전 root PM README→program 정본, 이 보고서 OPEN 항목과 DESIGN §18을 읽는다.
2. 영향 화면/파일·정상 원본 유지 범위를 공유한다. 파일 소유권이 겹치면 먼저 조정한다.
3. 재현 절차/입력/뷰포트·기대값·실제값을 적고, 가능하면 수정 전 실패하는 회귀를 추가한다. 테스트 작성 오류는 제품 버그와 구분한다.
4. 원인을 교정하고 관련 회귀→반복/긴 동선→전체 lint/build/E2E 및 필요한 production preview를 실행한다. 새 버그가 나오면 해당 단계로 돌아간다.
5. 같은 보고서의 ID/검증/OPEN/파일 목록을 갱신하고 DESIGN/PM에는 결정과 링크만 남긴다. 모델 의견은 자동화/fixture/replay/실제 화면 증거를 대체하지 않는다.
6. 테스트 명령·통과/실패/skip·환경·제한을 기록한다. 실패·가설 기각·미재현도 지우지 않는다. 총합에 옛 퍼널이 들어가면 구분한다.
7. 원본·테스트·문서·필요 자산을 명시 경로로 Git에 포함한다. `git add .`, 다른 worktree 일괄 stage, 비밀값 기록 금지. 기록/추적과 commit/push/deploy를 구분한다.

## 6. 이번 반복 검수

### 6.1 재현 → 교정 → 반복

| 단계 | 실제 수행/결과 | 해석 |
|---|---|---|
| 이력 통합 | BF-001~060 색인, OPEN-001~009, 현재 Git 파일·별도 worktree 경계, DESIGN 상세 QA 이관 | 기능 복원/예방 회귀와 개별 버그 수를 구분. 근거 없는 과거 성공은 제외 |
| 제한 독립 검토 | `agy --model gemini-3.8-flash-high` 기본 profile, ClientAccountUI 배경 닫기/포커스 코드만 읽기 전용 | 기본 동작과 cleanup 충돌 가설 확인. Safari/클릭 관통/scrollbar 추정은 확정 버그로 등록하지 않음. 최종 Go/No-Go 검수가 아님 |
| 첫 재현 | 신규5시나리오×desktop/mobile =10실패 | 이 중 의견 버튼을 `피드백`으로 찾은2건은 테스트 작성 오류. 실제 문구 `의견 보내기`로 수정. 모바일은 숨겨진 사이드바 버튼 대신 보이는 메뉴 복귀 기대값으로 교정 |
| 수정 전 재재현 | 올바른 selector/노출 조건으로 재실행, **10실패** | 실제 포인터로 BF-061, X 닫기 후 잘못된 진입점으로 BF-062 확인. DOM dispatch만으로 기본 포커스 동작을 흉내 내지 않음 |
| 최소 코드 교정 | `src/components/ClientAccountUI.tsx`의4개 배경 분기 preventDefault, mount별 최초 focus origin 보존 | 원본 정상 디자인·문구·레이아웃/계약 불변, 내부 input 클릭 분기는 건드리지 않음 |
| 신규 회귀 | `npx playwright test tests/client-backdrop-focus.spec.ts --reporter=dot` → **10 passed (4.1s)** | 로그인/설정/프로필/피드백 배경 복귀, 내부 입력 클릭·초안·X 복귀 |
| 보강 후 반복 | 기존 로그인 시나리오 안에 Escape 재개방/복귀 assertion 추가 (`test()` 개수 불변). 아래 관련4파일 `--repeat-each=3` → **198 passed (50.4s)** | 신규10 + 기존 계정/확장 입력·숫자/청크 실패·IME56 =66개×3. 독립 버그198개라는 뜻 아님 |
| 정적/빌드 | `npm run lint && npm run build` → **통과** | ESLint + TypeScript project build + Vite production bundle |
| 빌드 화면 직접 검수 | 독립 임시 production preview,320/768/1440px 로그인 배경·Escape 및 설정 배경 닫기 | 각 폭 overflow0, root inert=false, 예상 trigger focus, pageerror0. 320/1440px 캡처 직접 확인. 실기기 Safari 결과 아님 |
| 검토 후 추가 빌드 확인 | 의견 보내기 패널의768/1440px 실제 배경 닫기·복귀,768px 캡처 직접 확인 | 두 폭 overflow0/inert=false/pageerror0, 보이는 menu/settings 복귀. 자동화 검증과 캡처 범위를 별도 명시 |
| 전체 회귀 1차 | `npx playwright test --reporter=dot` → **465 passed / 1 failed / 20 skipped (4.0m)** | 구형 전체 퍼널의 추천 비교→ATR 대기 timeout. 원본 React 신규/관련 검수 실패는 없었으나 전체 합격으로 보고하지 않음 |
| 실패 trace 검토 | `playwright trace`의 action83 클릭/입력/이후 snapshot, console 및 failed requests 확인 | click1.6초 동안 불안정/viewport 이탈 재시도 후 완료. 이후에도 `tesia-shell view-result`, ATR action91 대기 timeout. console error·실패 요청 없음. 클릭 이벤트 손실의 근본 원인 미확정 |
| 실패 시나리오 재실행 | 동일 desktop 전체 퍼널 `--repeat-each=5` → **5 passed (16.1s)** | 코드/기대값/timeout 변경 없이 재통과. 해결로 간주하지 않고 OPEN-001 재발 기록 유지 |
| 전체 회귀 2차 | `npx playwright test --reporter=dot` → **466 passed / 20 skipped (3.7m)** | `.last-run.json` passed/failedTests=[] 확인. 재시도 설정0 유지, 1차 실패는 OPEN-001에 남김 |
| 문서·Git 최종 점검 | 현재 변경113경로 전부 인벤토리 포함, BF62/OPEN9 ID와 모든 참조 테스트 파일 존재 확인. 기존 QA22,151자 이관 전후 완전 일치 | web/program `git diff --check` 통과. 보고서 index 추가, 기존 나머지 index/worktree 보존 |

반복 명령:

20개 skip은 `tests/dashboard.spec.ts`의 기존 프로젝트 조건부 검사다. 데스크톱 전용18개는 mobile에서, 모바일 전용2개는 desktop에서 제외된다. 실패를 숨기려고 skip/retry/timeout을 바꾸지 않았다. 구형 퍼널 포함 수치를 새 원본 React 이식 완료로 합산하지 않는다.

```bash
npx playwright test tests/client-backdrop-focus.spec.ts tests/client-account-ui.spec.ts tests/client-review-hardening.spec.ts tests/client-failure-recovery.spec.ts --repeat-each=3 --reporter=dot
```

새 재현 절차: 홈 로그인 또는 사이드바 설정/프로필/의견 보내기 → 내부 포커스 확인 → 실제 배경 pointer down/up → 창이 닫힌 후 보이는 진입 버튼(숨겨졌으면 메뉴/settings fallback) 확인. 로그인 X/Escape 후 재개방도 반복한다. 의견 패널은 폰 전체 폭을 차지하므로 노출 배경 검증은768px 태블릿에서 한다. 390px 내부를 배경으로 간주하지 않는다.

BF-062는 개발 StrictMode effect replay에서 재현한 결함이다. 이 조건을 운영에서도 재현했다고 주장하지 않는다. production build는 별도로 정상 복귀를 확인했다. 실패 주입 테스트의 React `console.error: Failed to fetch dynamically imported module`은 의도된 오류이며 전체 console 무오류라고 보고하지 않는다.

보고서도 agy의 읽기 전용 범위 검토 후 수정했다. 상태명 혼용 지적은 표준 상태+설명으로 통일했다. Escape assertion 보강을 새 `test()` 증가로 해석한 수량 지적은 코드/실행 합계상 해당하지 않아 추가 위치를 명시했다.768px 의견 검증은 이미 E2E에 포함되지만 production 캡처 범위와 혼동될 수 있어 위 별도 빌드 검증을 추가했다. 모델 지적을 그대로 확정 버그로 합산하지 않았다.

### 6.2 전달·잔여 범위

이번 쓰기 소유자는 `/root`이며 agy는 파일을 수정하지 않았다. 변경은 계정 컴포넌트·신규 회귀·보고서/디자인 안내/AGENTS/README·program PM 인계에 한정한다. 이전 전체 작업과 타 worktree는 보존했다. 원본 UI를 재설계하지 않았고 실제 API/credential/주문 계약도 바꾸지 않았다. `impeccable` harden 기준은 정상 화면을 유지하며 포커스 복귀·오류/입력 경계를 시험하는 데 적용했다.

전체 회귀가 통과하더라도 OPEN-001의 과거 간헐 원인, 실제 API·전문 차트 통합, 실기기/전 언어·확대 조합 검증은 미완료다. 로컬4174를 유지하며 commit/push/운영 배포는 하지 않는다. Git 추적 상태는 §7을 따른다.

## 7. Git 변경 범위와 전달 상태

현재 checkout의 추적 파일 변경과 untracked 추가 파일을 빠짐없이 목록화한다. 이것은 파일 인벤토리이지 각 파일이 이번 턴 작성됐다는 주장이나 원격 반영 증거가 아니다. 중첩 저장소/별도 worktree는 경계만 기록하고 그 내용을 부모 Git에 중복 추가하지 않는다. 최신 스냅샷과 과거 커밋 근거는 아래에 갱신한다.

전달 상태: `git add -- Bugfix_report.md`로 **이 보고서만 index에 추가**했다. 나머지 기존 코드/문서 변경은 해당 worktree 상태로 보존했으며 일괄 stage/commit/push하지 않았다. HEAD는 `53badf6` 그대로다. 이 보고서는 변경 내역의 기록이며 미추적 소스 전체를 커밋한 백업을 뜻하지 않는다.

<!-- GIT_INVENTORY_START -->
### 7.1 현재 web checkout

기준 HEAD `53badf6`. HEAD 대비 추적 변경 15개, untracked 경로 98개(별도 저장소 경계 포함). `M` 수정, `D` 삭제, `A` index 추가, `??` 미추적. 보고서 stage 이후 상태는 전달 메모에서 구분하며 다른 파일을 자동 stage하지 않는다.

| Git | 경로 | 변경 내용/역할 |
|---|---|---|
| M | `AGENTS.md` | 동일 보고서 지속 갱신 규칙 |
| A | `Bugfix_report.md` | 전체 버그·검증·OPEN·Git 인벤토리 정본 |
| M | `README.md` | 로컬 원본 UI/정보 경로·검수 정본 안내 |
| M | `index.html` | 원본 TETH 제목·설명·theme·PNG favicon |
| M | `package-lock.json` | 폰트 의존성 잠금 갱신 |
| M | `package.json` | 한국어/중국어 variable font 의존성 |
| M | `public/apple-touch-icon.png` | 원본 TETH 로고/앱 아이콘 자산 |
| D | `public/favicon.svg` | 기존 SVG favicon 삭제 상태; 원본 PNG로 교체된 기존 변경 |
| M | `public/icon-192.png` | 원본 TETH 로고/앱 아이콘 자산 |
| M | `public/icon-512.png` | 원본 TETH 로고/앱 아이콘 자산 |
| M | `public/site.webmanifest` | TETH 원본 description/background/theme |
| M | `src/components/SignalCanvas.tsx` | 기존 상상 캔버스 변경/축소; 원본 React 진입과 구분 |
| M | `src/funnel-v2.css` | 이전 imagination-canvas 전용 규칙 정리; 구형 퍼널 보존 |
| M | `src/main.tsx` | 원본 React/SiteRouter 기본 진입·구형 DEV fixture 경계 |
| M | `tests/dashboard.spec.ts` | 구형 퍼널 fixture 격리 및 기존 회귀 유지 |
| ?? | `DESIGN.md` | 원본 이식60항목·합격 기준·결정; QA 상세는 보고서로 이관 |
| ?? | `public/client-shots/about-backtest.webp` | 원본 정보/모바일 데모 로컬 이미지 |
| ?? | `public/client-shots/about-connect.webp` | 원본 정보/모바일 데모 로컬 이미지 |
| ?? | `public/client-shots/about-live.webp` | 원본 정보/모바일 데모 로컬 이미지 |
| ?? | `public/client-shots/about-plan.webp` | 원본 정보/모바일 데모 로컬 이미지 |
| ?? | `public/client-shots/about-report.webp` | 원본 정보/모바일 데모 로컬 이미지 |
| ?? | `public/client-shots/about-talk.webp` | 원본 정보/모바일 데모 로컬 이미지 |
| ?? | `public/client-shots/dl-chat.webp` | 원본 정보/모바일 데모 로컬 이미지 |
| ?? | `public/client-shots/dl-live.webp` | 원본 정보/모바일 데모 로컬 이미지 |
| ?? | `public/client-shots/dl-report.webp` | 원본 정보/모바일 데모 로컬 이미지 |
| ?? | `public/favicon.png` | 원본 TETH 로고/앱 아이콘 자산 |
| ?? | `public/teth-logo.png` | 원본 TETH 로고/앱 아이콘 자산 |
| ?? | `repos/tesia-web/worktrees/web-public-mock-dashboard-qa/` | 별도 Git/worktree 경계 — 부모 stage 제외 |
| ?? | `scripts/read-client-copy.mjs` | 원본 카피 추출 보조 도구 |
| ?? | `src/client-account-ui.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-conversation.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-delegation-fixtures.ts` | 원본 로컬 사례 fixture (실데이터 아님) |
| ?? | `src/client-delegation.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-experience-store.ts` | 대화 세션·초안·running/손상 복구·저장 실패 |
| ?? | `src/client-load-recovery.css` | 선택적 실패 시 독립 로드되는 복구 패널 스타일 |
| ?? | `src/client-main-experience.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-percentage-input.ts` | 모호성/유한성/전체 퍼센트 입력 검증 |
| ?? | `src/client-preferences.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-preferences.ts` | 언어·통화·저장/구독·실패 복구 |
| ?? | `src/client-public-copy.json` | 원본 카피 데이터 (실제 서비스 응답 아님) |
| ?? | `src/client-public-pages.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-reference-copy.json` | 원본 카피 데이터 (실제 서비스 응답 아님) |
| ?? | `src/client-reference.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-research-activity.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-research-cache.ts` | 연구/위임 허용 UI 임시 보관과 삭제·실패 안내 |
| ?? | `src/client-research-document.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-research-fixtures.ts` | 원본 로컬 사례 fixture (실데이터 아님) |
| ?? | `src/client-research-hub.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-restored-research.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/client-workspace.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/components/ClientAccountUI.tsx` | 원본 계정/설정/피드백·IME·pending·포커스 및 BF-061/062 |
| ?? | `src/components/ClientChrome.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientComposer.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientConversation.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientDelegationWorkspace.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientIcon.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientLoadBoundary.tsx` | 선택적 chunk failure 격리·복구/취소·포커스 |
| ?? | `src/components/ClientLocalePanel.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientMainExperience.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientPublicPages.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientResearchActivity.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientResearchChart.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientResearchDocument.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientResearchHub.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientResearchLog.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientResearchPreviewTools.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/ClientResearchWorkspace.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/DownloadPreview.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/InternalLink.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/components/SiteRouter.tsx` | 원본 기반 React 화면/상태 컴포넌트 |
| ?? | `src/conversation-shell.css` | 원본 화면 계층·반응형/접근성 보정 CSS |
| ?? | `src/mock-research-preview.ts` | 원본 연구 사례·개발 preview 경계 |
| ?? | `src/research-library.ts` | 연구 기록/공유 로컬 모델 |
| ?? | `src/research-view-model.ts` | 문서/연구 UI projection |
| ?? | `src/site-navigation.ts` | 내부 route/hash 이벤트·공개 페이지 구분 |
| ?? | `src/use-client-placeholder.ts` | 원본 입력 placeholder 타이핑·삭제 주기 |
| ?? | `tests/client-account-ui.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-audit-fixes.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-backdrop-focus.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-background-progress.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-conversation.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-cross-surface.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-delegation-boundaries.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-delegation.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-failure-recovery.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-main-experience.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-navigation-input.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-preference-recovery.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-preferences.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-public-locales.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-public-pages.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-research-storage.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-restored-research.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-review-cycles.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-review-hardening.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-shell.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-sidebar-alignment.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-state-boundaries.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-ui-continuity.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-user-journeys.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/client-visual-detail.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/download-preview.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/fixtures/research-activity.html` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/fixtures/research-activity.tsx` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/fixtures/research-document.html` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/fixtures/research-document.tsx` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/legacy-fixture.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/research-activity.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/research-document.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/research-navigation.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/research-parity.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `tests/responsive-readability.spec.ts` | 해당 영역의 UI·상태·반응형 회귀 또는 fixture |
| ?? | `worktrees/web-service-next/` | 별도 Git/worktree 경계 — 부모 stage 제외 |

### 7.2 program 문서 변경 경계

PM README·제품 정본 §16/20·WORK_LEDGER만 이번 프론트 인계 범위다. 나머지 변경은 기존 타 작업으로 보존하며 이 포크의 수정/검증 완료라고 주장하지 않는다.

| Git | 경로 | 소유 범위 |
|---|---|---|
| M | `AGENTS.md` | 별도 기존 변경/중첩 worktree; 보존·미stage |
| M | `PM/README.md` | 이 포크 PM 인계 갱신 (기존 내용 보존) |
| M | `PM/TESIA_AI_POC_Product_Implementation_Plan.md` | 이 포크 PM 인계 갱신 (기존 내용 보존) |
| M | `README.md` | 별도 기존 변경/중첩 worktree; 보존·미stage |
| M | `WORK_LEDGER.md` | 이 포크 PM 인계 갱신 (기존 내용 보존) |
| M | `runbooks/REPOSITORY_GOVERNANCE.md` | 별도 기존 변경/중첩 worktree; 보존·미stage |
| ?? | `worktrees/program-active-runtime-ledger/` | 별도 기존 변경/중첩 worktree; 보존·미stage |
| ?? | `worktrees/program-contracts-milestone-sync/` | 별도 기존 변경/중첩 worktree; 보존·미stage |
| ?? | `worktrees/program-decision-gates/` | 별도 기존 변경/중첩 worktree; 보존·미stage |
| ?? | `worktrees/program-runtime-v07-risk-semantics/` | 별도 기존 변경/중첩 worktree; 보존·미stage |

### 7.3 현재 브랜치의 이미 커밋된 이력

아래는 로컬 Git log 근거다. 이번 미커밋 복원 내용의 원격 반영 증거가 아니다.

| SHA | 내용 |
|---|---|
| `53badf6` | feat: promote TETH mock UI experience |
| `86a4a40` | ci: grant PR read permission to secret scan (#1) |
| `c66e5b6` | ci: stabilize browser tests on hosted runners |
| `c5d84bf` | chore: initialize tesia-web repository |

`53badf6`은 SignalCanvas·퍼널/스타일·메인·메타·회귀 등9파일(+692/−220)의 당시 Mock UI 승격 변경이다. CI 권한/hosted browser 수정은 위 커밋의 범위이며 이번에 재실행한 원격 CI 결과가 아니다.

### 7.4 별도 web worktree 경계

과거 전문 차트/백테스트/서비스 연결 작업이 현재 checkout과 분리되어 있음을 명시한다. 아래는 읽기 전용 Git HEAD/상태 스냅샷이며 해당 worktree 내부 전수 코드 리뷰·병합·테스트 합격 목록이 아니다. 변경 수는 `git status --short`의 행 수(미추적 디렉터리는 묶임)다. 어느 worktree도 이번 작업으로 삭제/수정/stage하지 않았다.

| worktree (현재 web 기준 상대 경로) | HEAD | branch | 상태 행 |
|---|---|---|---|
| `` | `53badf6` | `agent/web/teth-mock-ui-promotion-20260827` | 102 |
| `../../../../../.cache/tesia-infra-web-main.T9rNai/web-source` | `55a1741` | `detached` | 0 |
| `../../../../../.cache/tesia-owner-local-final-run.Up8vhbyM/web-source` | `55a1741` | `detached` | 0 |
| `../../../../../.cache/tesia-owner-local-final-run.bSv6CK3r/web-source` | `55a1741` | `detached` | 0 |
| `../../../../../.cache/tesia-owner-local-final-run.ylVITMwe/web-source` | `55a1741` | `detached` | 0 |
| `../../../../../.cache/tesia-web-node22-base.9pvNOn/repo` | `ffe179a` | `detached` | 0 |
| `../../../../../.cache/tesia-web-node22-current.lRmqva/repo` | `e45cd2a` | `detached` | 0 |
| `../../../../../.cache/tesia-web-node22-final.08e6300` | `08e6300` | `detached` | 0 |
| `../../../../../.cache/tesia-web-pr21-qa.YfaEvF/src` | `b2c0628` | `detached` | 0 |
| `repos/tesia-web/worktrees/web-public-mock-dashboard-qa` | `8fc48a4` | `agent/web/public-mock-dashboard-qa` | 0 |
| `worktrees/web-service-next` | `b6094ef` | `detached` | 0 |
| `../../worktrees/qa-web-pr21-2adddb` | `2adddb8` | `detached` | 0 |
| `../../worktrees/release-web-session-closure-qa` | `dd4e489` | `detached` | 0 |
| `../../worktrees/release-web-session-independent-qa` | `08e6300` | `detached` | 0 |
| `../../worktrees/web-backtest-reporting` | `04dfb75` | `agent/web/backtest-reporting` | 0 |
| `../../worktrees/web-browser-session-independent-qa` | `dad0297` | `detached` | 0 |
| `../../worktrees/web-dashboard-base-independent-qa` | `99bd374` | `detached` | 0 |
| `../../worktrees/web-dashboard-dad-independent-qa` | `dad0297` | `detached` | 0 |
| `../../worktrees/web-dynamic-chart-timeframes` | `d060e03` | `agent/web/dynamic-chart-timeframes-20260828` | 0 |
| `../../worktrees/web-lightweight-backtest-workspace` | `3aa98d0` | `agent/web/lightweight-backtest-workspace-20260902` | 19 |
| `../../worktrees/web-local-api-integration` | `c547c93` | `fix/web/local-api-supported-quick-idea` | 0 |
| `../../worktrees/web-local-market-artifact-ui` | `0c50db2` | `feat/web/local-market-artifact-ui` | 0 |
| `../../worktrees/web-local-paper-runtime-hash-v04` | `43d31a8` | `fix/web/local-paper-runtime-hash-v04` | 0 |
| `../../worktrees/web-local-paper-session` | `2cd3e14` | `feat/web/local-paper-session` | 0 |
| `../../worktrees/web-local-strategy-vertical` | `1e68ca7` | `feat/web/local-strategy-vertical` | 0 |
| `../../worktrees/web-mmr-limitation-display` | `d933712` | `feat/web/mmr-limitation-display` | 0 |
| `../../worktrees/web-mock-report-boundary` | `0efd5b3` | `feat/mock-report-boundary` | 0 |
| `../../worktrees/web-mock-strategy-backtest-flow` | `2679ed8` | `agent/web/mock-strategy-backtest-flow` | 0 |
| `../../worktrees/web-owner-local-service-vertical` | `dd4e489` | `feat/web/owner-local-service-vertical` | 0 |
| `../../worktrees/web-paper-safe-error-ux` | `b2c0628` | `fix/web/paper-safe-error-ux` | 0 |
| `../../worktrees/web-professional-chart-promotion` | `97a5346` | `agent/web/professional-chart-promotion-20260828` | 0 |
| `../../worktrees/web-reporting-comparable-deltas` | `3ebc6fd` | `fix/web/reporting-comparable-deltas` | 0 |
| `../../worktrees/web-reporting-v06-executive` | `c88a154` | `feat/web/reporting-v06-executive` | 0 |
| `../../worktrees/web-service-bootstrap-readiness` | `dad0297` | `feat/web/browser-session-bootstrap` | 0 |
| `../../worktrees/web-service-stack-build` | `99bd374` | `detached` | 0 |
| `../../worktrees/web-shorthand-conversation` | `268d152` | `feat/web/shorthand-conversation` | 0 |
| `../../worktrees/web-testimonial-clock-fix` | `5284496` | `fix/testimonial-clock-race` | 0 |
| `../../../../../../../tmp/tesia-local-vertical-web-jLj5lC` | `91447c0` | `detached` | 경로 없음/미확인 |
| `../../../../../../../tmp/tesia-web-v03-consumer` | `a56bc79` | `agent/web/service-v03-adapter` | 0 |
| `../../../../../../../tmp/tesia-web-v03-http-adapter.au5Pky` | `e6e7acf` | `agent/web/service-v03-http-adapter` | 0 |
| `../../../../../../../tmp/tesia-web-v03-ui.D8Hpic` | `615cf97` | `agent/web/service-v03-mock-e2e` | 0 |
<!-- GIT_INVENTORY_END -->

### 7.5 이전 차트·리뷰·실연결 관련 별도 브랜치 Git 근거

요청 대화의 과거 작업과 혼동하지 않도록, 해당 worktree HEAD의 **커밋 제목으로 확인한 범위**만 기록한다. 실제 전체 diff·배포 상태·수치 정합성은 이번 검수 범위가 아니며 현재 React 통합 완료로 승격하지 않는다.

| SHA | Git에 남아 있는 변경 | 구분 |
|---|---|---|
| `5284496` | testimonial layout assertion의 시계 고정 | 테스트 안정화 커밋. 후기 제품 로직 수정이라고 과장하지 않음 |
| `97a5346` | professional backtest chart 승격 커밋 | 별도 전문 차트 브랜치. 현재 운영 상태는 이번에 조회하지 않음 |
| `d060e03` | mock chart timeframe 동기화 | 과거 주기별 차트 UI. 현재 원본 React의 실제 OHLC 계약 통합 증거 아님 |
| `2679ed8` | mock strategy/backtest journey 추가 | 기능 추가, 실제 백테스트 연결과 구분 |
| `3ebc6fd`, `3aa98d0` | backtest delta를 비교 가능한 rate에 제한 (후자는 PR#10 제목) | 별도 보고서 수치 의미 교정 이력 |
| `c547c93` | quick idea와 offline compiler 정합성 교정 | 별도 로컬 API 작업. 현재 fork의 자유 대화 연결 완료 아님 |
| `b2c0628` | catalog 실패 시 오래된 Paper 선택 무효화 | 별도 Paper 오류 UI 교정 이력 |
| `dd4e489` | 명시적 owner-local session 흐름 연결 | 별도 로컬 서비스 흐름. 공개/Production 승격 증거 아님 |

## 8. 누적 검수 증거

기존 DESIGN §19의 로컬 검수 기록을 내용 그대로 이관한다. 아래의 §19/§21 언급은 당시 DESIGN 문서 기준이다. 아래 수치는 **그 회차 당시 결과**이며 현재 합계나 운영 상태를 뜻하지 않는다. 임시 `/tmp` 캡처와 Playwright test-results는 Git 영구 자산이 아니며 이후 정리/재실행 시 바뀔 수 있다. 재현 가능한 테스트 코드와 이 기록을 구분한다.

<!-- QA_HISTORY_START -->
검수 주소는 `http://localhost:4174/`다. 원본 기반 기본 UI와 보존된 구형 퍼널 회귀를 별도 테스트로 구분한다. `tests/legacy-fixture.ts`를 사용하는 테스트의 성공은 새 기본 UI 완료 증거가 아니다.

로드 실패·조합 입력 심층 검수(2026-09-08): 앞선 정상/연속 사용 검사에 선택적 JavaScript 청크의 실패·지연과 한글 조합 취소를 추가했다. 정상 화면은 변경하지 않고 실패/로딩 상태에서만 복구 UI를 제공한다. 실제 API/인증/주문 계약은 그대로다.

| 단계 | 재현·교정·확인 |
|---|---|
| 기존 잔여 위험 확인 | 구형 `세 추천 수정안은 카드에 약속한 서로 다른 결과를 재현한다`를 데스크톱에서5회 반복, 모두 통과. 기존 간헐 클릭 원인은 확정되지 않았으므로 해결 완료로 바꾸지 않음 |
| 실패 주입 | 공개 페이지의 첫 lazy import 요청을 차단하자 전체 React 트리가 내려가 대화와 메모리 초안까지 소실. 실패 시 sibling 대화를 보존하는 `ClientLoadBoundary`와 공개 페이지 복귀/새로고침을 추가 |
| 느린 로드·도움말 | 늦게 완료된 공개 페이지가 복귀한 대화를 덮지 않음. 도움말도 별도 오류 경계와 취소 가능한 로딩 상태를 제공해 빈 화면/입력 잠금에 갇히지 않음. 복귀 시 보이는 본문/메뉴로 포커스 복원 |
| 조합 취소 | 로그인, 언어 검색, 메뉴 제목 편집, 연구 행 코멘트의 composing Escape가 창/편집을 닫는 결함 재현. 조합 중 이벤트는 입력기에 맡기고 일반 Escape의 닫기·초안 보존은 유지 |
| 수정본 재검토 | 첫 복구 UI의 `h2`에 status 역할을 덮어쓴 접근성 결함을 검사에서 발견해 heading/status를 분리. 이후 배경 클릭 닫기 누락과 pointer 기본 동작에 의한 복귀 포커스 손실도 재현하고 보완 |

신규 `tests/client-failure-recovery.spec.ts`는9종×2프로젝트(18개)다. 초기 데스크톱6개 실패(공개 로드2·조합 취소4)를 확보했고, 첫 수정 후 제목 역할2개 실패를 교정해 기존 공개/긴 동선 포함34개가 통과했다. 추가 검수의 배경 클릭1개 및 포커스 복귀6개 반복 실패까지 교정한 최종 신규18개는3회 반복54개 통과(17.4초)다. IME 검사는 composition 이벤트와 `isComposing`으로 브라우저 핸들러를 검사하며 실제 OS 한글 입력기/Safari 실기기 검증을 대체하지 않는다. 요청 차단에 따른 의도된 console 오류와 ErrorBoundary에 잡히지 않은 pageerror는 구분한다. 실패를 성공으로 표시하거나 브라우저의 import 캐시를 무시한 무한 자동 재시도를 추가하지 않았다. 새로고침은 명시적 버튼이며 저장 실패 중에는 새로고침 없는 대화 복귀 경로로 메모리 초안을 보존한다.

최종 전체476개 중456개 통과·20개 조건부 건너뜀·실패0개(3.8분), lint·TypeScript/production build·양쪽 저장소 diff check 통과.20개는 기존 구형 퍼널의 프로젝트 전용 검사를 반대 프로젝트에서 건너뛴 것이며 신규 검사는 모두 실행했다. 전체 수치는 구형 퍼널을 포함하며 실제 서비스 합격을 뜻하지 않는다.

최종 빌드와 분리한 production preview에서320/768/1440px 공개 청크 실패→오류 안내→초안 보존/복귀를 확인했다. 도움말은390px 및320×180px에서 제목과 두 복구 버튼의 키보드 접근·닫기·잠금 해제·포커스 복귀를 검사했다. 정상 크기 가로 넘침0px·미처리 pageerror0건. `/tmp/teth-load-recovery-*.png`, `/tmp/teth-help-recovery-*.png`는 직접 확인한 검수용 임시 캡처이며 제품 자산이 아니다. 원본 페이지가 정상 로드된 뒤의 레이아웃·카피·차트는 바꾸지 않았다.

impeccable harden의 실패/조합 입력 기준을 적용하고 front-gemini의 경로 지시에 따라 agy `gemini-3.8-flash-high`에 SiteRouter 누락 및 새 복구 패널의 제한된 읽기 전용 검토를 맡겼다. agy의 오류 경계/복귀 문구 제안을 적용했고 배경 클릭은 실제 재현 후 보완했다. 현재 grid의 낮은 높이 잘림은 재현되지 않았으며, effect cleanup의 microtask가 무조건 실패한다는 의견은 Escape 복귀 검사로 반증했다. 모델 의견을 자동 테스트나 운영 승인으로 승격하지 않는다. 최신 전체 회귀는 아래 요약을 따르며 실제 서비스/전문 차트 연결·실기기·전 언어/확대 조합과 기존 구형 클릭 위험은 여전히 별도다. local in_review 및 운영 승격 없음.

교차 화면·연속 사용 검수(2026-09-08): 이전의 화면별 검사만으로 놓친 상태 전이를 보완하기 위해, 메뉴를 연 채 뒤로가기·처리 중 재입력·비동기 완료 역전·작업 중 화면 크기 변경을 직접 재현했다. 새 계정에서 시작하는 긴 시나리오도 별도로 작성했다. 원본 레이아웃·문구·SVG·연구 진행 표현은 재설계하지 않았다.

| 재현 영역 | 교정과 확인 |
|---|---|
| 대화 메뉴 | 공개 경로로 이동하면 닫고, 메뉴 밖으로 Tab 이동한 뒤 Home/End를 입력창에서 사용할 때 가로채지 않는다. 복귀 후 초안·메뉴 재개방·Escape 포커스를 확인 |
| 공개 페이지 언어 팝업 | about/download 뒤로가기에서 잔류하던 팝업·스크롤 잠금을 해제한다. 새 본문 포커스와 재개방을 확인. 같은 조건의 도움말은 기존 정상 동작을 확인하고 변경하지 않음 |
| 질문·답변 복사 | 두 요청의 완료 순서가 뒤집혀도 이전 실패가 최신 성공을 덮지 않도록 요청 순서를 구분. 두 컴포넌트에서 각각 재현·교정 |
| 연결 입력 | UID/API 확인 중 입력은 읽기 전용으로 유지하고 실패하면 다시 수정 가능. 명시적으로 뒤로간 뒤 취소된 완료가 화면을 바꾸지 않는지, 가상 입력이 storage에 저장되지 않는지 확인 |
| 연구 Artifacts | 공개 경로 이탈 시 패널과 키보드 처리를 해제. 모바일↔데스크톱 전환에서 숨는 버튼 대신 보이는 트리거/문서 버튼에 포커스 복귀. Chromium이 breakpoint 이벤트 전에 focus를 body로 옮기는 경우도 재현 후 보완 |

신규 `tests/client-cross-surface.spec.ts`는9종×2프로젝트(18개), `tests/client-user-journeys.spec.ts`는2종×2프로젝트(4개)다. 제품 수정 전 데스크톱 검사에서 총8개 실패를 확보했다(메뉴2·언어1·복사2·입력1·Artifacts2). 교정 후 신규22개를3회 반복해66개가 통과했다. 긴 동선은 두 대화의 초안/제목 분리→연구 시작→공개 화면에서 진행→문서 탐색→연결 미리보기→Paper 일시 정지/복귀/종료→기록/랭킹의 초안 가져오기, 그리고 공개 언어/정책/설정/피드백 왕복을 검사한다. 320/768/1440px를 동선 중 교차 적용하고 duplicate id·숨은 포커스·가로 넘침·잘못된 SVG 좌표·pageerror를 검사한다. fixture 시간은 가상 시계로 진행하며 실서비스 대기 시간/응답 정확성 시험으로 해석하지 않는다.

최종 전체 회귀는458개 중438개 통과·20개 조건부 건너뜀·실패0개(3.6분)다. 건너뜀은 기존 구형 퍼널의 프로젝트 한정 검사(데스크톱 전용18종·모바일 전용2종)의 반대 프로젝트이며 신규 테스트를 건너뛰지 않았다. lint·TypeScript/production build·두 저장소 diff check를 통과했다. 전체 수치에는 기존 구형 퍼널도 포함되므로 원본 UI만의 완료 수치나 실서비스 합격 판정으로 쓰지 않는다.

테스트 작성 중의 잘못된 버튼 선택(숨은 헤더 로그인, 원본과 다른 피드백 이름)과 호스트/브라우저 시계 차이, 멈춘 가상 시계로 인한 React lazy/Suspense 대기는 제품 버그와 구분했다. 실제 보이는 사이드바 동선·원본 이름·브라우저 기준 시각을 사용하고, 중복 전송 확인 후 가상 시계를 재개해 테스트만 교정했다. 기존 계정 취소 회귀도 브라우저 기준 시각을 사용한다. 테스트를 통과시키기 위해 제품 흐름을 바꾸거나 실패 단언을 제거하지 않았다.

별도 production preview에서390px 대화 메뉴 공개 경로 왕복과 초안, 연구 Artifacts390→1440→320px 포커스 및 공개 경로 복귀,320px 언어 팝업을 직접 확인했다. pageerror0건·가로 넘침0px이며 `/tmp/teth-journey-*.png`는 직접 확인한 임시 캡처로 제품 자산이 아니다. impeccable harden의 오류/포커스 기준을 원본 보존형 검수에 적용하고 front-gemini의 경로 지시에 따라 agy `gemini-3.8-flash-high`에 연결 입력만 읽기 전용 검토·재검토시켰다. 처리 중 값 변경은 재현 후 반영했지만 화면 이탈 시 무조건 작업 취소, 미재현 중복 제출, 상위에 이미 있는 오류 안내 중복 추가는 채택하지 않았다. 모델 검수를 운영 승인으로 사용하지 않는다. 실제 API/전문 결과 차트·실기기/Safari/스크린리더·전 언어/확대 조합 및 기존 구형 퍼널의 원인 미확정 클릭 위험은 별도이며 local in_review와 운영 승격 없음 상태를 유지한다.

10회 반복 검수(2026-09-08): 사용자 요청에 따라 아래 영역을 순서대로 코드 검토→재현→확인된 결함 교정→관련 회귀 검사로 진행했다. 결함이 재현되지 않은 회차는 수정 건수를 만들기 위해 원본을 변경하지 않았다. 이전 작업의 검수 횟수는 아래 10회에 포함하지 않는다.

| 회차 | 검수 영역 | 결과와 재검증 |
|---|---|---|
| 1 | 홈 입력·확대·전송/취소·화면 이탈 | 신규 결함 미재현. 관련28개 통과. 원본 및 보존된 구형 셸 일부 포함 |
| 2 | 대화 복사·수정·중지·연속 사용 | 복사 성공 후 두 번째 복사가 실패해도 성공 아이콘/레이블이 남는 결함 재현. 실패 시 성공 상태 해제, 재시도 검증. 초기 신규1개 실패→관련40개 통과 |
| 3 | 반복 저장 실패·회복·초안 분리 | 실패 안내를 닫은 후 저장이 회복되어도 dismiss가 유지되어 다음 실패가 숨는 결함 재현. 회복 시 해당 실패의 dismiss만 해제. 초기 신규1개 실패→관련28개 통과 |
| 4 | 언어/통화 검색·화면 축소·포커스 | 데스크톱 통화 검색 중 모바일로 줄이면 언어 탭으로 숨는 결함 재현. 포커스가 있는 열과 활성 탭을 동기화. 반대 방향/언어 검색도 검증. 초기 신규1개 실패→관련24개 통과·lint 통과 |
| 5 | 인증/피드백 취소·지연 완료·입력 오류 | 신규 결함 미재현. 가입 미리보기 처리 중 취소한 뒤 오래된 완료가 계정을 바꾸지 않는 회귀 추가. 관련28개 통과. 외부 가입/인증 실행 없음 |
| 6 | 연구 진행·문서 탭·초안·읽기 위치 | 신규 결함 미재현. 타이머/캐시/문서 왕복 검토와 관련50개 통과 |
| 7 | 차트 주기·OHLC·봉 개수·포인터/키보드 | 위임 차트의 1W/1M 선택에도 일봉으로 남는 툴바 설명 재현·교정. 봉 개수/주간 OHLC 변화·1D 복귀 동기화 검증. 초기 신규1개 실패→관련36개 통과 |
| 8 | 정보·다운로드·정책·사이드바/가이드 왕복 | 신규 결함 미재현. 이벤트/잠금 해제 코드 검토, 캐러셀·정책 앵커·공개 경로·포커스 관련52개 통과 |
| 9 | 수정 반복 안정성·반응형 빌드 화면 | 신규 회귀8개를3회 반복해24개 통과. production preview의 홈/위임 차트320·768·1440px와 설정 검색 중320px 전환을 검수. 가로 넘침 없음·pageerror0건. 홈 등장 중 캡처는 완성 화면 증거에서 제외하고 reduced-motion 완성 화면을 다시 직접 확인 |
| 10 | 전체 회귀·정적 검사·최종 인계 | 전체436개 중416개 통과·20개 조건부 건너뜀·실패0개(3.5분). lint·TypeScript/production build·diff check 통과. 정본/PM 인계 동기화. 실제 서비스/운영 합격 아님 |

신규 검증은 `tests/client-review-cycles.spec.ts` 4종×2프로젝트(8개)와 `tests/client-account-ui.spec.ts` 취소/지연 완료1종×2프로젝트(2개)다. 차트 테스트의 첫 시도는 history 이탈 시 저장 flush를 고려하지 않은 fixture로 진입에 실패하여 실제 UI 진입으로 교정한 뒤 제품 결함을 재현했다. 제품 수정 후 두 프로젝트에서 발생한 OHLC 비교 실패는 `innerText`의 줄바꿈과 DOM 텍스트 혼용이 원인이었으며, OHLC 각 항목 배열 비교로 교정했다. 테스트 작성 오류와 제품 결함4건을 구분한다.

위임 차트는 기존 일봉 fixture의7/30개 묶음과 수치/매매 마커를 유지한다. 선택 코드 표시 교정은 실제 달력 주봉/월봉 집계나 실데이터 연결 구현이 아니다. 원본 정상 화면·카피·차트 모양·API/거래 계약을 재설계하지 않았다. `/tmp/teth-cycle9-*.png`는 임시 검수 캡처이며 제품 자산이 아니다.

impeccable harden은 원본을 유지하는 상태/오류/반응형 검수에 적용했다. front-gemini의 현재 경로 지시에 따라 agy `gemini-3.8-flash-high`로 복사/저장 상태를 좁게 검토하고 수정 후 제한 재검수했다. 읽기 권한으로 차단된 호출1회는 검수 완료로 세지 않고 권한 우회 없이 제공된 코드만으로 재시도했다. 모델의 추정 의견(불필요한 복사 타이머·미재현 포커스 경합 등)은 자동 반영하지 않았으며 브라우저 재현/회귀 증거를 우선한다. 실제 API·전문 결과 차트 통합, 실기기·스크린리더·전 언어/확대 조합과 기존 구형 퍼널의 원인 미확정 클릭 위험은 별도다. local in_review 및 운영 승격 없음.

위임 화면 경계 후속 검수(2026-09-08): UID 가이드를 연 채 공개 페이지로 history/내부 이동하면 `SiteRouter`가 숨겨 보존한 native dialog가 modal 상태에 남는 결함을 두 경로에서 재현했다. 위임 컴포넌트가 공개 경로의 `popstate`/`teth:navigate`에서 즉시 dialog를 닫고 guide 상태를 해제하도록 교정했다. 복귀 후 가이드 재개방·Escape·기본 포커스 복귀는 유지한다. agy가 제안한 별도 포커스 복원/DOM 제거 cleanup은 native 동작 부재를 입증하지 못했고 기존 및 신규 브라우저 검사에서 정상이라 추가하지 않았다.

위임 답변의 저장 실패도 연구와 별도로 재현했다. 쓰기 차단 중 자산/성향 선택→대화→위임 왕복에서 처음 질문으로 되돌아갔다. 기존 허용 목록 serializer의 결과만 동일 페이지 메모리에 보관하고, 읽기 시 기존 검증·라벨 정규화를 유지한다. 질문 응답·시각 검수 진행 시각/단계/보기만 대상이며 연결·결제·UID·키 입력은 포함하지 않는다. 세션 삭제는 해당 임시 보관도 정리한다. 저장 실패 안내는 실패할 때만 표시하고 다음 정상 저장 후 해제한다. 즉시 저장과 안내 갱신을 분리하고 effect 해제 후 오래된 안내 결과를 적용하지 않는다. 새로고침·다른 탭/기기 보존 보장이나 실제 실행 상태 계약이 아니다.

신규 `tests/client-delegation-boundaries.spec.ts`는 4종×2프로젝트(8개)로 공개 경로 가이드 해제·재개방, 쓰기 차단/복구·새로고침, 연구별 격리·삭제·허용 필드 복원을 검사한다. 초기 가이드2개 실패와 저장 소실1개 실패를 확보했다. 최초 저장 테스트는 완료 턴이 없는 fixture 때문에 진입 버튼을 찾지 못해 fixture를 교정한 뒤 실제 소실 실패를 다시 확보했다. 수정 후 관련22개 통과 및 최종 신규8개 3회 반복24개 통과, 별도 production preview의320/1440px에서 답변 왕복 보존·가이드 공개 페이지 이동/재개방·Escape 포커스·pageerror 0건을 확인했다. 직접 캡처 검수에서320px 저장 알림과 고정 메뉴의 겹침을 추가 발견해860px 이하 안내 상단 여백만 교정했다.320/768/1440px 재검수와 메뉴/안내 좌표·가로 넘침 회귀를 추가했다. `/tmp/teth-delegation-warning-320.png` 등은 임시 검수 캡처이며 제품 자산이 아니다.

impeccable harden을 원본 보존형 오류·화면 이탈·반응형 검수에 적용하고, front-gemini의 현재 agy 경로 지시에 따라 `gemini-3.8-flash-high`로 가이드 범위 검토 및 저장 허용 목록/삭제/가이드 재검수를 진행했다. 모델 의견은 재현·자동화 증거와 구분하며 최종 운영 승인을 대체하지 않는다. 최종 전체 결과는 아래 최신 회귀 요약을 따른다. 실제 서비스/전문 차트 연결과 기존 원인 미확정 구형 퍼널 클릭 위험은 이번 수정으로 해결됐다고 보지 않는다. local in_review를 유지한다.

저장 실패·문서 왕복 후속 검수(2026-09-08): 브라우저 쓰기 실패 시 연구→대화→연구 왕복에서 문서 질문/수정값/기록이 소실되는데 안내가 없던 결함과, 저장소 정상 여부와 관계없이 문서 탭 전환 시 행 코멘트 초안이 비워지던 결함을 재현했다. `client-research-cache.ts`가 문서별 직렬화된 UI 상태를 현재 페이지 메모리에 보관하고 저장 성공 여부를 반환한다. 기존 컴포넌트 상태와 같은 정보만 보관하며 실제 인증·결제·API 키 입력은 대상이 아니다. 정상 저장 복구·연구별 격리·세션 삭제 시 임시 보관 해제까지 검증한다. 메모리 보관은 새로고침·새 탭·다른 기기 복원을 보장하지 않으므로 실패 시에만 기존 안내 영역에 복사 권고를 표시한다. `rowDrafts`는 문서ID/행 라벨로 분리하고 취소·접기·탭/대화 왕복에서는 유지, 실제 전송 성공 시에만 해당 초안을 비운다.

설정의 부분 저장 결함도 재현했다. 언어 저장이 실패한 뒤 통화만 저장되면 이전 실패가 지워지고 설정창이 닫혔다. 이제 미저장 선택만 추적·재시도하고 전부 저장 확인된 경우에만 닫는다. 다른 탭의 관련 storage 이벤트에서도 미저장 선택은 유지한다. 기존 저장 키·원본 선택지/언어 문구는 유지하며, 실제 계정 환경설정 API 계약이나 교차 기기 동기화를 새로 정하지 않는다.

검증: 신규 `client-research-storage.spec.ts` 3종×2프로젝트(6개), `client-preference-recovery.spec.ts` 1종×2프로젝트(2개). 최초 연구2개 및 설정1개 실패를 확보했다. 수정 후 관련48개, 격리/삭제·원본 연구 관련30개, 최종 설정/연구 저장 관련24개를 통과했다. 연구 쓰기·읽기 차단, 저장 권한 복구·새로고침, 초안 분리·성공 시 초기화·삭제, 부분 설정 저장·합성 storage 이벤트를 포함한다. 실제 다중 브라우저/실기기 인증 증거로 확대하지 않는다. 별도 production preview의320/1440px에서 문서/행 초안 왕복 보존, 저장 실패 안내·닫기·가로 넘침 없음·pageerror 0건을 확인하고 `/tmp/teth-storage-warning-320.png`를 직접 검수했다.

impeccable harden은 원본 보존형 오류 복구·가독성 검수에 적용했다. agy `gemini-3.8-flash-high`는 연구 저장/행 초안 검토와 수정 후 재검수, 설정 pending/sync 제한 재검수를 수행했다. 코드 외 호출부가 필요한 사항은 직접 자동화로 검증했으며 모델 의견을 최종 승인으로 삼지 않았다. 저장 안내는 agy의 짧은 문장 제안을 반영했다. 전체 최종 결과는 아래 최신 회귀 요약을 따른다. 기존 구형 퍼널의 원인 미확정 간헐적 클릭 위험은 이번 변경으로 해결됐다고 간주하지 않는다. local in_review이며 실제 서비스 연결·운영 승격과 별도다.

상태 경계 재검수(2026-09-08): 추가 검수 요청에 따라 정상 동선과 손상 캐시를 구분해 아래 결함을 재현·교정했다. 원본 문구·화면 구조·실제 서비스 계약은 유지한다.

| 영역 | 재현된 결함 | 교정·합격 기준 |
|---|---|---|
| 설정 계층 | 데스크톱 초기 포커스가 숨은 grab 버튼으로 향함. 모바일 하위 메뉴 진입·Tab·Escape 후 숨은 항목/BODY로 이탈 | 보이는 컨트롤만 초기/순환 대상으로 삼고 명시적 하위 메뉴 진입·복귀 포커스 지정. hover는 포커스를 빼앗지 않으며 640px 경계 전환 시 숨은 뒤로가기 대신 보이는 항목으로 복원 |
| 연구 입력 | 행 코멘트 전송이 별도 하단 문서 질문 초안까지 비움 | 보낸 입력만 초기화. 행 코멘트·문서 질문의 초안 생명주기를 분리하고 새로고침/실제 질문 전송까지 확인 |
| 부분 손상 대화 | 단일 턴의 잘못된 suggestions 때문에 정상 턴·초안이 있는 세션 전체 탈락 | 세션 헤더와 개별 턴 검증 분리. 정상 턴·대화/홈 초안·선택 세션 보존, 손상 제외는 기존 복원 알림으로 고지 |
| 불일치 진행 상태 | 최신 answer=fullAnswer인 running 턴, 이전 running 턴 또는 빈 응답의 running 상태가 새 전송을 막음 | 최신 유효 응답은 완료 상태 전이를 생략하지 않음. 불일치 이전/빈 응답은 기존 텍스트를 보존한 stopped로 복구하며 내용을 만들어 완료하지 않음 |
| 행 코멘트 포커스 표시 | 320px에서 버튼 오른쪽39px + 외부 outline5px가 라벨 시작40px와 겹침 | 2px outline을 버튼 내부에 표시. 기존 버튼 크기·라벨 위치 유지, 320/390/768/1440px에서 페인트 영역과 라벨 사이 최소1px 확인 |

검수 루프: 최초 설정/독립 초안3개와 캐시4개 테스트의 실패를 각각 확보한 뒤 수정했다. 첫 관련14개, 캐시 및 반응형 보완 후 관련60개가 통과했다. 신규 `client-state-boundaries.spec.ts`는 8종×2프로젝트(16개)이며 키보드·회전·초안·손상/불일치 복원과 후속 전송을 검증한다. agy `gemini-3.8-flash-high`의 read/validTurn/tick 제한 검수에서 캐시2범주를 제안받아 재현했고, 수정 후 동일 범위 재검수도 수행했다. 잘못된 자동 파일 링크는 근거로 사용하지 않았다. impeccable harden 기준은 원본 보존형 오류 복구·접근성에만 적용했다.

별도 production preview에서 320/390/768/1440px 설정 계층의 보이는 포커스·Escape 복귀·가로 넘침 없음, 320px 연구 코멘트/문서 질문 초안과 정상 대화/초안의 왕복·새로고침 보존 및 pageerror 0건을 확인했다. 최초 저장 검사의 즉시 persist 가정은 실제 화면 이동/저장 시점으로 교정했다. 캡처 `/tmp/teth-settings-focus-320.png`, `/tmp/teth-independent-drafts-320.png`를 직접 확인했다. 포커스 outline 겹침은 이 캡처에서 찾아 추가 교정했다. 전체410개 최초 실행은 구형 `dashboard.spec.ts` 추천 전략 클릭 후 ATR 버튼 대기에서1건 시간 초과(389통과·20건너뜀)였다. playwright-trace에서 해당 클릭의 스크롤/위치 불안정·포인터 가로채기 재시도와 브라우저 오류 없음은 확인했지만 단독 원인 확정으로 간주하지 않는다. 해당 구형 테스트는 동일 코드로 단독3회 연속 통과했다. 원인이 확정되지 않은 간헐적 클릭/스크롤 위험은 남겨 추적하며 단순 재통과를 수정 완료로 표현하지 않는다. 최종 전체 결과는 아래 최신 회귀 요약을 따른다. outline 교정 후 별도 빌드 미리보기에서 라벨 간격은320/390px 각1px, 768/1440px 각4px였고 `/tmp/teth-comment-outline-320.png`를 직접 확인했다. 실제 API·실기기·운영 Go/No-Go는 별도다.

후속 코드 리뷰 반복 교정(2026-09-08): 사용자 승인한 공개 경로 복귀 시 사이드바 스크롤 잠금 잔류와 손절/익절 숫자 부분 일치 오류를 수정했다. `ClientChrome`은 popstate/내부 경로 전환에서 드로어를 닫고 overflow/inert를 복원한다. 화면 너비 변경 후에는 숨은 이전 버튼 대신 보이는 메뉴 버튼으로 포커스를 복귀시킨다. `client-percentage-input.ts`는 입력 전체를 검사하며 `3%에서 2%로 변경해주세요`, `1,000%`, `2..5%`를 임의의 3/0/0.5%로 적용하지 않는다. 오류 시 이전 값·초안·포커스를 유지한다. 단일 유한 수치와 짧은 변경 요청, 전각 숫자는 지원하고 비유한 값·0으로 소실되는 지수는 거절한다. `%` 없는 문장은 기존 코멘트로 남으며 수치 적용 성공으로 표시하지 않는다. 이는 로컬 UI 파서이지 실제 거래 한도/위험 검증 계약이 아니다.

검수 루프는 세 차례 진행했다. 1차 수정 후 관련42개 검사를 통과했다. 2차 대화 분기 검수에서 `12%`가 손절2%로 오인되는 재현을 확보하고, 익절18%/부정문도 기존8%/미설정 선택으로 처리하지 않도록 교정했다. 원본 선택지와 카피는 유지하며 관련72개 검사와 lint/build를 통과했다. 3차 agy `gemini-3.8-flash-high`의 좁은 읽기 전용 파서 검수에서 `2.%` 허용과 `Infinity%로 변경해주세요` 오류 안내 불일치를 보완했다. `%` 없는 문장의 코멘트 처리는 적용 오표시나 입력 손실이 아니므로 유지했다. impeccable harden 기준은 원본 디자인 변경 없이 오류 복구·초안 보존·포커스 검증에 적용했다.

신규 `tests/client-navigation-input.spec.ts` 9종×2프로젝트(18개)는 엄격한 수치 입력·정정, 공개 페이지 왕복/실제 스크롤, 390/768/1440px 드로어와 너비 변경 포커스, 대화 손절/익절 분기를 검증한다. 전체394개 중374개 통과·20개 조건부 건너뜀(실패0)을 확인했다. 별도 production preview의 390/1440px 뒤로가기 후 스크롤 잠금 해제·실제 스크롤·초안 복귀, 320px 오류줄/버튼 배치·정정 성공·가로 넘침 없음·pageerror 0건을 확인했다. 검수 캡처는 `/tmp/teth-numeric-confirmation-320.png`이며 영구 제품 자산이 아니다. 최신 경계값 보완 후 최종 재실행 결과는 아래 최신 전체 회귀 요약을 따른다. 실제 API·실기기·거래 정확성·운영 Go/No-Go 범위로 확대하지 않는다.

사이드바 순서 변경 및 코드 리뷰(2026-09-08): 사용자 요청에 따라 펼친 사이드바 하단만 로그인/계정을 왼쪽, 설정을 오른쪽으로 배치한다. 접힌 레일의 설정→계정 순서는 유지하고 CSS order 대신 keyed DOM 순서를 바꿔 Tab 순서도 시각 순서와 일치시킨다. 기존 첫 번째 버튼에 의존하던 설정 회귀는 동작/접근성 이름으로 교정했다. 비회원·회원, 320/390/768/861/1440px의 순서·좌표·Tab/Shift+Tab·클릭과 접힌 상태를 `client-sidebar-alignment.spec.ts`에서 검증한다. production preview 390/1440px 캡처에서도 위치·오류 없음을 확인했다. 최초 전체 실행에서 위치 기반 설정 선택자 10건이 실패해 동작 기반으로 교정했다. 변경 후 전체348개 중328개 통과·20개 조건부 건너뜀(실패0), lint/TypeScript/build를 통과했다.

추가 코드 리뷰 범위: 기본 진입/DEV 레거시 경계, 사이드바·계정·환경설정, 대화/composer·세션 저장, 연구 workspace/preview·차트·공유/기록, 위임 입력·민감값 저장 제외, 공개 페이지·다운로드의 이벤트/타이머 정리를 확인했다. 실제 backend/전문 차트 별도 worktree의 재검토나 전체 실서비스 보안 인증은 아니다. 기존 6건의 교정 상태와 전체 회귀를 재검증하며, 추가 3건은 후속 사용자 승인으로 아래와 같이 교정했다.

| 우선순위 | 확인한 추가 결함(로컬 교정) | 재현과 수정 내용 |
|---|---|---|
| P1 | 전체 화면 입력의 native dialog가 로그인/공개 경로를 가림 | 기존 전체 화면→＋→로그인에서 이메일 클릭 불가, 공개 경로 뒤로가기에서도 dialog 잔류. handOff에서 native dialog를 먼저 닫고 공개 경로 전환에서도 제거한다. 작성 초안은 유지하며 입력창에서 연 로그인 종료 시 논리적 입력 포커스를 복원한다. 전송·2단계 Escape·공개 경로 왕복을 검증한다. |
| P2 | 비유한 손절/익절 수치를 적용 성공으로 표시 | 기존 400자리 숫자+%가 `−Infinity%`로 적용됨. Number.isFinite와 인라인 오류/aria 연계를 추가하고 이전 값·오류 입력은 보존한다. 빈 적용은 비활성, 취소·접기 초안은 유지, 성공 시만 입력을 비운다. 기존 비유한 저장값도 제외한다. 실제 거래 한도 정책은 정하지 않는다. |
| P2 | 문서 캐시의 active/tabs 관계 검증 누락 | 기존 active=bt2, tabs=[plan]에서 선택 탭0개. 현재 생성 시점에 열린 문서만 복원하고 중복·잘못된 ID를 제거한다. 5개 상한 안에서 활성 탭을 반드시 포함하며 잘못된 활성 문서는 Plan으로 복구한다. 초안·정상 편집값은 보존한다. |

agy `gemini-3.8-flash-high`의 최초 연구 캐시 검토 중 active/tabs 불일치는 브라우저로 확인했다. 빈 탭 NaN/크래시 주장은 일반 키보드 진입으로 확인하지 못해 크래시로 보고하지 않았고, 스크롤 ref 지연 주장은 onScroll이 ref를 즉시 갱신하므로 채택하지 않았다. 수정 후에는 인라인 폼만 읽기 전용으로 검토했다. 빈 입력의 무반응과 취소/접기 초안 초기화 지적은 적용 비활성 및 기존 초안 보존으로 보완했다. 320px 버튼 줄바꿈 우려는 전체 CSS/브라우저에서 재현되지 않아 디자인을 바꾸지 않았다.

수정 후 독립 병렬 검수: `review_composer_fix`는 390/1440px의 native dialog·로그인 포커스·Tab 순환·Escape·전송·공개 경로 왕복을, `review_research_fix`는 320/1440px의 큰 숫자·오류 정정·일반 코멘트·캐시 손상·문서 시점·키보드 탐색을 읽기 전용으로 검수했다. 1차 검수에서 로그인 종료 포커스가 사이드바로 돌아가는 P3를 찾아 입력창 복귀 대상으로 보완한 뒤 두 에이전트가 재검수해 범위 내 추가 결함이 없음을 확인했다. 신규 `client-review-hardening.spec.ts` 14종×2프로젝트(28개)는 보완 후 통과했다. 전체376개 중356개 통과·20개 조건부 건너뜀(실패0), lint/TypeScript/production build를 통과했다. production preview 320/1440px에서도 로그인 종료 입력 포커스, 오류줄 위치·버튼 정렬·가로 넘침 없음·pageerror 0건을 확인했다. 첫 production 검수의 연구 fixture 주입은 pagehide 저장에 덮여 경로를 찾지 못했으며, 초기화 시점 주입으로 교정해 재확인했다. 실제 인증/API, 실기기 Safari·스크린리더, 전체 서비스 Go/No-Go는 범위 밖이며 local in_review다.

전수검수 결함 수정(2026-09-08): 부분 손상 시 전체 세션 초기화, 불규칙 표본의 포인터 X 오차(734px 차트에서 약45px), 차트 키보드 조회 누락, 유형 확정 전 제목 고정, 인증 재전송의 tick 누적 대기, 공개 페이지 뒤로가기 후 포털 잔류를 수정했다. 원본 디자인/fixture를 유지하고 복원 실패 안내와 차트 포커스만 보완한다. `tests/client-audit-fixes.spec.ts` 9종×2프로젝트(18개)가 정상/손상 currentId·새로고침·안내 닫기, 자동/사용자 제목, 세 너비의 포인터와 키보드/매매 정보, 재전송/숨김 복귀, 로그인/언어 포털 뒤로가기를 검증한다. 최초 실행의 모바일 언어 버튼 경로 오류 1개는 실제 설정 메뉴 경로로 교정했다. 이후 신규18개, 전체344개 중324개 통과·20개 기기별 조건부 건너뜀(실패0), lint/TypeScript/build를 통과했다. 실제 인증·서비스 계약은 변경하지 않았으며 local in_review를 유지한다.

별도 production preview에서 부분 손상 복원, 재전송 경과 시간, 공개 페이지 뒤로가기 포털/inert 해제를 재검증했다. 390/768/1440px의 차트 70% 지점 포인터-최근접 표본 차이는 각각−0.6/+0.5/+0.7px였다. 차트 포커스 캡처의 겹침/가로 넘침·pageerror는 없었으며, 320px 복원 안내의 화면 내부 배치·닫기·초안 유지도 확인했다. 이는 고정 fixture의 좌표 정확성 증거이며 실제 백테스트 결과나 실기기 낭독기 인증이 아니다.

agy `gemini-3.8-flash-high`로 차트 범위의 읽기 전용 검수와 재검수를 수행했다. 키보드 재진입 시 조회 위치 보존, Holdout·포지션 보유 상태 전달을 보완하고 자동 검사로 검증했다. 불규칙 표본을 방향키로 순회하는 것은 없는 봉 가격을 생성하지 않기 위한 의도이며 첫/끝 표본(0/1334)이 실제 존재함을 확인했다. 포인터/키보드는 가장 최근 입력의 조회 지점을 공유한다. 모델의 잠재적 배지 겹침 제안은 세 너비 캡처에서 재현되지 않아 원본 위치를 유지했다. impeccable harden 기준으로 상태 복원·접근성을 보완했으며 디자인 재창작이나 운영 Go/No-Go 검수는 아니다.

화면 이탈 연속성 검수(2026-09-08): `mock-research-preview`의 visibility/pagehide/unmount 자동 pause와 복원 시 paused 처리, 대화 read의 running→stopped 처리를 확인해 제거했다. 시작 시각 기반 복원과 타이머 없는 세션 캐시를 적용했다. 일반 화면 재생 조작부를 제거하고 원본 본문·환경 경계는 유지했다. 위임의 단계별 timeout 누적도 시작 시각 기준으로 바꿨다. `tests/client-background-progress.spec.ts` 9종×2프로젝트(18개)가 통과했다. 숨김 렌더 정지/복귀, 연구 기록 완료, 새 전략·새로고침·공개 페이지 왕복, 명시적 중지, 저장 차단 시 메모리 복원, 옛 자동 정지 캐시, 위임 검증을 포함한다. 초기 실행의 로그인 fixture 누락은 테스트 준비를 교정했고, 이후 화면 완료와 저장값 사이 250ms 지연 4개를 재현해 완료 전이를 즉시 저장하도록 보완했다.

production preview에서는 DEV query를 주어도 재생 조작부가 0개임을 확인했다. Chromium CDP 실제 frozen→active 후 bringToFront 왕복으로 완료 상태 복원을 확인했고 390/768/1440px 계획 화면의 가로 넘침과 pageerror는 0건이었다. 초기 브라우저 동결 점검에서 이미 최종 보고서로 전환된 뒤 일시적 완료 버튼만 기다린 검수 오류는 영속 완료 상태 확인으로 교정했다. 합성 visibility E2E와 실제 Chromium lifecycle 점검을 구분하며 iOS/Safari 실기기 검증으로 표현하지 않는다.

전체 회귀에서 추가로 발견한 문서 스크롤 복원 결함: 재생 footer 제거 후 넓어진 본문에서 글꼴·입력창 높이가 확정되기 전에 저장 위치120px가102px로 잘렸다. 폰트 준비 후 위치를 다시 맞추고, 준비 중 임시 scroll 이벤트로 원래 위치를 덮어쓰지 않도록 교정했다. 사용자가 휠·터치·포인터·키보드로 문서를 조작하면 자동 재보정을 취소한다. 기존 읽기 위치/회전 검증을 desktop/mobile 각각3회 반복해6개 모두 통과했다.

agy `gemini-3.8-flash-high` 읽기 전용 검수 두 차례를 사용했다. 자동 pause/강제 stop과 완료 시각 왜곡을 확인했다. 후속 ID 불일치/flush 누락 지적은 실제 Workspace의 `restored:` 인자와 Main의 pagehide flush로 반증했다. 원본 반초 이벤트를 최대 1초 표시 주기로 관찰하는 특성은 고정 fixture의 렌더 간격이며 저장된 경과량을 되감지 않는다. 검수 모델 의견을 자동 승인으로 삼지 않았다. impeccable harden 기준으로 연속 사용·중지·저장 실패·반응형을 검사했으며 디자인 재창작은 하지 않았다.

전체 주요 화면 디테일 후속(2026-09-08): 원본 레이아웃·문구·색상 체계를 유지하며 화면별 캡처→결함 재현→최소 수정→다중 크기 재검수를 진행했다. 아래는 수정과 점검을 구분한 범위다.

| 영역 | 이번 확인·수정 | 검수 범위와 한계 |
|---|---|---|
| 홈·대화 | 홈 배치 점검, 경과 시간 한글 fallback·완료 아이콘 중앙·후속 행동/입력 안내 대비 수정 | 390/768/1440px 캡처, 기존 초안·스트리밍·스크롤 회귀. 전체 언어 자유 대화 번역을 새로 구현한 것은 아님 |
| 연구 계획·Activity·Critic·결과 문서 | 비선택 탭·지표 라벨·팀 상태·표 머리글 대비 보강, 차트 좌표계와 표시 크기 분리, 낮은 화면의 긴 입력으로 본문 높이가 0이 되던 결함 수정 | 320~1440px 및 600/1100px 경계, 높이280/360/480px 검사. 390×280 긴 초안에서 본문 57.86px 확보. 고정 원본 사례이며 실제 백테스트 연동 아님 |
| 기록·예약·랭킹·공유 | 헤더/복귀 버튼·모바일 행 배치·빈 상태 점검, 불필요한 재디자인 없음 | 로그인된 새 기본 앱에서 320/390/768/861/1440px 정렬 검사. 공유/예약 실서비스 검증과 구분 |
| 전략 위임·검증·리포트·연결 | 태블릿 601~860px 메뉴와 뒤로가기 겹침 수정, 연결 입력 16px | 계약/보고서/연결 화면의390/768px 캡처와 관련 fixture 동선 회귀. 실제 거래소·결제 수행 없음 |
| 설정·계정 | 설정 시트·왕복 점검, 태블릿 인증 입력 16px·placeholder 대비 보강 | 390/768px 및 기존 짧은 화면/언어·통화/인증 회귀. 실기기 키보드 검수는 미완료 |
| 소개·다운로드·정책 | 소개 스크롤 초기에 불투명 헤더로 바꿔 본문/로고 겹침 수정, 기능 소개·요금제·FAQ·휴대폰 데모·정책 배치 점검 | 390/768/1440px 진입, 모바일 하단 섹션 직접 캡처와 기존7언어·캐러셀·정책 회귀. 모든 번역/확대 조합의 시각 대조 완료 아님 |

`tests/client-visual-detail.spec.ts`는 8종×2프로젝트의 추가 검증이다. 최초 폰트/아이콘·차트·대비6개, 짧은 높이/태블릿 입력4개, 소개 헤더2개, 위임 헤더2개의 실패를 재현했고, 반복 수정 중 낮은 화면의 본문 확보를 다시 교정했다. 차트는 `ClientResearchChart`로 분리하며 ResizeObserver의 너비 변경에만 표시 좌표계를 갱신한다. 기존 fixture·거래 수·수익/비용·주문 권한은 변경하지 않았다. agy `gemini-3.8-flash-high`는 연구 CSS의 좁은 읽기 전용 검수만 수행했다. 임의 타임스탬프 형식이나 재현되지 않은 표 잘림 등 추정 의견은 자동 반영하지 않았다. impeccable은 디자인 재창작이 아니라 원본 보존형 가독성·시인성 검수에 적용했다.

2026-09-08 시각 정렬 후속: 기능 회귀 중심의 이전 검수가 사이드바 세부 정렬을 놓친 것을 확인했다. 문장 안 로그인 버튼에 공통 44×44px 규칙이 적용되어 본문이 64.8px로 늘고 첫 줄이 SVG보다 내려갔다. 인라인 동작의 크기 예외와 원본 점선 밑줄을 적용해 41px의 자연스러운 두 줄로 복원했다. 접힌 레일의 중심축 2px 차이, 긴 계정 이름의 넘침, 모바일 서비스 메뉴의 중간 배치를 함께 수정했다. 원본 문구·SVG 경로·주요 클릭 영역은 유지했다.

재현→교정→재검수 증거는 `tests/client-sidebar-alignment.spec.ts`다. 처음 4종×2프로젝트가 모두 실패했고 교정 후 하단 배치/짧은 높이 검증을 더한 10개와 관련 셸·설정·계정·연구 메뉴·연속성 검사를 합한 80개가 통과했다. 320/390/768/860/861/1440px와 7언어를 검사했고 desktop/mobile 전후 캡처를 직접 확인했다. lint·TypeScript·production build 통과, 빌드 미리보기의 안내 첫 줄/SVG 중심 차이 0px·pageerror 0건도 확인했다. 원본 점선 밑줄의 2.5px 장식 영역과 브라우저의 native button inline-block 계산을 테스트에 반영했다. agy `gemini-3.8-flash-high`는 읽기 전용으로 중심축·이름 넘침을 독립 점검했다. 버튼 축소와 미재현 메뉴 간격 제안은 채택하지 않았다. impeccable은 원본 보존형 정렬 검수에 적용했다. 이는 사이드바 중심의 로컬 검수이며 전 화면 시각 완성·실기기·운영 승인이 아니다.

최신 전체 회귀는 476개 중 456개 통과, 20개 조건부 건너뜀, 실패 0개다. 신규 로드 실패/조합 입력 회귀18개·교차 화면/긴 동선 회귀22개·10회 검수 회귀10개·위임 경계 회귀8개·저장 실패 회귀8개·상태 경계 회귀16개·경로/수치 입력 회귀18개·오류/복원 회귀28개·사이드바 순서 회귀4개·전수검수 결함 회귀18개와 기존 연속성 검증18개·디테일 검증16개를 포함하며, 보존된 구형 퍼널 테스트도 포함된 합계이므로 새 UI만의 합격 수치로 표시하지 않는다. lint, TypeScript와 production 빌드를 통과했고, 별도 production preview에서 기본 진입·구형 fixture 비활성·소개/다운로드/정책의 가로 넘침 없음·태블릿 위임 메뉴/뒤로가기 분리·pageerror 0건을 확인했다. 실제 서비스 연결·실기기·배포 합격을 뜻하지 않는다.

직접 320/390/768/1024/1440px의 연구·위임·계정·소개·다운로드 화면과 모바일 무료/유료 오류 재시도를 확인했다. 추가 검수에서는 601/640/768/860px의 메뉴·뒤로가기 클릭 영역, 768×280px의 설정 하위 메뉴, 모바일 연구 계획/Activity의 읽기 대비를 캡처로 확인했다. production preview에서 원본 기본 진입과 `legacy-fixture` 비활성, 연구 계획/진행 및 공개 페이지의 실행 오류·가로 넘침을 점검했다. 이 결과는 로컬 UI 검수 인계이며 운영 승인이나 실제 서비스 통합 완료가 아니다.

agy `gemini-3.8-flash-high`는 제한된 읽기 전용 간격/가독성/일관성 점검에 사용했다. headless 명령 권한 거부가 있었던 호출은 권한을 바꾸지 않고 제공한 코드만 검수하는 방식으로 재실행했다. 콜백 호출 불능·숨긴 배너 겹침 등 재현되지 않은 추정은 채택하지 않았다. 검증된 도움말 focus, 세션 선택, 모바일 헤더·드로어·차트 축 문제를 보완했다. impeccable은 원본 재창작이 아니라 가독성·접근성 검수에만 적용했다.

추가 개선 루프는 원본 디자인을 유지한 채 결함 재현→최소 수정→재검증 순서로 진행했다. 첫 루프에서 대화/기록·세션 왕복 스크롤 손실, 제목 40/120자 제한 불일치, 키보드 포커스·메뉴 탐색을 재현한 8개 테스트가 실패 후 통과했다. 두 번째 루프에서 320–860px 연구 헤더의 실제 클릭 영역 겹침, 280px 높이 설정 잘림을 재현해 수정했다. 세 번째 루프에서 문서 새로고침의 브라우저 자동 스크롤 보정 충돌, 입력창 회전 시 높이, 문서 선택 후 포커스, 필수 설명 4.5:1 대비를 검증했다. 대화 뷰포트는 세션별 비민감 UI 상태로 저장하며 스크롤마다 React를 렌더하지 않고 저장은 250ms로 묶는다. pagehide·화면 이탈 시 현재 값을 보존한다. 연구 재생 캐시의 `restored:` 접두사도 삭제 대상 ID와 일치시켰다.

agy의 추가 두 차례 코드 검수 중 스크롤 재마운트·제목 포커스·새 응답 오표시는 재현 후 보완했다. `pagehide` flush 누락과 완료 spacer 유실 지적은 상위 flush/언마운트 캡처 및 즉시 새로고침 테스트로 반증됐으며, 기본 대화의 비대화 탭 오염은 해당 callback을 사용하는 경로에 비대화 탭이 없어 현재 재현되지 않는다. 응답 중 초안 작성을 막는 제안은 의도된 후속 입력 경험을 보존하기 위해 채택하지 않았다. 검수 모델 의견을 자동 승인으로 취급하지 않는다.

원본 코드 대조, 화면 캡처, 자동 테스트는 실제 백테스트 정확성·실시간 데이터·iOS/Safari 실기기·스크린리더·법률·공개 배포 Go/No-Go를 대체하지 않는다. 로컬만 변경하며 commit/push/운영 승격은 수행하지 않는다.
<!-- QA_HISTORY_END -->
