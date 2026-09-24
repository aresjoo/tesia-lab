# QA_SCENARIOS — 11 시나리오 프리셋·기대값·진척판 (QA 패널 구현 정본)

## 프리셋 (스냅샷 통째 교체: tfQaPreset(id))
공통: tfDevReset() 상당의 완전 초기화(bill, cp, termClones, termDemo, follows, shared, G.sessions 포함) 후 아래를 set. 로그인은 `{name:'김도현',email:'demo@teth.ai'}`. 거래소는 bitget.

| id | 로그인 | UID | API | 카드 | AI 사용(bcMonthSpend) | 거래 충전(bcMonthVol) | 기타 |
|---|---|---|---|---|---|---|---|
| 01 guest | ✗ | | | | | | |
| 02 signed | ✓ | ✗ | ✗ | ✗ | 0 | 0 | freeUsed 3 |
| 03 linked-zero | ✓ | ✓ | ✓ | ✗ | 0 | 0 | |
| 04 linked-low | ✓ | ✓ | ✓ | ✗ | 300 | 600 | |
| 05 linked-high | ✓ | ✓ | ✓ | ✗ | 300 | 2000 | |
| 06 plan-high-unlinked | ✓ | ✗ | ✗ | ✓ | 2500 | 0 | |
| 07 plan-low-unlinked | ✓ | ✗ | ✗ | ✓ | 200 | 0 | |
| 08 plan-high-high | ✓ | ✓ | ✓ | ✓ | 2500 | 2000 | |
| 09 plan-high-low | ✓ | ✓ | ✓ | ✓ | 2500 | 600 | |
| 10 plan-low-high | ✓ | ✓ | ✓ | ✓ | 200 | 2000 | |
| 11 plan-low-low | ✓ | ✓ | ✓ | ✓ | 200 | 600 | |

오버레이(토글, 프리셋 위에 얹음): `활성 전략 1개`(검증 통과 전략 생성 + tfStartStrategy) / `데모 preview` / `판단 로그 채움` / `결제 실패`(simPayFail) / `크레딧 다 씀`(freeUsed=quota, balance 0) / `관망`(watch).

## 기대값 표 (패널에 표시, PASS/FAIL 저장 키 `teth.qa.results`)
| id | 기대 1차 CTA | 청구 | AI 자격 | 거래소 | 터미널 모드 | 확인 화면 |
|---|---|---|---|---|---|---|
| 01 | 무료로 시작 | 없음 | 없음 | 미연결 | guest | #/trade, 따라하기, 거래소 연결 |
| 02 | 대표 전략 모의로 켜보기 | ₩0 무료 체험 | 무료 N회 | 미연결 | inactive | #/trade, 이용 현황 |
| 03 | 이 전략 실행하기 / 모의로 켜보기 | ₩0 | 가능 | 연결됨 | inactive | #/trade, 이용 현황, 거래소 연결(연결됨) |
| 04 | 터미널/실행 | 공식(부족분) | 가능 | 연결됨 | inactive | 이용 현황(상쇄 바 부분) |
| 05 | 터미널/실행 | ₩0 상쇄 | 가능 | 연결됨 | inactive | 이용 현황(충당 문구) |
| 06 | 거래소 연결 | 플랜+추가 | 가능 | 미연결 | inactive | 이용 현황(절약 안내), 거래소 연결 |
| 07 | 실행 | 플랜 | 가능 | 미연결 | inactive | 이용 현황(배너 없음) |
| 08 | 실행 | 공식 | 가능 | 연결됨 | inactive | 이용 현황 |
| 09 | 실행 | 공식(차액 큼) | 가능 | 연결됨 | inactive | 이용 현황(인라인) |
| 10 | 실행 | ₩0 대신 냄 | 가능 | 연결됨 | inactive | 이용 현황(축하 1회) |
| 11 | 실행 | 공식 | 가능 | 연결됨 | inactive | 이용 현황 |

## 진척판 (localStorage `teth.qa.progress`, 값 NOT_STARTED/IN_REVIEW/PASS/FAIL)
1 AI 트레이딩 게스트 · 2 AI 트레이딩 로그인 · 3 활성화(연결·결제) · 4 터미널 · 5 전략 따라하기 · 6 전략 상세 · 7 거래소 연결 · 8 11 상태 · 9 데스크톱 QA · 10 모바일 QA

## 노출 규칙
QA 버튼 생성 조건: `location.hostname==='localhost'||location.hostname==='127.0.0.1'` 또는 `localStorage.tethDev==='1'`. 프로덕션(github.io)에서는 `?qa=1`만으로는 미노출. 기존 원시 토글 9개는 "고급" 접힘에 유지.

## 자동 검증 (scratchpad/pw/crawl.mjs 확장)
11 프리셋 × {#/trade, 이용 현황, 거래소 연결} × 3뷰포트 스크린샷 + JSON(derive 결과 덤프). 콘솔 예외 0. 사용자 여정 6개(게스트→탐색→가입 / 로그인→만들기→검증→활성화 / 연결→완료→터미널 / 카드→완료→터미널 / 따라하기→상세→설정→터미널 / 만들기→검증→실행→터미널).
