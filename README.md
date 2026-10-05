# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **전체 서비스 완성·실거래 운영 승인본은 아닙니다.**

현재 React 스냅샷의 출처는 **`agent/web/guest-broker-continuity@9d919d87be23744fe13484d23d3e88d246e452ad`**입니다. 전체2,219파일을 전달한 **운영 미배포 초안**입니다. 이전 인증 소비·게스트 문서 표시 복원 위에 장문 인증 버튼과 복귀 버튼의 겹침을 최소 교정했습니다. Google·Apple·이메일과 원본 UI·문구·SVG·SDK·provider flags를 모두 보존하며, 실제 등록되지 않은 방식은 기존대로 준비 중입니다. 요청하지 않은 로그인 제거·활성화·프롬프트 producer 통합·서버/DB 변경은 하지 않았습니다. 거래소 연결은 기본 비활성화입니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치 push는 `main` 병합이나 자동 배포를 실행하지 않습니다. 사용자가 별도로 요청한 `teth.ai` 정적 프론트 업데이트는 [검증 기록](migration-verification.json)의 배포 상태로 구분합니다. 루트 원본·server/Worker 및 투자 프롬프트 draft `8646b65`는 이번에 병합·배포하지 않습니다. Apple·이메일 선택지는 유지하되 현재 서버에서 미연결인 방식은 ‘준비 중’으로 표시합니다.

현재 입력2212/4f0에서 신규48+기존20의 단일68PASS, 시장26PASS, 기존10spec390PASS를 각각 실제exit0로 확인했습니다. lint·공개/내부/service3build 및 새service1113/f2a263cf의 정적 GET exactbytes·로그인1440/390/320 합성 표시 검증도 actual0입니다. readonly 독립 검수와 personal(1) 실제 Opus5.5 ACCOUNT_LOCALE_CODE_GO는 새 확정C/H/M0·Low7을 보존합니다. 새 단일 전체539spec/15,026개는 진행 중이며 종료 전 PASS로 표시하지 않습니다. 이전 source2ac의14940PASS/1GC FAIL/기존17SKIP/actual1과 미확정 원인은 보존하고 68/26/390을 합산하거나 원FAIL을 면제하지 않습니다. 정적 프론트 승격은 전체 종료와 배포 검증 전 HOLD입니다. 실제 로그인·React 프롬프트·전체 서비스 승인은 별도이며 실 OAuth 미검증만으로 모든 정적 UI 승격을 금지하는 정책은 아닙니다.

**현재 teth.ai는 이전 출처 `7dd066f`의 정적 UI입니다.** 이번 초안으로 교체하지 않았습니다. [검증 기록](migration-verification.json)의 현재 후보와 이전 운영 배포 증거를 구분해 확인하세요. 실제 사용자 Google callback/ACK 완료, Apple·이메일 운영 연결, React 프롬프트·거래소·주문 활성화 및 전체 서비스 완료는 미검증/미완료입니다.

이전8197에서 발견한 French320의 두 행 인증 배치 회귀와861의 복귀 버튼 가림은 현재 CSS 두 항목으로 교정했습니다. 원 신규48의16PASS/32FAIL을 보존하고 같은48키와 기존20키의 단일68PASS에 결속했습니다. 실제 hero 질문 한 번·선언 합성 CREATE/TURN으로 대화 뒤에도 계정 문서 진입과 강제클릭 없는 복귀를 검증했습니다. 다른 장문 번역·glyph 잘림·실Safari 및 원 계정 정책 동등성은 Low/미검증으로 남습니다.

이전 Node 반례에서는 로그인 패널 컨트롤러의 Google/Apple 세션 확인이 revision 불일치를 수용했습니다(4controlsPASS/2FAIL/actual1). 현재 스냅샷에는 해당 소비 guard 교정과 이전입력 단일578PASS가 포함되어 있습니다. 원FAIL은 이력으로 보존하며, 현재도 미수정인 경로라고 표시하지 않습니다. 이 교정이 실제 공급자 로그인 성공을 증명하지는 않습니다.
