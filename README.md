# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **전체 서비스 완성·실거래 운영 승인본은 아닙니다.**

현재 React 스냅샷은 **`agent/web/research-validation-copy@84e82a939d8873c0b8bbd7b7f3e03a6f386e768e`**입니다. source `84e82a939d8873c0b8bbd7b7f3e03a6f386e768e`의 전체2,233파일/26,213,605bytes/snapshot `929f851ac0b0d3c5429463c01619da7d61155a868ad0b57c69ab4b42190c9abf`다. 부모5510 대비 제품1·시험2·MD2의5경로만 바뀌었다. 완료 bt2의 일반 질문에도 원9fb20891 요약을 연결하며95초/완료·복구·v1·제외질문·supplied 우선권을 유지한다. 기존 레일 언어 시험은 실제 동기 setter bridge를 재사용한다. 새 카피/디자인/숫자/기능/권한/Native 응답/flags 변경0이다. 최신 검사·잔여는 `candidate.currentCompletedBacktestReply`와 [Bugfix 보고서](react-app/Bugfix_report.md) 최상단을 따릅니다. 아래 가설 복원 수치는 이전 입력의 기록입니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치 push는 `main` 병합이나 자동 배포를 실행하지 않습니다. 사용자가 별도로 요청한 `teth.ai` 정적 프론트 업데이트는 [검증 기록](migration-verification.json)의 배포 상태로 구분합니다. 루트 원본·server/Worker 및 투자 프롬프트 draft `8646b65`는 이번에 병합·배포하지 않습니다. Apple·이메일 선택지는 유지하되 현재 서버에서 미연결인 방식은 ‘준비 중’으로 표시합니다.

최종2225/9b2 입력의 원문10키는6PASS/4FAIL에서10PASS로 복원됐고 이를 포함한 관련4spec82개도82PASS/actual0입니다. 같은 입력의 lint·공개/내부/service3build actual0, 원문·시험 독립 대조 및 실제 personal(1) Sonnet5.5 `COPY_CODE_GO`/C0H0M0/Low8·가설5를 확인했습니다. 추가 Native 기능은 복원 배치에서 제외·원복했습니다. 작은 수정마다 전체 회귀를 반복하지 않고 구간별 병렬 복원·관련 시험 후 최종 배치에서 필요한 전체1회를 수행합니다. 부모d11d 전수69219는 다른 입력의15,097PASS/152FAIL/기존17SKIP/후단미실행6/actual1로 종료했고 실패 원인은 미확정으로 보존합니다. 최신 기록은 `candidate.currentHypothesisOriginalReply`와 [Bugfix 보고서](react-app/Bugfix_report.md) 최상단입니다. 전체·서비스·운영GO나 전페이지 동일성을 주장하지 않습니다.

이하 시험 수치와 ‘현재’ 표현은 이전 입력의 누적 인수 이력입니다. 부모314304의46카피·878검증은 `candidate.currentApprovedCopyRestoration`에 보존하며 현재bd2 전체검증으로 승계하지 않습니다.

부모 source9d/2212/4f0의 단일539spec/15,026개는 15009PASS/0FAIL/원17SKIP/미실행·중단·retry·flaky·시험밖오류0/actual0로 종료했습니다. 이 전수를 최신 카피 입력의 전체PASS로 승계하거나878과 합산하지 않습니다. 이전68/26/390과 모든 원FAIL/Low·미확정 GC인과는 별도 이력으로 보존합니다. 정적 프론트 승격은 최종정적 release 검수·정확한 archive/권위CAS·공개smoke·원자적전환/롤백 확인 전 HOLD입니다. 실제 로그인·React 프롬프트·전체 서비스 승인은 별도이며 실 OAuth 미검증만으로 모든 정적 UI 승격을 금지하는 정책은 아닙니다.

**현재 teth.ai는 이전 출처 `7dd066f`의 정적 UI입니다.** 이번 초안으로 교체하지 않았습니다. [검증 기록](migration-verification.json)의 현재 후보와 이전 운영 배포 증거를 구분해 확인하세요. 실제 사용자 Google callback/ACK 완료, Apple·이메일 운영 연결, React 프롬프트·거래소·주문 활성화 및 전체 서비스 완료는 미검증/미완료입니다.

이전8197에서 발견한 French320의 두 행 인증 배치 회귀와861의 복귀 버튼 가림은 현재 CSS 두 항목으로 교정했습니다. 원 신규48의16PASS/32FAIL을 보존하고 같은48키와 기존20키의 단일68PASS에 결속했습니다. 실제 hero 질문 한 번·선언 합성 CREATE/TURN으로 대화 뒤에도 계정 문서 진입과 강제클릭 없는 복귀를 검증했습니다. 다른 장문 번역·glyph 잘림·실Safari 및 원 계정 정책 동등성은 Low/미검증으로 남습니다.

이전 Node 반례에서는 로그인 패널 컨트롤러의 Google/Apple 세션 확인이 revision 불일치를 수용했습니다(4controlsPASS/2FAIL/actual1). 현재 스냅샷에는 해당 소비 guard 교정과 이전입력 단일578PASS가 포함되어 있습니다. 원FAIL은 이력으로 보존하며, 현재도 미수정인 경로라고 표시하지 않습니다. 이 교정이 실제 공급자 로그인 성공을 증명하지는 않습니다.
