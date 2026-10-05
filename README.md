# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **전체 서비스 완성·실거래 운영 승인본은 아닙니다.**

현재 React 스냅샷의 출처는 **`agent/web/guest-broker-continuity@8197c71efd58223df6f162ef7b0c043e16431149`**입니다. 전체2,218파일을 전달한 **운영 미배포 초안**입니다. 이전 인증 소비 교정 위에 누락된 게스트 거래소·플랜 상단 로그인/무료 시작과 데스크톱 언어 진입점을 최소 복원했고, 첫 방문 배너가 버튼을 가리지 않도록 배치 조건을 보완했습니다. Google·Apple·이메일과 원본 UI·문구·SVG·SDK·provider flags를 모두 보존하며, 실제 등록되지 않은 방식은 기존대로 준비 중입니다. 요청하지 않은 로그인 제거·활성화·프롬프트 producer 통합·서버/DB 변경은 하지 않았습니다. 거래소 연결은 기본 비활성화입니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치 push는 `main` 병합이나 자동 배포를 실행하지 않습니다. 사용자가 별도로 요청한 `teth.ai` 정적 프론트 업데이트는 [검증 기록](migration-verification.json)의 배포 상태로 구분합니다. 루트 원본·server/Worker 및 투자 프롬프트 draft `8646b65`는 이번에 병합·배포하지 않습니다. Apple·이메일 선택지는 유지하되 현재 서버에서 미연결인 방식은 ‘준비 중’으로 표시합니다.

현재 입력2211/b392f02에서 신규20개·주변390개는 각각 모두PASS/actual0이고 lint·공개/내부/service3build도 통과했습니다. 같은 service1113/bc1def bundle의 정적 GET exactbytes와 로그인3폭 합성 UI 관측을 결속했습니다. personal(1) 실제 Opus5.5 및 최종 독립 검수는 이 UI 범위의 CODE_GO/신규 확정C/H/M0입니다. 이전 source2ac의 단일14958 전수는14940PASS/1FAIL/기존17SKIP/actual1로 종료했습니다. 실패는 locale 변경 평가 Promise GC이며 원인은 아직 미확정입니다. 격리2PASS·새20/390으로 원FAIL을 면제하거나 전체PASS로 합산하지 않습니다. 원FAIL·Low·미검증 가설을 유지하고 정적 프론트 승격은 HOLD입니다. 실제 로그인·React 프롬프트·전체 서비스 승인은 별도이며, 실 OAuth 미검증만으로 모든 정적 UI 승격을 금지하는 정책은 아닙니다.

**현재 teth.ai는 이전 출처 `7dd066f`의 정적 UI입니다.** 이번 초안으로 교체하지 않았습니다. [검증 기록](migration-verification.json)의 현재 후보와 이전 운영 배포 증거를 구분해 확인하세요. 실제 사용자 Google callback/ACK 완료, Apple·이메일 운영 연결, React 프롬프트·거래소·주문 활성화 및 전체 서비스 완료는 미검증/미완료입니다.

추가 경계 관측에서는 프랑스어320px 계정 화면의 긴 인증 버튼이 두 줄로 접히며 복귀 버튼을 가리는 신규 회귀8개를 확인했습니다. 기준source2ac의 같은8표면은 정상 클릭됐습니다. 861px의 복귀 버튼과 About 헤더링크 겹침은 기준에도 있던 기존 문제입니다. 이 관측은 앞20/390과 모델 검수 범위 밖에서 발견했고, 본문이나 정책을 임의 교체하지 않고 최소 배치 교정을 별도 진행합니다. 현재 전달8197에는 아직 교정되지 않았으며 운영 HOLD를 유지합니다.

이전 Node 반례에서는 로그인 패널 컨트롤러의 Google/Apple 세션 확인이 revision 불일치를 수용했습니다(4controlsPASS/2FAIL/actual1). 현재 스냅샷에는 해당 소비 guard 교정과 이전입력 단일578PASS가 포함되어 있습니다. 원FAIL은 이력으로 보존하며, 현재도 미수정인 경로라고 표시하지 않습니다. 이 교정이 실제 공급자 로그인 성공을 증명하지는 않습니다.
