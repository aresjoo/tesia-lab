# CODEX 반박 — 제품 결정과 실행 상태의 계약

작성: 2026-09-24 · Principal Product Engineer + State-machine Architect.

**판정: 화면 단순화는 진행하되, 그 과정에서 서로 다른 사실·실행 방식·데이터 출처를 합치면 안 된다.** 아래는 미구현 설계와 코드 검토 결과다. 제품 코드·설정·다른 문서는 수정하지 않는다. 컴플라이언스·보안 평가는 다루지 않는다.

근거 약어와 읽은 문서:

- **C**: [CLAUDE_PROPOSAL.md](CLAUDE_PROPOSAL.md).
- **A**: [AGY_PROPOSAL.md](AGY_PROPOSAL.md).
- **R**: [CLAUDE_REBUTTAL_TO_AGY.md](CLAUDE_REBUTTAL_TO_AGY.md).
- **P**: [CODEX_PROPOSAL.md](CODEX_PROPOSAL.md), 내 이전 제안.
- **F**: [CODEX_PHASE1_FINDINGS.md](../current/CODEX_PHASE1_FINDINGS.md).
- **I**: [index.html](../../index.html). `I:Lx–y`는 이번에 다시 읽은 코드 행이다. SHA-256은 `38014c3867de7a9d8fb65567dff999c8081e39128476b0c03525d17f459c558d`로 F·P와 같다. 물리 행은 17,728개이며 마지막 개행 뒤 빈 문자열까지 세면 17,729개다.

재현은 별도 표시하지 않으면 **코드에 근거한 재현 절차와 예상 결과**다. 이번에 브라우저를 실행해 확인했다는 뜻이 아니다. `격리 실행`은 원본 함수를 Node VM에서 읽고 메모리 fixture로 확인한 경우만 표시한다. 제안에 아직 없는 기능의 문제는 ‘현행 버그’가 아니라 ‘그대로 구현할 때 생기는 회귀’로 구분한다.

R:L28,44–45에서 Claude가 이미 수용한 UID/API 분리, 미분류 허용, preview 격리, 무료 소진 시 AI 게이트는 반박 건수로 재사용하지 않는다. 아래는 그 수정 뒤에도 남는 오류·미완성 계약이다.

## 1. Claude 제안: 상태 논리·라우팅·데이터 모델 반박 10건

### C01. 30일은 성과 출처를 바꾸지 않는다

- **[결정]** C:L95–97, R:L19의 ‘30일 미만은 검증 기준, 이상이면 라이브 수치’는 기각한다.
- **[무엇이 깨지나]** ①–⑪의 탐색·상세. 42개월 백테스트만 있는 `tfRankSeeds()`를 운용 기간으로 판정하면 라이브로 승격되고, 실제 7일 운용 자료는 백테스트로 강등된다. `tfRankSeeds`는 `runBacktest` 결과만 만든다(I:L10965–10981). `cpMeta.days`도 닉네임 해시로 만든 값이다(I:L11205–11210). 기간이 길어도 실제 운용 자료라는 증거가 아니다.
- **[수정안]** `performance.source=backtest/paper/live`, `periodStart/end`, `sampleCount`, `asOf`, `strategyVersion`을 별도로 둔다. ‘실운용 7일·표본 적음’과 ‘백테스트 42개월’을 그대로 표시한다. 30일은 자료 충족도·정렬 자격 기준으로만 사용한다. 현재 시드는 모두 검증 자료다.

### C02. 규칙 로그 예시가 실제 판정식과 다르다

- **[결정]** C:L87의 `RSI(14) ≤ 44`, `SMA20>SMA60`를 기존 규칙의 설명으로 적용하지 않는다. R:L18의 이름 자동화에도 같은 문제가 남는다.
- **[무엇이 깨지나]** ②의 검증, ③–⑪의 규칙 운용·판단 기록. 엔진은 전봉 RSI **엄격한 미만**, 현재 종가 **전봉 대비 0.5% 초과 반등**, **이평 절대 괴리/현재가 > 0.03**을 검사한다(I:L5326–5329,13485–13489). 격리 실행: RSI=44이면 `watch`; RSI=43, 가격100→101, SMA20=90/SMA60=100이면 역배열이어도 `entry`. 예시대로 렌더하면 같은 평가가 실패와 성공을 동시에 말한다.
- **[수정안]** 평가기가 반환하는 구조화 `rules[]`를 카드가 그대로 읽는다. ‘추세 필터’는 현재는 ‘20/60 이평 괴리 필터’로 설명한다. 정배열 전략을 원하는 제품 결정은 가능하지만, 별도 전략 버전으로 식을 바꾸고 전 구간 재검증한 뒤 적용한다. 카피 변경으로 계산 의미를 바꾸지 않는다.

### C03. 공개 가중치만으로 종합 점수가 정의되지는 않는다

- **[결정]** C:L96, R:L37의 `수익30% + (1-MDD)25% + 기간20% + 팔로워 손익25%`, 결측 가중치 재분배를 그대로 구현할 수 없다.
- **[무엇이 깨지나]** ①–⑪ 마켓 정렬. 30일 수익률 %, MDD %, 운용 일수, 팔로워 원화 손익을 더하면 단위가 큰 손익이 순위를 지배한다. MDD를 `-5`, `5`, `0.05` 중 무엇으로 넣느냐에 따라 부호와 점수가 바뀐다. 현재 백테스트 MDD는 음수인 반면 `cpPerf`는 절댓값을 반환한다(I:L11221–11226,11907–11915). 팔로워 자료가 없는 전략의 가중치를 재배분하면 완전한 자료가 있는 전략과 평가 목적도 달라진다.
- **[수정안]** P0에서는 동종 출처·동일 기간의 결정론적 기본 정렬을 제공한다. 종합 점수가 필요하면 P1에 각 항목의 0–1 변환, MDD 절댓값, 통화 환산 시점, 표본 자격, 결측 처리, 동률 ID를 버전으로 고정한다. 결측 전략은 ‘검증 자료 추천’ 별도 집합으로 정렬한다. 내 P:L381의 팔로워 손익 기본 정렬도 현재 시드에는 부적합하므로 철회한다.

### C04. 닉네임을 제목에서 빼면서 식별자로도 지우면 기존 사용자가 고아가 된다

- **[결정]** C:L29–38의 제목 체계는 채택하지만, 이를 기존 `nick` 값 일괄 교체로 구현하는 것은 반대한다.
- **[무엇이 깨지나]** ① 공유 딥링크, ④–⑪의 따라가는 중·종료·정산. URL은 `tfSSNe(nick)`, 원본 조회는 `tfSSFind(nick)`, 카피 계산은 `c2.nick`을 사용한다(I:L10997,11023,11384–11387,11919–11924). 기존 카피를 보유한 채 시드 nick을 ‘BTC 눌림목…’으로 바꾸면 원본을 못 찾고 `cpCalc`의 손익0 폴백에 들어갈 수 있다. 단순 이름 변경이 자금 화면까지 바꾼다.
- **[수정안]** `publicationId`, `creatorId`, `title`, `legacyNickAliases`를 먼저 추가한다. `nick`은 호환 조회 키·작성자 표시로 보존하고 `cp.copies`를 안정 ID로 연결한다. 기존 URL은 별칭으로 해석한다. 이름 변경 후 동일 카피 ID의 예산·원장·손익·원본 버전이 그대로인지 검사한다.

### C05. cp 화면 흡수와 데이터 모델 흡수는 다른 작업이다

- **[결정]** C:L99의 cp 프로필 라우트 폐기는 기존 경로의 호환 처리와 지표 계약이 있을 때만 가능하다. ‘동일 세계관’이라는 이유로 수치를 하나로 덮어쓰면 안 된다.
- **[무엇이 깨지나]** ① 상세 열람, ② 따라가기 설정, ④–⑪ 내 카피 관리. `tfSS3PdCalc`는 선택 기간의 백테스트를 다시 실행하고(I:L11907–11915), `cpPerf`는 기존 자산곡선을 기간으로 자른다(I:L11213–11226). `cpCalc`는 내 예산·입출금·분배를 반영한다(I:L11384–11412). 이 셋의 수익률·순손익을 단일 `ret`로 교체하면 기간·산식·소유자가 사라진다. `#/share/t/<nick>`를 지우면 기존 진입도 깨진다(I:L15744).
- **[수정안]** 화면은 통합하되 `PublicationPerformance`와 `FollowerAccountPerformance`를 구분한다. 같은 기간 버튼은 같은 집계 함수를 호출하고 ‘기간 중 실제 운용 경로’와 ‘기간 시작부터 재검증’은 별도 모드다. 기존 프로필 URL은 동일 publication 상세 탭으로 연결하고 내 카피 URL은 instance 상세로 유지한다.

### C06. ‘원본 로그 그대로 + 내 체결 강조’로는 따라가기 실패를 설명하지 못한다

- **[결정]** C:L22의 follow 로그 정의를 확장해야 한다. R:L28의 공통 스키마 채택만으로 원본/내 실행의 연결 계약이 완성되지는 않는다.
- **[무엇이 깨지나]** ③–⑪ 따라가기 활동·포지션. 원본은 진입했지만 내 잔고 부족·선택 페어 제외·최소 주문수량으로 주문이 생기지 않은 경우, 원본 ‘진입’ 로그만 보이면 내 계좌도 체결된 것으로 읽힌다. 현재 `cpStart`의 ‘다음 진입부터’ 문구와 `simStartI` 30개 곡선 표본 전 소급 시작도 충돌한다(I:L11868–11876).
- **[수정안]** 원본 이벤트는 읽기 전용으로 유지하고 `follow_sync{leaderEventId,receivedAt,sizingResult,decision,skipReason,orderIds}`를 내 이벤트로 생성한다. 첫 적용 sequence·기존 포지션 정책·부분 체결을 표시한다. 로그 행의 강조가 아니라 데이터 관계를 추가해야 한다. 소급 체험 수익은 preview에만 둔다.

### C07. 라우트 개명을 피하는 것과 라우터를 안 고치는 것은 다르다

- **[결정]** R:L38의 ‘기존 라우트 유지 + 뷰 함수만 교체’는 앞부분만 채택한다.
- **[무엇이 깨지나]** ①–⑪ 탐색·연결·활성화 복귀. `tfShareHub()`는 해시를 없애고(I:L11141–11146), 부팅은 등록된 경로가 아니면 `lastSid`로 돌아간다(I:L16820–16825). 기존 `#/trade`는 정확한 문자열 비교여서 `#/trade?preview=1`도 그대로는 처리하지 못한다(I:L15049–15052,15739–15741). 뷰만 교체하면 필터→상세→뒤로가기·새로고침·preview 격리가 성립하지 않는다.
- **[수정안]** `#/share/s/*`, `#/trade/bot/*`, `#/strategy/connect`는 유지한다. 경로가 없던 허브·거래소 관리에만 주소를 부여하고 pathname/query를 분리하는 router adapter를 먼저 넣는다. 뷰 내부의 history 변경은 라우터로 옮긴다. 기존 URL 유지와 복원 계약 개선은 동시에 가능하다.

### C08. 11 프리셋과 몇 개 흐름으로 전이 검증을 대체할 수 없다

- **[결정]** R:L39의 ‘15개로 축소’는 묶음 수를 줄이는 방식으로만 수용한다. 중복 응답·기간 경계·기존 데이터 복원 검증을 버리는 축소는 거부한다.
- **[무엇이 깨지나]** 특히 ②→③, ⑥→⑧/⑨, ③→④ 전환. 11개 완성 스냅샷은 `UID 성공→API 실패→새로고침`, 시작 더블 클릭, 월 경계, paper 거래의 크레딧 혼입을 통과 여부로 판정하지 못한다. 현행 즉시 시작/나중에 시작 후속 이벤트 차이(I:L9970–9972,13462–13467)와 원장 절단(I:L12854–12858)은 완성 화면만 보면 숨는다.
- **[수정안]** §7의 필수 불변조건을 parameterized test로 묶는다. 화면 검사는 11개, 전이 검사는 서로 다른 종류의 검사다. 성능 수치 목표는 P1로 늦춰도 데이터·명령 경계 검사는 P0다. PASS 토글(C:L158)은 수동 판정 기록이며 자동 assertion의 대체가 아니다.

### C09. 연결 성공은 AI 사용 가능·비용 상쇄 성공 이벤트가 아니다

- **[결정]** C:L128–132의 연결 완료 직후 ‘모델을 골라 사용’, ‘거래하는 동안 이용료 충당’과 R:L25의 성공 순간 보상 문구 이동만으로 문제는 해결되지 않는다.
- **[무엇이 깨지나]** ③ UID만 연결, ④ 크레딧 부족, ⑨ 고사용·저거래의 완료 화면→질문 액션. F:L13은 UID 지급 완료 후에도 새 과금 원장이0이라 `watch`가 유지되는 격리 실행 결과를 기록한다. 이번에도 UID 성공이 구형 원장에 지급하고(I:L13324–13336), AI gate는 별도 bill을 읽는 코드(I:L12897–12908)를 확인했다. 성공 문구를 옮겨도 실제 AI 요청은 막힐 수 있다.
- **[수정안]** 연결 보상은 ‘해당 계정 연결 완료’에 한정한다. ‘AI 사용 가능’은 동일 revision의 액션 자격, ‘이번 달 충당’은 청구 산식 결과가 있을 때만 붙인다. 완료 후 CTA도 미완료 단계·전략 버전·자격을 다시 계산한다. 고거래인데 비용이 더 큰 ⑧, 저거래지만 무료 잔액으로 충당된 ⑨를 모두 허용한다.

### C10. 원격 지원 문구를 지워도 실시간 지원의 미구현은 남는다

- **[결정]** R:L20이 제안한 ‘24시간 상담원이 바로 도와드려요’도 현재 체크아웃 복구 수단으로 확정할 수 없다(C:L126).
- **[무엇이 깨지나]** ②·③·⑥–⑨의 연결/결제 실패 시 [도움받기]. `site-config.js:L11–12`는 키가 비어 있고, `help-widget.js:L72–86`은 준비 안내 팝오버로 간다. 상담 연결 상태·대기·실패 콜백은 확인되지 않는다. 활성화가 막혔을 때 제안이 약속한 복구 경로가 없다.
- **[수정안]** 현재 기능에 맞게 ‘연결 도움말 / 문의하기’를 제공한다. 실시간 지원을 제품 요구로 유지하려면 `supportAvailability`와 연결 중·불가·문의 저장 완료 상태를 정의하고 해당 어댑터가 준비된 환경에서만 렌더한다. 도움말을 본 뒤 동일 activation draft로 돌아오는 경로는 P0에 넣는다.

## 2. AGY 제안: 구현 모순·회귀 위험 반박 13건

### A01. 같은 문서 안의 두 과금 공식이 다른 청구액을 만든다

- **[결정]** A:L257,267의 `플랜료−거래 크레딧`을 최종 청구식으로 쓰는 안은 A:L406의 네 항목 공식과 모순이다.
- **[무엇이 깨지나]** ⑥·⑧·⑨ PLAN/체크아웃. 플랜49,000·초과150,000·거래10,000·무료10,000이면 청구179,000원인데 단순 바는39,000원을 보여준다. 현 `bcBillQuote`도 비율 상쇄식이라(I:L12763–12773) 제목만 고치면 새 공식이 구현되지 않는다.
- **[수정안]** 파생 청구 객체 하나에서 총 이용료·초과 이용·확정 혜택·예상 청구를 만든다. 바는 같은 객체의 요약 표현이다. 펼침 여부와 무관하게 총액은 네 항목을 전부 반영한다.

### A02. 연결·거래횟수·고거래를 ‘무료·무제한’으로 연결할 수 없다

- **[결정]** A:L251,270,384 및 L412–419의 최초 거래 면제·추가1회 면제·고거래0원·VIP 무제한·이월을 기각한다.
- **[무엇이 깨지나]** ③–⑩ 활성화·PLAN. 같은 1회 거래라도 명목금액이 다르고, ⑧은 사용량 증가로 청구가 남는다. `bcVolumeCharge`도 명목금액·요율·상한을 적용한다(I:L12629–12643). ⑩의 초과 크레딧을 다음 달에 더하려면 기간 원장이 필요한데 제안에는 없다. 0원과 다음 AI 요청 허용도 별개다.
- **[수정안]** 거래 밴드는 분류 전용으로 두고 `due`, 현재 요청을 감당할 잔액, 다음 달 이월 정책을 독립 계산한다. QA에서 ⑧ 유료/⑨0원/청구0이지만 다음 요청 차단을 필수로 재현한다. 무제한·이월은 별도 정책과 구현이 없으면 출력하지 않는다.

### A03. 카드 이용자를 시뮬레이션 전용으로 만드는 것은 권한 회귀다

- **[결정]** A:L391–392의 카드=거래소 미연동=시뮬레이션·알림 전용 정의는 기각한다.
- **[무엇이 깨지나]** ⑥·⑦이 UID 미연동이지만 API는 연결된 경우. 지금도 `tfBkConnSt`는 API 사업자가 일치하면 결제 방식에 앞서 `CONNECTED`로 판정한다(I:L15440–15446). 카드 사용자의 실행 API를 무시하면 사용할 수 있는 실행 경로가 없어지고, 다른 화면과 연결 상태가 갈린다.
- **[수정안]** 카드/크레딧은 AI 비용 지불 방식, UID는 혜택 귀속, API는 대상 계정 실행 연결이다. `planActive`, `paymentMethod`, `uidLink`, `execution`을 분리하고 실행 방식별 자격을 계산한다.

### A04. 한 장의 시트로 만들 수 있지만 한 번의 성공으로 만들 수는 없다

- **[결정]** A:L121,173,388의 연결+가동 일괄 완료는 화면 수 축소로만 채택한다.
- **[무엇이 깨지나]** ②·③ 첫 실행, ⑥·⑦ API 연결. UID 성공 뒤 API 실패, 연결 성공 뒤 원본 전략 버전 변경, 확인 버튼 두 번 클릭이 발생하면 단일 성공 플래그는 일부 완료를 잃거나 중복 인스턴스를 만든다. 현재 UID/API writer도 분리되어 있다(I:L9859–9869,9911–9919). 계정 연결만 하려 해도 검증 전략이 없으면 막힌다(I:L15457–15465).
- **[수정안]** 한 시트 안에 독립 task 상태와 완료 체크 행을 둔다. 계정관리 intent는 전략 없이 완료 가능, 실행 intent는 최신 예산·버전 확인 뒤 별도 start command를 보낸다. `operationId`로 재시도하고 ‘연결됨’과 ‘실행 중’을 다른 이벤트로 확정한다.

### A05. 기본 규칙을 AI 에이전트로 재명명하면 실행 모드가 발명된다

- **[결정]** A:L173–184의 기본 에이전트 원클릭, L292–295의 돌파·분할매수·MDD8% 보장형 이름을 기존 시드에 붙이지 않는다.
- **[무엇이 깨지나]** ① 프리뷰, ② 퀵 론칭, ③–⑪ 터미널. d1–d6과 공개 시드에는 RSI·반등·괴리·SL/TP·25봉 청산 파라미터만 있다(I:L9986–9999,10965–10979). 분할매수·오더북 판단·최대 계좌낙폭 제한이 추가되지 않는다. 대화로 만든 규칙도 실행 주체는 동일하다.
- **[수정안]** 기존 데이터는 `rule`로 태깅한다. 공식 에이전트 체험은 별도 `agent-demo-v1` 입력·결정·주문 fixture를 만들어 제공할 수 있다. `engine=mock`과 해당 스키마를 갖추고 같은 예산·실행 확인 경로로 보낸다. hybrid는 별도 내부 kind로 보존한다.

### A06. 외부 차트 유지와 엔진 마커 필수 연동 사이의 데이터 계약이 없다

- **[결정]** A:L197,208의 TradingView 유지+진입/청산/손절/익절 필수 오버레이를 현 함수의 옵션 추가 정도로 취급하면 안 된다.
- **[무엇이 깨지나]** ③–⑪ 터미널. `tfTmChart`는 symbol·interval로 외부 widget을 생성하고 주문/봉 데이터를 전달하지 않는다(I:L10257–10272). 검증은 일봉이고 위젯은60분봉이다(I:L10254,10269). 기존 마커를 화면 좌표로 덧그리면 확대·스크롤·봉 경계와 분리된다. 이 코드는 custom overlay 지원을 증명하지 않는다.
- **[수정안]** P0는 실제로 같은 시계열을 읽는 기존 검증 차트에 판단/체결을 표시하고 외부 시세 화면은 별도 컨텍스트로 유지한다. P1에 직접 데이터·시간축·마커 API를 제어할 수 있는 chart adapter를 채택한다. 라이브러리 선택·지원 API 검증 후 전환하면 가능하다. 근거 없이 현재 widget에서 지원한다고 약속하지 않는다.

### A07. 카운트다운은 렌더링 시간이 아니라 스케줄러 상태다

- **[결정]** A:L149–163,193의 ‘실제 Bitget 시세+현재 AI 판단+다음08:42’를 현재 로그에 덧씌우는 방식은 불가다.
- **[무엇이 깨지나]** ① 관전, ③ 거래0, ⑤·⑧ 실행 중, 모든 정지 전략. 현재 로그는 렌더할 때 과거 봉을 재생하고(I:L13477–13507), 상태 바는 `live`이면 ‘방금 전’을 하드코딩한다(I:L10247). 화면을 새로 열 때마다 점검 시간이 리셋되거나, 일시정지 뒤에도 가짜 다음 확인이 흐른다.
- **[수정안]** `lastEvaluatedAt`, `nextScheduledAt`, `clockDomain`, `scheduleStatus`를 이벤트로 기록한다. 데모는 고정 기준 시각+명시적 재생 tick으로 운영한다. 정지/오류 때 다음 확인은 null, 지연 때는 ‘점검 지연’이다. 실시간 가격과 과거 판단을 동일 입력이라고 표시하지 않는다.

### A08. 키-값 카드도 없는 입력·추정 확률을 만들어낼 수 있다

- **[결정]** A:L193,336–354의 확신도·펀딩비·매도벽·기관 매수세·숏스퀴즈82% 상시 표시는 기각한다.
- **[무엇이 깨지나]** ① 관전, ③–⑪ 판단 패널. 현재 `tfTmMkt.volChg`는 `(i*37)%80-30`이며 거래량 관측값이 아니다(I:L10404–10409). 실제 뉴스·오더북·펀딩 데이터 참조나 확률 평가기가 없는 상태에서 해당 값을 카드에 채우면 입력이 바뀌어도 판단을 재현할 수 없다.
- **[수정안]** §6처럼 관측값·출처·시각을 갖춘 fixture를 만들고 evidence ID에서 짧은 근거 문장을 생성한다. 뉴스가 없으면 ‘없음’이 아니라 ‘이 데모에서 사용하지 않음’이다. confidence를 숨긴 채 사이징에 쓰자는 R:L17도 근거 있는 사이징 정책이 없으면 채택하지 않는다.

### A09. 주문 예시의 수량·금액·손익비가 서로 검산되지 않는다

- **[결정]** A:L351–354의 `0.25 BTC = 예산30%, 150만원`, `SL 63,450`, `TP 65,800`, `손익비1:2.1`을 하나의 사실 카드로 사용하지 않는다.
- **[무엇이 깨지나]** ③–⑪ 진입 카드와 계정 자산. 정확한 진입가·환율·반올림 규칙이 없다. 진입을64,200으로 가정하면 주문명목은16,050 USDT이고, 손익비는1,600/750≈2.133이다. 진입이64,300이면1,500/850≈1.765다. 다른 기준가를 섞으면 예산·위험액·수량이 화면마다 달라진다.
- **[수정안]** `fillPrice`, `quantity`, `quoteCurrency`, `fee`, `fxSnapshotId`, `budgetAllocation`에서 모두 산출한다. 원화는 명시 환율의 보조 표시다. 부분 체결은 실제 체결수량만 반영한다. 예시는 §6의 예산1,000 USDT·300 USDT 주문처럼 검산 가능한 한 세트를 쓴다.

### A10. 내 전략을 ‘실제로 켠 전략’으로 필터링하면 복구할 대상이 사라진다

- **[결정]** A:L195,206의 활성 전략만 레일에 남기는 규칙을 기각한다. 데모를 내 레일에서 빼는 방향은 채택한다.
- **[무엇이 깨지나]** ② ready만 존재, ④–⑪ 모두 일시정지·연결 오류·종료 이력만 존재. 마지막 전략을 중지하자 목록에서 사라지면 재개·오류 복구·종료 기록에 접근할 수 없다. 현재 `tfTmCtx`의 재개/시작/다시 연결 버튼은 선택 엔티티가 있어야 나온다(I:L10235–10252).
- **[수정안]** 소유 여부와 실행 상태를 분리한다. 기본 레일은 owned ready/running/paused/error, 종료 이력은 보관함에서 접근한다. active terminal은 ‘운용 공간 존재’로 판정한다. demo 제거 시 `TF_TM.sel`, 알림 링크, clone 원본 참조를 함께 정리하고 preview의 legacy key mapping은 보존한다(I:L10133–10137).

### A11. 음수 데이터를 삭제하는 것은 기간·산식 불일치의 수정이 아니다

- **[결정]** A:L15,86,222의 ‘정반대 수치이므로 가짜 음수 프로필 폐기’는 증거가 부족하다.
- **[무엇이 깨지나]** ①–⑪ 탐색→상세→카피. 전체 수익 플러스와 최근 손익 마이너스는 양립한다. 격리 실행: 전체20%인 곡선 `[1,1.25,1.2]`에서 원본 `cpPerf(...,30)`은 -4%를 반환한다. 반면 팔로워1284와 `cpMeta.copiers`는 서로 다른 합성 원천이라 같은 의미로 비교할 수 없다(I:L10968,11208–11209). 문제를 전부 음수 삭제로 묶으면 정상 손실 기간까지 지운다.
- **[수정안]** 동일 publication·버전·기간·출처·분모·시점에 같은 지표를 조회하게 한다. 실제로 불일치하는 합성 팔로워 수는 한 fixture 정본으로 통합한다. 음수/양수와 무관하게 기간 불일치를 수정한다. A:L217의 30일 출처 전환도 C01과 같은 이유로 폐기한다.

### A12. 예산만 입력받아도 자금 이동·기존 포지션·청산 상태는 필요하다

- **[결정]** A:L90,218,230의 예산→CSL→완료 및 L203의 비상 전량 청산은 그 동작을 수행하는 명령 설계가 먼저 필요하다.
- **[무엇이 깨지나]** ②·③ follow 시작, ④–⑪ follow 종료. 현재 `cpStart`는 spot에서 예산을 차감하고, `cpClose`는 반환액을 spot에 더한다(I:L11864–11873,11493–11499). 입력 검사는 spot 잔액을 본다(I:L11814–11826). 이 상태를 제거하면 이중 할당이 가능하다. 현재 일반 pause는 상태만 `off`로 바꾸며 청산하지 않는다(I:L13457–13460). 버튼을 ‘전량 청산’으로 바꿔도 포지션은 사라지지 않는다.
- **[수정안]** 지갑 구현 용어는 숨기되 `allocationId`와 예약/확정/반환 원장은 보존한다. 기존 포지션은 기본 skip이며 최종 요약에서 명시한다. CSL에는 기준액·실현/미실현 포함·발동 동작을 정의한다. `pause`, `stop-and-flatten`, `drain`, `handoff`는 별도 command이고, 잔여 포지션/미체결이0일 때만 청산 완료로 전이한다.

### A13. Bitget-first는 카드 순서만 바꾸면 완성되지 않는다

- **[결정]** A:L235–250의 추천 집중은 채택하지만 기존 기본값을 모두 Bitget으로 치환하는 구현은 반대한다.
- **[무엇이 깨지나]** ③–⑤·⑧–⑪ 적립, 기존 Binance/OKX 전략 관리. `teth-copy.js:L71–74`에는 Bitget 적립률이 없고 `bcVolumeCharge`는 Binance 현물률로 폴백한다(I:L12631–12633). 거래소 카드 순서와 설정 추천 순서도 별개다(I:L15063–15075, `teth-copy.js:L25–36`). 기존 전략의 ex만 바꾸면 저장된 chart symbol·계정·기록은 다른 사업자 그대로 남는다.
- **[수정안]** 추천 순위와 기존 accountId는 분리한다. 신규 draft 기본값만 Bitget으로 설정한다. 데모 가격·적립 정책은 명시 버전 fixture로 제공하고, 미정인 실제 요율은 unknown으로 둔다. 다른 거래소를 지우더라도 기존 인스턴스 조회·정지·기록 경로를 먼저 보존한다.

## 3. 두 제안의 충돌과 판정

| 충돌 | Claude / AGY | 판정과 구현 조건 |
| --- | --- | --- |
| 체험의 첫 행동 | 만들기·검증 뒤 실행 / 연결·예산·가동 우선(C:L52–55, A:L164,173) | Claude. 초안 없는 inactive는 탐색·생성, 검증된 초안은 실행 준비. 기본 전략 퀵 론칭은 선택→요약 진입을 짧게 만든다. |
| 혜택의 의미 | 거래 혜택만큼 상쇄 / 연결·1회 거래로 전액 무료 | Claude의 방향. 다만 C:L131,146,151의 무조건 충당 문구도 due 결과에 종속시킨다. |
| 카드 사용자의 실행 | UID와 API 분리(R:L16) / 시뮬레이션 전용 | Claude. 지불 방식과 실행 계정 연결은 독립이다. |
| 로그의 기본 밀도 | 입력·결정·행동·다음 확인 / 11키·확신도 상시 | Claude 기본 카드 + AGY 구조화 상세. 근거 없는 confidence·입력은 양쪽 모두 제외한다. |
| 전략 유형 | 내부4종 / 표면3종 | 제3안. 내부 agent/rule/hybrid/follow, 생성 메뉴3종. hybrid 배지는 유지한다. 기존 p 전략은 rule이다. |
| 데모6개 | preview 격리로 수정(R:L45) / 데이터 완전 제거 | 수정된 Claude. 내 합계에서는0개, preview·QA에서는 오류/대기/중지 재현에 재사용한다. |
| 연결 UX | 한 흐름의 내부 단계 / 한 번의 연결·가동 | 표면은 AGY처럼 한 시트 가능. 상태는 UID/API/이용 방식/예산/실행 각각 분리한다. |
| follow 설정 | 예산·최대손실·고급·검토 / 예산·CSL 두 단계 완료 | 제3안. §6의 실행 계약을 갖추고 예산→방식→확인3단계. 고급은 접되 기존 포지션 정책은 확인에서 보인다. |
| 터미널 제어 | 일시정지 / 일시정지+비상 전량 청산 | 명령 의미를 분리한 제3안. 청산은 선택 전략/계정 범위를 확인하고 부분 체결 중에는 stopping이다. |
| 지원 거래소 | Bitget 우선+다른 거래소 / Bitget 허브 집중 | Claude. 추천은 제품 정책, 계정/시장 capability는 별도 정본이다. |
| cp 프로필 | 상세로 흡수 / 음수 데이터 제거 | 화면 통합은 Claude, 데이터는 양쪽 수정. 원본/내 성과와 기간별 계산을 보존한다. |
| 성과30일 기준 | 둘 다 미만=백테스트 | 둘 다 틀림. 출처·기간·자료 충족도를 독립 관리한다. |
| 종합 랭킹 | 공개 가중치·결측 재배분 / 공개 가중치 정렬 | 둘 다 미완성. 정규화·집합·표본·기간을 정의하기 전에는 점수를 만들지 않는다. |
| QA 노출·검증 | 개발환경 QA 유지·검사 축소 / 상시 QA 제거 | 일반 화면에서 숨기는 방향은 양쪽 채택. QA 자체는 유지하고 11개 분류+전이 불변조건은 축소하지 않는다. |

내 이전 제안도 수정한다. P:L78의 모든 행에 검증 초안이 있다는 전제는 시작 액션 검사에만 남긴다. 기본 로그인 화면에는 초안이 없다. 신규 전체 라우트 개명과 팔로워 손익 기본 정렬은 P0에서 철회한다. 금액은 KRW 정수 예시로 바꾸며 $49를 실제 환율로49,000원 환산했다는 뜻은 아니다. 기존 원장 통화는 이 설계 예시 때문에 변환하지 않는다.

## 4. 단일 파생 상태 엔진 최종안

### 4.1 입력: 사실·정책·화면 맥락

`deriveProductState(snapshot, context, policy, now)`는 순수 함수다. 부팅·원장 지급·이벤트 수신·저장·토스트를 실행하지 않는다. `command → adapter → event → reducer → snapshot → derive → render`로 진행한다.

| 입력 | 최소 계약 |
| --- | --- |
| snapshot | `schemaVersion, revision, hydration:loading/ready/error, ownerId, source:demo/production` |
| identity | `userId` 또는 null. 복원 전 null은 게스트 확정이 아니다. |
| accounts | `id, exchangeId, uidLink.status, execution.status, verifiedAt, revision, capabilities`. UID/API 성공은 독립 사실이다. |
| subscription | `planId, status, periodStart, periodEnd, collectionStatus`. 카드 등록만으로 active를 만들지 않는다. |
| meter | `billingScopeId, periodId, usageComplete, tradeComplete, successfulAiUnits, eligibleLiveNotionalUSDT, asOf, revision` |
| billing facts | 동일 기간의 `currency, planFeeMinor, overageMinor, commissionCreditMinor, freeCreditMinor, reservedMinor, settlementStatus`. 확정 집계와 이벤트 재생 중 한 원천을 선택한다. |
| portfolio | workspace·strategy·publication·copy subscription·position·allocation. draft와 실행 instance를 분리하고 origin을 보존한다. |
| context | `route, action, targetAccountId, targetStrategyId, workspaceId, selectedVersion, scope:owned/preview, resumeIntentId, requestedAiUnits` |
| policy·clock | 버전 있는 임계·가격·포함량·과금 대상·집계 기간·capability 정책, 주입된 시각. |

상업 분류의 U는 **고정 billingScope 안에 유효한 요금 귀속 UID가 있는가**다. P와 사용량은 같은 scope의 플랜·사용량이다. 거래량도 동일 scope에서 적립 대상으로 식별된 live 체결의 명목금액이며, 확정된 과거 크레딧은 현재 UID 해제로 지우지 않는다. 선택 전략을 바꾸었다고 계정 청구나 상업 ID가 바뀌지 않는다. 반면 E는 **현재 액션 대상 accountId의 API 상태**다. Bitget UID가 있어도 OKX API가 없는 전략을 실행시키지 않는다.

무료/유료/거래 혜택과 무관하게 AI 성공 이벤트를 `requestId`별1회 계측한다. 실패·취소는 성공량에 더하지 않는다. 외부 호출 없이 끝나는 규칙 백테스트·렌더·로그 접기는 AI 성공량을 늘리지 않는다. 체결은 `fillId, accountId, strategyId, env, occurredAt, notional, currency, conversionRef`를 보존한다. paper·preview 거래는 개인 live 집계에 포함하지 않는다. QA live 체결도 QA namespace 밖으로 내보내지 않는다.

### 4.2 출력과 불변조건

| 출력 | 계약 |
| --- | --- |
| classification | `stateId:1..11/null`, `status:ready/reconciling/unclassified`, `reasonCodes`, `usageBand`, `tradeBand` |
| billing | 네 항목·동일 통화·기간·시점의 예상 청구, `status:known/unknown`, `coverageRatio` |
| entitlement | 액션별 `allowed/unknown/blocked`, 사유·해결 액션·평가 revision. browse/edit/ruleBacktest/aiTask/startPaper/startLive/resume/pause/stop/followStart 구분 |
| terminal | `mode:guest/inactive/active`, `readiness`, `inactiveStage:discover/draft/ready/activation`, `preview` |
| presentation | `primaryCTA, secondaryCTA, billingLine, activationMessage, interruptLevel`. CTA는 action/target/params/labelKey를 갖고 화면이 별도 게이트를 만들지 않는다. |
| version | `evaluatedRevision, policyVersion, billingPeriodId` |

청구식은 `due=max(0,planFee+overage−commissionCredit−freeCredit)`다. 금액은 원장 통화 최소단위 정수이며 UI 통화 선택은 원장을 바꾸지 않는다. coverage 바는 `min(1,(commission+free)/(planFee+overage))`; 분모0이면100%가 아니라 ‘이번 기간 이용료 없음’이다. 바를 ‘거래 혜택’이라고 부를 때는 무료 혜택과 거래 혜택 구간을 분리한다.

다음 AI 요청 자격은 `요청 후 비용 + 예약액`을 감당하는 혜택 잔액 또는 정상 후불 플랜이 있는지를 본다. due=0 자체는 자격이 아니다. 무료 잔액과 미래 AI 운영비가 부족하면 AI 액션의 복구 안내를 만들지만 pause/stop·기록·포지션 관리는 유지한다. rule/follow의 비AI 실행은 AI 호출 자격으로 막지 않는다.

live 시작은 로그인·대상 API·해당 kind 검증·예산 할당·실행 확인이 필요하다. paper에는 API가 필요 없다. `agent`는 데모 정책/일정·데이터 계약 검증, `rule`은 현 규칙 검증, `hybrid`는 양쪽과 우선순위, `follow`는 원본 가용성·동기화·자금 검증을 한다. 모든 kind에 RSI 백테스트80점을 강제하지 않는다.

active terminal은 owned instance(ready 포함), 남은 포지션, 보관 전 운용 이력 중 하나가 있으면 유지한다. 모두 paused/error여도 inactive로 보내지 않는다. 초안만 있으면 inactive이며 초안 유무에 따라 discover/draft/ready를 보여준다. preview는 별도 데이터 scope다.

### 4.3 데모 임계값: 고정 상수 + 경계 QA

다음은 **데모 정책 `demo-state-v3`**이며 출시 가격·실거래소 요율의 결정이 아니다. 화면마다 값을 바꾸거나 현재 사용자 분포로 임계값을 자동 보정하지 않는다. 실데이터를 완전히 복원할 수 없는 과거 기록에는 이 임계값을 억지로 적용하지 않는다.

```text
now = 2026-09-24T00:00:00Z
period = [2026-09-01T00:00:00Z, 2026-10-01T00:00:00Z)
USAGE_HIGH_UNITS = 1_000
TRADE_HIGH_USDT = 1_000_000
usageBand: 0..999 = low, >=1_000 = high
tradeBand: 0 = none, 0 < x < 1_000_000 = low, >=1_000_000 = high
미집계/단위불명/음수/NaN = unknown (0으로 대체하지 않음)
```

데모 성공 AI 요청1건을1unit로 고정한다. 종류별 가중치를 도입하면 정책 버전을 올린다. trade는 건수가 아니라 기간 명목금액 합이다. `bcMonthVol()`은 적립 credit 합이므로 대체 입력으로 사용할 수 없다(I:L12700–12703). `tradeActiveUntil`도 거래량을 나타내지 않는다.

QA 금액 정책은 플랜49,000원, 포함100units, 초과100원/unit, 비플랜 기본료/포함량0, 해당 기간 무료10,000원이다. 무료 잔액을 고정 ‘5회’로 쓰지 않는다. 이 정책의 무료 잔량은 요청 비용에서 파생하며 현재 `freeQuota=10` 정책을 소급 변환하지 않는다. 사용량 high1000과 포함량100도 다른 기준이다.

각 프리셋은 **정본 집계 응답 fixture**다. commission은 별도 확정 사실로0/10,000/250,000원을 주입한다. 거래 밴드에서 금액을 추론하지 않는다. 이 값은 Bitget 실제 요율이 아니다. 거래 이벤트를 추가하는 QA는 별도 고정 적립 어댑터와 전환 단위를 선언해야 하며, 기존 Binance 폴백을 가져오지 않는다.

경계 fixture는 usage `0/999/1000/1001/unknown`, trade `0/0.01/999999.99/1000000/unknown`, UTC 월경계 직전/정각, 같은 request/fill ID 중복, paper/live 분리를 포함한다. 금액 정수와 달리 명목거래량은 소수 단위 또는 고정 소수 정수 스케일을 명시한다.

### 4.4 갱신된 11행 표

기본 fixture는 **실행 instance·포지션·초안 모두0**, billing 집계 complete, 로그인 사용자는 같은 QA owner와 Bitget 계정을 갖는다. U/E/P 순서이며 게스트 외에는 무료10,000원이다. `AI`는 다음1unit 요청 가능, `준비`는 유형 검증·예산·확인을 완료하면 가능하다는 뜻으로 지금 실행 가능과 구분한다. live 실행을 직접 검증하려면 별도 ready-draft overlay를 적용한다.

| ID·상태 | U/E/P | AI units / 거래 USDT | usage/trade | 거래 혜택 | 월 청구 기대값·이용 현황 문구 | 기본 1차 / 2차 CTA | 자격·활성화·방해·화면 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ① 게스트 | 0/0/0 | — / — | —/— | — | 개인 청구 미표시 | 무료로 시작 / 판단 예시 보기 | 공개 열람·preview; 생성 시 인증; 방해없음; guest |
| ② 로그인만 | 0/0/0 | 0 / 0 | low/none | 0원 | 0원·무료 혜택10,000원 남음 | 전략 만들기 / 공개 전략 보기 | AI 가능; paper 준비; live는API필요; 방해없음; inactive/discover |
| ③ UID·거래0 | 1/1/0 | 0 / 0 | low/none | 0원 | 0원·이번 달 거래 혜택0원 | 전략 만들기 / 공개 전략 보기 | AI 가능; paper/live 준비; 연결완료·실행전; 방해없음; inactive/discover |
| ④ UID·저거래 | 1/1/0 | 0 / 200,000 | low/low | 10,000원 | 0원·확정 거래 혜택10,000원 | 전략 만들기 / 이용 현황 | AI 가능; paper/live 준비; 방해없음; inactive/discover |
| ⑤ UID·고거래 | 1/1/0 | 0 / 5,000,000 | low/high | 250,000원 | 0원·확정 거래 혜택250,000원 | 전략 만들기 / 이용 현황 | AI 가능; paper/live 준비; 무제한아님; 방해없음; inactive/discover |
| ⑥ 플랜·고사용·UID없음 | 0/0/1 | 1,600 / 0 | high/none | 0원 | 189,000원 = 49,000+150,000−0−10,000 | 전략 만들기 / 이용 현황 | 정상후불로AI가능; live는API필요; 방해없음; inactive/discover |
| ⑦ 플랜·저사용·UID없음 | 0/0/1 | 10 / 0 | low/none | 0원 | 39,000원 = 49,000−0−10,000 | 전략 만들기 / 공개 전략 보기 | 정상후불로AI가능; live는API필요; 방해없음; inactive/discover |
| ⑧ 플랜·UID·고사용·고거래 | 1/1/1 | 1,600 / 5,000,000 | high/high | 250,000원 | 0원 = max(0,49,000+150,000−250,000−10,000) | 전략 만들기 / 이용 현황 | 혜택으로AI가능; paper/live 준비; 방해없음; inactive/discover |
| ⑨ 플랜·UID·고사용·저거래 | 1/1/1 | 1,600 / 200,000 | high/low | 10,000원 | 179,000원 = 49,000+150,000−10,000−10,000 | 전략 만들기 / 이용 현황 | 정상후불로AI가능; paper/live 준비; 방해없음; inactive/discover |
| ⑩ 플랜·UID·저사용·고거래 | 1/1/1 | 10 / 5,000,000 | low/high | 250,000원 | 0원 = max(0,49,000−250,000−10,000) | 전략 만들기 / 이용 현황 | 혜택으로AI가능; paper/live 준비; 방해없음; inactive/discover |
| ⑪ 플랜·UID·저사용·저거래 | 1/1/1 | 10 / 200,000 | low/low | 10,000원 | 29,000원 = 49,000−10,000−10,000 | 전략 만들기 / 이용 현황 | 정상후불로AI가능; paper/live 준비; 방해없음; inactive/discover |

③–⑤에서 거래 이력이 있으면서 내 전략0도 가능하다. 집계 범위의 거래소 거래량과 TETH 실행 instance 수는 동의어가 아니다. 표는 **상태별 반드시 보여야 할 고정 CTA 표가 아니라 동일 화면 맥락에서의 기대 출력**이다. 맥락이 같으므로 여러 행의 CTA가 같은 것이 맞다.

추가 overlay의 우선순위와 기대값:

1. `ready-draft`: ‘이 전략 실행하기’ → 확인/활성화. ②·⑥·⑦은 대상 API 연결, ③–⑤·⑧–⑪은 예산·버전 확인 뒤 시작. UID-only에서는③도 API 단계가 필요하다.
2. `owned-running/paused/error/ready`, `cp-only`, `clone-only`: 모두 active terminal. CTA는 선택 인스턴스의 중지/재개/복구/시작이며 상업 ID가 덮어쓰지 않는다.
3. `ai-blocked`: 해당 AI 요청에 inline 또는 action-block 복구. 기존 운용 화면은 유지한다. 규칙 제어까지 결제 화면으로 보내지 않는다.
4. `pending-activation`: 저장한 같은 intent의 미완료 단계 이어하기. 로그인·연결 후 무조건 자동 실행하지 않고 실행 확인 revision을 검사한다.
5. `⑧ usage=4000`: 청구179,000원으로 바뀌지만 stateId=8 유지. `⑨ freeCredit=200000`: 청구0원이지만 stateId=9 유지.
6. `② usage=100`: 비용10,000원과 무료10,000원이 같아 due0, 다음 AI100원은 blocked. `⑥/⑦ E=1`: UID 없이도 준비 완료된 live 시작이 가능하다.

### 4.5 unclassified는 실패 화면이 아니라 분류 결과다

- hydration loading/error 또는 분류에 필요한 집계 unknown은 `stateId=null,status=reconciling`, 사유는 `hydrating/meter_incomplete/source_conflict`다. 사용 불가로 일괄 치환하지 않는다.
- 알려진 **P=1,U=1,trade=none**은 `stateId=null,status=unclassified,reason=plan_linked_zero_trade`. ⑨/⑪로 몰래 포함시키지 않는다. 청구·API·전략 CTA는 정상적으로 계속 파생한다.
- 미플랜·UID 미연동은 사용량 밴드가 unknown이어도② 분류가 가능하다. 플랜·UID 미연동은 거래량 unknown이어도⑥/⑦ 분류에 지장이 없다. 분류에 필요 없는 입력 때문에 전체 결과를 버리지 않는다.
- unsupported plan/policy는 `unclassified`로 두고 알려진 사실만 표시한다. `unclassified`를 사용자 화면의 기술 용어로 노출할 필요는 없다. QA에서만 ID없음·사유를 읽는다.
- U/E=0/1은②·⑥·⑦의 `execution_only` variant다. 결제 실패는 별도 collection 축이며, UID/API task 진행도 별도 축이다. 누락된 경우를 ‘12번째 상업 상태’로 계속 늘리지 않는다.
- 분류에 unknown이 있어도 pause/stop/기록 열람은 허용한다. 새 실행에 필수인 계정·버전·예산이 unknown이면 해당 시작만 보류하고 복구 경로를 제공한다.

## 5. 기존 데이터의 전략 유형 소급 매핑

핵심은 **작성 도구가 아니라 실제 실행 payload**다. LLM이 만들어 준 RSI 조건도 rule이다. `follow`는 실행 관계이고 원본의 종류는 `underlyingKind`로 따로 보존한다. 기존 객체에 이름만 보고 agent/hybrid를 부여하지 않는다.

| 기존 데이터·근거 | kind / role / origin | 안정 ID·소급 규칙 |
| --- | --- | --- |
| 퍼널 `t.cur.p`, `t.intake` (I:L9475,7732–7735) | rule / draft / funnel 또는 research | workspaceId+version 발급. cur는 검증 결과 snapshot이며 실행 instance가 아니다. pendingP는 해당 workspace에 귀속한다. |
| `t.strat[]`의 p 보유(I:L9967–9969) | rule / instance / funnel 또는 research | `user:<at>`→strategyId 매핑. 같은 at 충돌은 migration mapping에서 별도 ID로 보존한다. AI·위임이라는 name은 유형 근거가 아니다. |
| later 생성 ready(I:L13693–13699) | rule / instance / funnel | 누락 ex/cap을 현재 intake/API로 채우지 않는다. `migrationStatus=incomplete`로 설정 검토 후 채운다. ready 유지. |
| `t.termClones[]` (I:L10038–10041,10728–10734) | 원본 kind, 기존은 rule / instance / terminalClone | `clone:<id>` 매핑. 원본 버전·설정 사본 관계만 유지, 자동 동기화 없음. |
| d1 BTC 돌파 추종(I:L9987–9988) | rule / template / demo | `demo:d1`; RSI40+반등+괴리, SL-5/TP10. 돌파 조건은 없으므로 ‘BTC RSI 반등·괴리 필터’ 식의 설명. preview running. |
| d2 ETH 추세 추종(I:L9989–9990) | rule / template / demo | `demo:d2`; RSI46+반등+괴리, SL-5/TP8. preview paused, 원본 chart venue는 별도 검토. |
| d3 SOL 되돌림(I:L9991–9992) | rule / template / demo | `demo:d3`; RSI38+반등, 필터없음, SL-3/TP8. preview running. |
| d4 BTC 평균회귀(I:L9993–9994) | rule / template / demo | `demo:d4`; RSI40+반등+괴리, SL-8/TP10. d1과 제목은 다르지만 실행 family는 같다. |
| d5 ARB 모멘텀(I:L9995–9996) | rule / template / demo | `demo:d5`; RSI38+반등, SL-3/TP10. preview ready. |
| d6 LINK 분할 매집(I:L9997–9999) | rule / template / demo | `demo:d6`; RSI46+반등, SL-8/TP10. 분할 주문 구현 없음. preview error 유지. |
| `tfRankSeeds`: 세븐틴층/단타는안해요/월급두배/조용한복리/바닥만줍는사람/느긋한스윙/리스크헌터/천천히꾸준히(I:L10968–10975) | 전부 rule / public template / sharedSeed | cfg 원본의 고정 seed ID를 부여한다. 점수 필터·정렬 후 배열 index를 ID로 쓰지 않는다. nick→publication alias 유지. p와 결과는 버전 snapshot. |
| `t.sharedSnap` (I:L11000–11018,12541–12560) | 원본 확인 시 해당 kind / publication snapshot / shared | p 없는 구형 snapshot은 kind=null, classification=unknown. 표시 제목으로 추정하지 않으며 열람 유지·새 실행은 설정 복구 필요. |
| ss3 `t.follows[]`, `cloneFrom`, `fid` (I:L12318–12334) | 기존은 rule / 설정 가져오기 관계 / shared | 이름이 follows여도 실시간 follow 아님. relationId를 보존하고 새 draft/instance의 source로 연결한다. cp subscription으로 바꾸지 않는다. |
| `cp.copies[]` (I:L11868–11873) | follow / instance / copy | cp.id 보존. nick alias→leaderPublicationId, 원본 현재 시드는 underlyingKind=rule. 원본 버전 불명은 unknown. amount·pairs·ledger·spot 할당·종료 정산을 보존한다. |
| 새 공식 agent 체험 | agent / template+preview instance / demo | 기존 d1을 변경하지 않고 `agent-demo-v1` 신규 fixture. 정책·입력 snapshot·cadence·행동 기록 필요. |
| 새 규칙+검토 체험 | hybrid / template+preview instance / demo | 명시 rule trigger+agent approve/veto/resize fixture가 모두 있어야 한다. 규칙 작성에 AI가 참여했다는 이유로 hybrid 아님. |

공통 lifecycle 이관: `live→running`, `off→paused`, `ready→ready`, `err→error`, cp `active→running`, `closed→stopped`. 기존 off가 종료였다는 별도 기록이 있을 때만 stopped로 바꾼다. 화면들의 `sx.live/livePaused`는 canonical strategyId 참조로 전환한다. public template·preview는 owned 실행 수에 포함하지 않는다.

`asset.base/quote`, 실행 venue, 차트 데이터 venue, 예산 통화는 별도다. d2의 OKX 실행과 BINANCE 차트처럼 기존 데이터 자체에 불일치가 있으므로 이름의 ETH만 보고 venue를 바꾸지 않는다. `PRICE` 공통 데모 시계열을 쓰는 기존 성과는 실제 종목별 시장 성과로 승격하지 않는다.

이관은 idempotent migration receipt를 저장하고 같은 legacy record를 두 번 만들지 않는다. 원본과 새 객체를 동시에 수정 가능한 정본으로 두지 않는다. unresolved mapping이 있는 기존 카피는 기록·정산 snapshot을 보존하고 새 동기화만 보류한다.

## 6. 기존 로그 엔진에서 두 형식 만들기

### 6.1 기존 이벤트의 정확한 의미와 변환

현 엔진은 `tfBotLogEvents(p)`의 `watch/entry/risk/exit-sl/exit-tp/exit-time`이고, `scan`은 `tfTmFeed`가 렌더 중 추가한다(I:L13478–13507,10347–10355). 질문의 `exit`은 이 세 종료 subtype의 상위 개념으로 해석한다. 이 사실을 놓치면 종료 기록 일부가 변환되지 않는다.

공통 envelope는 `eventId,strategyId,strategyVersion,runId,sequence,occurredAt,clockDomain,env,source,inputSnapshotId,correlationId`다. 과거 봉은 `idxToDate(i)`로 두고 `Date.now()`로 새 판단처럼 만들지 않는다. rule replay event ID는 전략버전+데이터버전+봉 index+종류로 결정한다. 주문·체결은 독립 event ID와 참조 관계를 갖는다.

| 기존 event.k | 규칙형 카드 | 별도 agent 데모에서의 대응 | 주의점 |
| --- | --- | --- | --- |
| watch | 전봉 RSI·반등·괴리 조건표, `not_matched`, 주문없음 | input 평가 뒤 `hold`, action=none, nextCheck | 기존 watch를 agent_decision으로 소급 개명하지 않는다. |
| scan | 합성 `market_observation`, 규칙 판정 아님. 과거 watch를 덮어쓴 자리는 rule 재생으로 복구 | 일정 tick의 입력 수집 완료 뒤 정책 평가를 수행 | scan만으로 hold/AI 호출 성공을 추정하지 않는다. 현재 삽입 주기7봉은 AI scheduler가 아니다. |
| entry | 세 조건 matched, `trigger=bar_close`, 모의 진입 참조 | 별도 정책의 enter 결정→주문제출→부분/완전체결 | 조건성립·주문접수·체결은 다른 상태. 원본 trades와 대조한 데모 체결만 표시한다. |
| risk | 보유 포지션의 SL/TP/25봉 검사, 유지 여부 | hold/reduce 검토와 실제 액션 | 이름 risk를 ‘오류’나 계정 전체 위험평가로 해석하지 않는다. |
| exit-sl | SL 도달 평가와 모의 종료·체결 결과 | exit 결정 또는 독립 hard-limit 이벤트 | 종료 이유·실제 사용 청산가·수수료를 보존한다. |
| exit-tp | TP 도달 평가와 모의 종료·체결 결과 | exit 결정 또는 독립 목표 조건 | agent가 결정하지 않은 hard-limit은 agent 판단으로 꾸미지 않는다. |
| exit-time | 보유25봉 조건과 모의 종료 | 일정/만료 결정·행동 | ‘25봉’을 ‘25시간’으로 바꾸지 않는다. |

규칙 카드는 `rules[{id,operator,left,right,unit,matched}]`, `trigger`, `result`, `order`, `riskRule`, `nextEvaluationAt`을 받는다. 예를 들어 RSI44와 임계44는 `<`가 false, 반등1%와 임계0.5%는 `>` true, 괴리9.9%와 임계3%는 `>` true이므로 **‘RSI 조건 미충족·주문 없음’**이다. `tfTmEvSum`의 첫 불충족 사유 문장을 재사용해 모든 실패 조건을 추측하지 않는다.

추가로 SL/TP 청산 때 `runBacktest`는 threshold PnL을 쓰지만(I:L5332–5337), 현재 결정 카드는 `PRICE[i]`를 청산가처럼 쓴다(I:L10459–10461). 새 로그는 같은 모의 체결 결과에서 수량·가격·손익을 읽어야 한다. entryDelay·feeRate 같은 옵션이 있는 result를 변환할 때 로그 재생기가 그 옵션을 지원하지 않으면 ‘기본 규칙 재생’이라고 구분하거나 지원부터 추가한다.

### 6.2 에이전트형은 ‘그럴듯한 입력과 결과’로 만들고 내면 독백은 만들지 않는다

기존 rule 과거 이력은 rule로 보존한다. agent 데모는 **같은 공통 event pipeline에 독립 mock evaluator를 붙인다.** 이 데모가 실제 LLM을 호출한다고 표현하지 않는다. 실제 에이전트 어댑터가 생기면 동일 구조의 입력·결정·주문 결과를 전달한다.

1. `agent-demo-v1` fixture에 BTC/USDT 15분봉 OHLCV, 4시간봉 요약, 계좌예산·포지션·호가단위·평가일정을 저장한다. seed/버전/시계를 고정해 새로고침해도 같은 tick의 값이 같다. 기존 KRW `PRICE`에 USDT 라벨을 붙이지 않는다.
2. 상태 A=거래량 미충족으로 대기, B=가격조건+거래량 충족으로 진입 제안, C=포지션 관리, D=청산/실패를 제공한다. `reasonCode`는 `WAIT_VOLUME/ENTER_CONFIRMED/HOLD_POSITION/EXIT_LIMIT/DATA_STALE`처럼 입력에 대응한다. 데모 정책이 입력에서 결과를 결정하며 화면이 자유롭게 문장을 만들어 결과를 바꾸지 않는다.
3. 사용자용 근거는 evidenceRef에 있는 값만 짧게 렌더한다. 확인하지 않은 뉴스·기관 매수·확률은 추가하지 않는다. 입력 missing/stale일 때는 `DATA_STALE`, 주문없음, 다음 복구 확인 시각을 출력한다.
4. 판단/주문/체결을 단계별로 생성하고, 수량·포지션·PnL·다음 카드가 같은 체결 원장을 읽는다. 실제 fixture 이벤트가 없는 ‘82% 확신’이나 ‘방금 체결’을 텍스트만으로 넣지 않는다.

검산 가능한 agent 카드 예:

```text
데모 재생 · 2026-09-24 14:00 UTC · BTC/USDT · 포지션 없음
입력       15분 종가64,100 · 진입조건64,200 초과
           거래량/20봉평균0.82 · 최소1.20 · 가용예산1,000 USDT
결정       대기
근거       가격과 거래량이 이번 데모의 진입 조건에 미달
행동       주문 없음
다음 확인  14:15 봉 마감 (실행 중인 데모 일정)

데모 재생 · 14:15 UTC
입력       종가64,250 · 거래량/평균1.35 · 포지션 없음
결정       진입, 예산의30% 범위
근거       두 관측 조건 충족, 배정 가능액300 USDT
행동       매수0.00466 BTC 제출 → 모의 전량체결
           체결가64,250 · 명목299.405 USDT · 수수료 별도
다음 확인  14:30 봉 마감 / SL63,450 도달 이벤트
```

이 수치는 **fixture 예시**이며 기존 시드의 실제 관측 결과가 아니다. 수량단위0.00001 BTC, 수수료율0.1%라는 데모 설정이면 수수료0.299405 USDT이고 주문총액299.704405 USDT로300 USDT 배정 안에 들어간다. 수수료 반올림 단위도 fixture에 명시한다. 기대익절65,800을 넣는다면 손익비는 `(65800−64250)/(64250−63450)=1.9375`로 계산하고 표시 여부는 별도 결정한다.

규칙형도 같은 입력 표를 쓸 수 있지만 카드 제목은 ‘규칙 검사’이며 AI의 자유 재량을 암시하지 않는다. hybrid는 rule 이벤트를 parent로 하고 agent 승인/거부 이벤트를 자식으로 연결한다. follow는 원본 판단 카드를 참조하고 내 `follow_sync`와 주문/체결을 별도로 보여준다.

### 6.3 연속 대기와 현재 상태

동일 전략·버전·run·환경·reasonCode·포지션 상태·주기의 연속 hold3건 이상만 접는다. 주문·오류·새 신호·버전 변경·예정 주기의2배 초과 공백이 있으면 그룹을 끊는다. rule 불성립은 별도 ‘조건 미충족 N회’ 그룹이다. **그룹화 후 페이지를 자른다.** 현재는 slice 후 묶고(I:L10360,10375–10378), scan 삽입이 watch 연속성까지 깨므로 이 순서를 교체한다.

오래된 기록을 펼칠 때 다음 확인을 현재 시각 기준으로 다시 만들지 않는다. 운영 중 최신 평가만 scheduler의 nextScheduledAt을 읽는다. 정지·오류·AI 요청 보류는 정상 관망과 별도 operation 이벤트다. 데모 재생은 보이지 않는 화면에서 무한히 실행되지 않도록 lifecycle에서 tick을 정리한다.

## 7. 구현 순서 P0 → P1: 단일 파일 충돌과 회귀 통제

아래는 **향후 수정 범위**다. 이번 라운드에서는 수정하지 않았다. 모든 행 범위는 위 hash 기준이며 선행 패치 후에는 함수명으로 다시 찾는다. 한 사람이 `index.html` writer를 맡고, 세션 간 병렬 작업은 원문 파일 편집 대신 fixture 검토·검증·문서 리뷰로 나눈다.

| 순서 | 함수·행 범위와 수정 범위 | 주된 회귀 위험 | 완료 검증 |
| --- | --- | --- | --- |
| P0-0 근거 고정 | 읽기만: `tfS/tfNFInit` 주변 I:L9250–9300,12575–12621, STORE restore I:L16816–16827. fixture/ID mapping/소스 hash 확보 | 이전 QA reset이 현재 사용자의 cp·원장을 남기거나 지움 | 사용자 namespace 불변,11 fixture 독립 생성, 기존 snapshot 누락 필드 목록 기록 |
| P0-1 정본·순수 derive | `tfNFInit`, `bcInit`, `bcVolumeCharge`, `bcAiDebit`, `bcBranch`, `bcBillQuote`, `bcAppend`, `tfEnt`, `tfAiSpend`, `tfCreditSpend` I:L12575–12950 | 구/신 원장 이중 차감·무료 지급 중복·paid usage 누락·2,000건 절단 | §4의11행·경계금액·중복ID·기간경계·2,001개 원장·unknown 테스트. shadow 결과 차이 기록 후 소비자 전환 |
| P0-2 전략 읽기 모델·이관 | `tfStartStrategy`, `TF_TERM_DEMO`, `tfTmAll/Calc/Of` I:L9958–10086; `tfRankSeeds/SSRows` I:L10965–11023; `cpState/Calc` I:L11374–11412; `tfNFOnLater` I:L13693–13701 | ready의 누락 예산 추정·nick 변경으로 cp 고아·demo가 owned 합계에 잔존 | §5 전 행 변환·이관2회 동일·cp/clone-only·p없는 legacy·이름변경 후 원장불변 |
| P0-3 공통 command·활성화 | `tfConnectView/tfCnUid/tfCnApi/tfDoneView` I:L9691–9955; `tfStartStrategy` I:L9958–9979; `tfTmSetStatus` I:L10102–10121; `gGoLive/gToTerminal/gLivePause/gLiveStop` I:L8131–8190; `cpStart` I:L11854–11879; `tfNFCanRun/tfBotCtl/tfNFOnStart` I:L13450–13475,13660–13690 | 중복시작·대상계정 혼입·즉시/later 이벤트 차이·paper 재개 API요구 | UID/API4조합, API실패 후 재시도, 이중확인1instance, 연구/터미널 동일상태, paper시작/재개, 지연응답 귀속 |
| P0-4 라우트·3뷰·체크아웃 표시 | `tfShareHub` I:L11141–11153; `tfIntroNeed/View` I:L14607–14614,14891–15039; `tfNFRoute/tfRoute` I:L15040–15057,15735–15763; 부팅 I:L16816–16827; `tfPlanView` I:L13150–13195; `tfBkConnect/GoLink` I:L15440–15465 | query미인식·hash삭제·복원전 guest노출·인증복귀 유실·계정설정이 전략에 종속 | 초안없음/미검증/ready·cp-only·전체정지3뷰, 연결화면back/refresh, 기존share/cp/bot URL, current route 재렌더 |
| P0-5 실제 동작과 로그·제목 일치 | `tfBotLogEvents` I:L13478–13507; `tfTmFeed/Mkt/EvSum/EvPrompt/EvChain/EvDecision` I:L10331–10465; 카드 I:L11116–11138; `tfRankSeeds` I:L10965–10981 | 부등호/기간/청산가 오표기·규칙을AI로 재태깅·로그접기로 원장변경 | RSI동률·반등동률·괴리동률, entry/3exit 원결과 대사, 기존 데이터전부rule, agent fixture determinism·가짜 최신성없음 |
| P0-6 QA 진입·표시 회귀 | `tfDevSt/Tgl/Refresh/Reset` I:L15801–15929, 각 화면의 파생출력 소비 | 토글 누적·지연요청으로 preset오염·수동PASS를 자동검증으로 오인 | snapshot 전체교체+generation증가,11행 모두3뷰 overlay, 결과에 fixture/policy/source hash 저장, 일반뷰 QA미노출 |
| P1-1 마켓·follow 상세 | `tfSS3Card/Grid`, `cpProfile/Perf`, `tfSS3PdCalc/DetailRender` I:L11116–11200,11213–11373,11907–12006; `cpSetup/Start/Close/Flat` I:L11481–11598,11735–11879; ss3 clone I:L12231–12334 | 원본/내손익 혼합·설정복제를follow로 변환·예산중복할당·중단 후 잔여포지션 소실 | 동일 기간·버전 수치대사, nick별칭, 설정3단계, 기존포지션skip, 부분체결/잔고부족/중단3방식 |
| P1-2 터미널 밀도·차트·로그 대량 처리 | `tfDashView/tfTmRail/Select/Ctx/Chart` I:L10125–10273; `tfTmBrain/Feed` I:L10300–10402; `tfTmBottom/Pane` I:L10775–10889; 관련 CSS는 selector 검색으로 한 블록씩 | 선택 전략과 차트/로그 엇갈림·모바일제어가림·외부차트와 데모마커 혼합 | 1,260이벤트 그룹/페이지/스크롤, 최신선택만렌더,1440/1024/390폭·키보드·7개언어, 차트adapter 입력대사 |
| P1-3 운영 설정·잔여 경로 제거 | `site-config.js`, `teth-copy.js`, `help-widget.js`, about 및 해당 index 소비자. P0에서는 QA 정책만 사용 | 가격3원천·Bitget요율폴백·지원CTA 준비안내·구형reader잔존 | 정본catalog1개, unknown요율표시, help fallback복귀, root/about/download/policies·기존알림링크 smoke, legacy reader/writer검색0 |

P0에서 따라가기 중단의 **잘못된 기존 pause/stop 의미를 새 버튼으로 노출하지 않는 것**, 원본/내 로그를 구분하는 최소 adapter는 먼저 한다. 고급 CSL·drain·handoff·새 chart adapter가 P1이면 해당 capability 버튼도 P1까지 비활성/미노출이다. P0 종료 시 가능한 동작만 제공하며 ‘P1에 구현할 실행’을 완료된 기능처럼 표시하지 않는다.

P0 필수 assertion은 다음과 같이 묶는다. 테스트 파일 개수가 아니라 이 계약의 통과 여부로 완료를 판정한다.

- **분류·청구:**11행, unclassified, unknown, 임계값 동률,⑧ 유료/⑨ 무료,0원·잔여0,기간 경계,중복 요청/체결,원장 표시 절단.
- **연결·전이:**U/E4조합,대상 계정 불일치,UID/API 부분완료,실패→재시도,늦은 성공,중복 시작,즉시/later,연구/터미널,paper 재개.
- **복원·대상:**초안0/미검증/ready,cp-only/clone-only,모두정지,preview복귀,새로고침/뒤로가기,이관2회,닉네임 변경,전략A응답이B선택 후 도착.
- **표현:**규칙 부등호·청산가격·기간·출처·통화가 결과와 일치,에이전트 입력 누락,정지 시 카운트다운 중단,지원 문의 fallback,기존 페이지 및 모바일 제어.

충돌 없이 작업하는 절차:

1. 매 패치 전에 mailbox 확인·git status·해당 함수 현재 hash 확인. 실제 편집자가 `claim`으로 **함수 영역**을 알린다. 다른 세션의 claim이 있으면 영역을 겹쳐 고치지 않는다.
2. P0-1→P0-2→P0-3 순서로 데이터 계약을 확정한다. 서로 멀리 있는 함수여도 같은 전역 필드를 읽으면 독립 변경으로 취급하지 않는다. 큰 포맷팅·함수 이동·라우트 일괄 치환은 하지 않는다.
3. 상태 writer 전환은 단위별로 원자화한다. shadow derive는 읽기 비교만 하고, 전환 이후 legacy writer가 새 원장을 따로 변경하지 못하게 한다. 완료되지 않은 단계는 adapter 경계로 되돌린다.
4. P0-4 이후에 뷰·문구를 붙인다. 코드 행 번호는 매 패치 뒤 다시 찾는다. 프론트엔드 리뷰는 편집 완료본의 동일 hash를 대상으로 요청하고 다른 세션이 같은 파일을 동시에 직접 고치지 않게 한다.
5. 기능별 검증·`git diff --check`·현재 코드에 맞는 AGENTS 문서 갱신을 **향후 구현 작업** 안에서 수행한다. release에 변경 함수·검증 결과·미확인 항목을 적는다. 다음 영역 writer는 최신 파일을 다시 읽고 이어받는다. 이번 라운드는 단일 반박문 요청이므로 AGENTS 자체를 변경하지 않는다.

## 8. 끝까지 양보하지 않는 3개

1. **11개 상업 ID가 실행 권한·운용 화면을 대신하지 않는다.** UID/API/플랜/잔액/전략 버전/계정/실행 환경을 분리하고 같은 파생 결과를 모든 화면이 읽어야 한다. 미분류를 거짓 분류로 숨기지 않는다.
2. **기존 규칙을 AI로, 과거 검증을 현재 판단으로, 연결 성공을 체결 완료로 바꾸지 않는다.** agent 경험은 충분히 만들 수 있다. 대신 별도 입력·정책·일정·행동 fixture를 만들고 데이터에서 설명을 생성해야 한다.
3. **화면을 줄여도 원본·내 전략·예산·주문·체결·복귀 의도는 보존한다.** 이름·레이아웃 개편 때문에 기존 사용자 기록이 고아가 되거나 중복 실행되어서는 안 된다. 어려운 기능은 capability와 단계적 adapter로 구현하며 문구로 완료를 대신하지 않는다.

## 검증 기록과 한계

- 지정된5개 문서를 읽고 관련 실제 함수·설정을 교차 확인했다. R에서 이미 고친 결정을 현재 반대 의견으로 재사용하지 않았다.
- 원본 `tfBotLogEvents`를 Node VM에서 격리 실행했다. RSI동률→watch, 역배열+충분한 괴리→entry를 확인했다. PRICE·rsi·sma 입력은 통제된 fixture이므로 실제 시장 발생 빈도를 주장하지 않는다.
- 원본 `cpPerf`에 전체20%·최근30일-4% 곡선을 넣어 양립 가능성을 확인했다. 실제 세븐틴층 스크린샷의 특정 수치를 브라우저에서 재현했다는 뜻은 아니다.
- 새 KRW fixture의 청구 산식을 독립 재계산했다. 기대값은 `[null,0,0,0,0,189000,39000,0,179000,0,29000]`이다. 새 derive·라우터·UI·agent evaluator를 구현하거나 실행한 결과는 아니다.
- 제품 소스 hash가 작업 전후 동일하고 `git diff --stat`가 비어 있음을 확인했다. `rtk proxy git diff --check` 및 새 문서의 no-index check를 통과했다. 미추적 문서를 별도 검사해 Claude10건·AGY13건·상태11행, 표 열 수·코드펜스·후행 공백·문서 링크 오류0건을 확인했다. RTK 기본 git/rg 호출의 설정 디렉터리 오류 때문에 `rtk proxy` 경로로 동일 명령을 실행했다.
- 브라우저 렌더·모바일·모달·뒤로가기·차트 외부 API·실제 AI/거래소/결제·실시간 고객지원은 이번에 실행 검증하지 않았다. §7은 구현 이후 수행할 검증 계획이며 통과 결과가 아니다.
