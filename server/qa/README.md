# 투자 상담 QA와 교정 증거

공개 기록은 원 답변·기준·실패·당시 정책을 보존한다. 최종1.42의59사례146응답은 전부 생성 완료했다. 원140 번역 누락과141 ETF 대상 확인 누락은 새 실제 답변에서 해소됐으며 원 FAIL은 남긴다. 실제 답변·화면·source·전체 회귀와 고객 서비스 인수는 각각 판정한다.

[교정 기록](concise-dialogue.json)은 각 실제 응답·당시 입력/정책/helper·원 acceptance·검수 원문과 해시를 보존한다. 원 [사용 QA](investment-usability.json), [35MB 기록](../tests/recorded-investment-turns.json), [초기 원본 비교](prompt-comparison.json)는 불변이다.

현재 helper는 일반 대화의 질문 중단과 자료 형식 귀속만 추가 교정했다. [source-only 결속](response-preference-correction.json)은 평가 당시 helper와 현재 helper를 구분한다. 신규 사용성 13개 및 직접 영향 시험 1,108개가 통과했고, 기존 146개·6개 요청의 system/messages/선호/원문 근거를 정확 재생했다. 새 모델 호출·새 브라우저 실행은 0이며 아래 기록의 실제 응답·점수·실패를 변경하지 않았다. 합성 표시 태그 재조립은 실제 내부 추론 유출이나 주문 실행 증거가 없어 이번 수정 범위에서 보류했다.

| 정책 | 실제 사례 / 응답 | 범위 |
|---|---:|---|
| 이전1.24 사용 QA | 12 / 24 | 원4실패 보존 |
| 1.25–1.28 | 83/145 → 97/170 | 금융·문안·인용·전언·일반주제 오인 실패 보존 |
| 1.29 | 106 / 191 | 당시 전량 실제 평가 |
| 1.30–1.32 | 새13/33·12/36·14/42 | 알려진 새 경계; frozen1.32 과거260 요청 동치는 별도 역사 증거 |
| 1.33 | 전량162 / 351 | strict336PASS4FAIL·초기설정11 별도; 정확 정수203/203 |
| 1.34 | 선택75 / 140 | strict138PASS2FAIL·정수87/87·언어66/66; 원전량133 유지 |
| 1.35 | 선언22 / 41 | 원wrapper32/61의 추가10/20·중복 및 hash/format 미기록 보존 |
| 1.36 | 39 / 86 | 원22/41 그대로+신규17/45; captured request hash/format86과 실제 이력 재생86 동일 |
| 1.37 | 67 / 170 | 원25/44 그대로+신규42/126; actual170완료·입력불변, fullhelper NO_GO와 추가 RED 보존 |
| 1.38 | 88 / 233호출·232완료 | 실패1과 원추론문 노출, strict230PASS2FAIL1미평가; 금융25/44 원AC PASS, UI48 별도 |
| 1.39 | 59 / 146호출·145완료 | 실패1·reasoning노출과 strict141PASS4FAIL1미평가, 금융24/25사례·43/44턴 PASS 및Low5, UI48 별도 |
| 1.40 | 45 / 104완료 | strict103PASS1FAIL·의미94PASS9WARN1FAIL, 금융25/44 PASS·Low3사례5건, UI48 별도; 새sourceHigh와번역누락실패 보존 |
| 1.41 | 52 / 125완료 | strict123PASS2FAIL·의미111PASS13WARN1FAIL, ETF 대상 확인 누락과 TITLE 해석 별도, UI48 PASS |
| 1.42 | 59 / 146완료 | 금융 본문25/44 PASS·Low4사례5건·긴복문 UX M1, UI48 PASS·69.346초; strict145PASS1TITLE해석FAIL·의미132PASS14WARN0FAIL·정수112/112·언어110/110·중단7/7 |

원be935와 비교9fb의 index/Node/Worker bytes는 동일하며 browser→Anthropic SDK/SSE·market tools·판단/보고 흐름을 대조했다. 후속은 기존 registry1.24/activation guard를 계승한다. 초기 원본18응답의6선호1동률, 이전1.24 동일12사례와1.34의9개선3동등0악화는 별도 관측이다. 새1.36 동일12/24 독립검수도 새 원문으로9개선3동등0악화였다. 별도13/20 원AC확정위반0이지만 두 문장에 조건을 몰아넣는 답변 M1·Low12는 후속에서 재평가하며 원판정을 보존한다. 과거 점수를 승계하거나 유한 관측으로 전체 품질을 보증하지 않는다.

1.36 당시 같은12사례24턴의 표시태그를 동일 parser로 제거한 분량 비교에서 상세 요청을 제외한23턴은5,177→3,984 Unicode codepoints(23%감소)였다. MDD 상세 턴1,476→569는 정의·기간·기록간격·회복시간·입출금 한계를 보존했지만 선택적 깊이가 줄었다. 금융 검수에서 해당 필수 누락은 발견하지 못했다. 글자수는 읽기 부담의 관측이며 금융 품질·토큰 비용·일반 우수성의 증명이 아니다.

실제 원전략/cfg 차이의 설명 순서, 반복 ASK, 금/국채 신용과 ETF 현금흐름, 스톱 미체결 누락, 숏 부호와 사전 기준 한 축은 같은 사례에서 다시 관측했다. rawTITLE 세션명과 본문 제목의 차이, if 가정을 정정으로 바꾸라는 기존 메타 기준 충돌, 문안N 해석쟁점 및 금융Low는 원판정과 분리 보존한다. 기준을 바꿔 모두 PASS로 만들지 않는다.

새1.36 실제24응답을1440/390px에서 재생한48검사는48PASS·0FAIL·70.783초다. 원14 assertion·source·응답을 유지했고 CLI24 system/messages는 정확 재구축했다. browser48은 system은 같고 context를 포함한 전체messages는 다르다. 인증·시장·SSE·글꼴은 fixture이며 일부PNG composer 공백·실OS 키보드·Safari·부하의 한계가 남는다. 새 모델48호출이나 고객 E2E로 세지 않는다.

자동검사는 raw/source/review 해시, 실제 assistant 이력의 당시 요청, 원발화/criteria 불변과 형식·UTF-16 근거·bounded CPU를 확인한다. 전체/집중 source TIMEOUT, 원RED, 초기 후보 회귀, QA 준비/포장 오류와 검수 정정은 남긴다. 새 현재명령·자료 경계는 사전 기대→원소스 RED→교정→기존 긍정 회귀→실제 응답→독립 검수 순서로 인수한다. Node22/24 전체·syntax·Worker dry-run 최종 수치는 마지막 후보와 결속해 기록하며 dry-run은 배포하지 않는다.

ROOT와 네이티브 금융/개인화/Astra 및 지정Codex5.6SolHigh 출력Gate/byte-budget4역할, exact personal(1) Opus5.5 high/tools0 독립 검수를 활용한다. CLI JSON actual-assistant 평가와 SDK role wire·고객provider·hidden holdout은 다르다. 최신 React2,423·Backend API13/14 구현은 존재하지만 이 후보의 동적 선호·gate·typed producer·예약tuple/fullsystem byte budget 소비 인수는 별도다. 고객provider·운영변경·main병합·배포·주문0, 전체서비스 GO0이다.

최신1.42는 기존1.24와 동일12사례24턴을 중립X/Y로 사례별 균형 배정해 독립 personal(1) Opus5.5 high가 실제48답변을 읽었다. 사전 매핑 복호화 결과11개선·1동등·0악화이며 필수 금융 조건 누락0이다. 상세 요청을 제외한23턴의 본문 가시문자는 동일 parser로5,177→3,687(28.8%감소)이었다. 상세 요청1턴은1,476→505로 줄었지만 검수는 요청한 의미·한계를 보존한 것으로 판독했고 줄글의 중복·훑어보기 부담은 남겼다. 원문·모델 의견·5개 해석쟁점·사례별 매핑을 archive에 보존한다. 단일 평가자와 공개 유한 표본의 관측이며 금융 정확성의 외부 검증·토큰 비용·실고객 품질의 통계적 증명이 아니다.

Source142 사전8반례는5PASS3FAIL→7PASS1FAIL이며 교정대상7은전부PASS다. 남은 M-D1 “요약해줘: 영어로”는 자료로 처리하는 지원 제한으로 원 EN기대/KO실제/FAIL을 보존한다. 질문 중단 전언 채택·모호한 언어 수식의 기존2해석경계와 합산하거나 원8을전부PASS로 재표기하지 않는다. 네정책의1,056개 유효전체system은 최대32,751B/기존32,768B 한도 이내다. 원141 불변 검사 중 ROOT의142 채택으로 발생한 guard FAIL과 채택후142freeze일치 검사는 각각 남긴다.

독립 최종 source142 판정은 원7반례 인수와 새 H-E1 가설1·M2·Low2의 조건부(codeGo:false)이며 원문을 보존한다. ROOT는 본문 첫 문장과 인용 제목의 명확한 자료2형상을 사전 선언해 실제2FAIL로 재현했고 별도helper 후속에서2PASS로 교정하고 실제2사례6턴을 추가 완료했다. M-E2의 policy×helper 결속은 Astra의 실제1.42조합 재검산 증거로 구분한다. M-E1의 배경 문맥과 제공자료 모호성은 지원 제한으로 명시하며 형식·질문 중단은 별도 사용자 턴을 사용한다. 제어태그+NEXT 제거로 literal문자열이 재조립되는 L1은 원형2를실행해 이스케이프된표시임을 확인했으며 실제사고문·주문권한으로판정하지않는다. ROOT 조건 인수는 새 독립 Opus 무조건GO로 재표기하지 않는다.

마지막 helper 후속은 정책 registry1.42를 유지한 채 본문 첫 문장과 인용 제목의 자료 판정을 교정했다. 새2사례6턴의 실제응답은 기존146과 별도 기록한다. 기존146 captured요청과 browser48기록 요청의 policy/system/messages/선호/UTF-16근거는 새helper에서도 동일했지만 이를152개 최종helper 신규호출이나새UI48실행으로 승계하지 않는다. source조건은 사전2RED→독립2GREEN·원8제한보존·전량146/48결속·새6실제응답으로ROOT가인수했다. 독립Opus 원조건부(codeGo:false)는 그대로며 새무조건GO로표기하지 않는다.

교정 전 공개19단계 archive와 runtime11파일을 결속한 전체 검사는 Node24.14.0과 지원최저 Node22.15.0에서 각각1,412PASS·0FAIL·0SKIP·actualexit0이었다. syntax3·Worker dry-run·diff whitespace 검사도actual0이며 Worker656.98KiB/gzip133.77KiB, 배포0이다. 정책은1.42.0, 평가 당시 helper는 a4fd9d08이며 원1.42 146턴과후속6턴의 raw·해시·독립검수는 각각보존한다. 현재 helper의 검증은 위 source-only 결속으로 구분한다. CLI/provider/UI/source 결과는합산서비스GO가아니다.
