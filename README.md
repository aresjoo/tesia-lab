# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **전체 서비스 완성·실거래 운영 승인본은 아닙니다.**

현재 React 스냅샷의 출처는 **`agent/web/auth-regression-closure@2acaa3858e55970f77f232f02e73776cafb5dcdd`**입니다. 전체2,215파일을 전달한 **운영 미배포 초안**입니다. 이전 인증 소비 교정 위에 테스트 두 파일의 오래된 기대만 맞췄습니다. Google·Apple·이메일과 원본 UI·문구·SVG·SDK·provider flags를 모두 보존하며, 실제 등록되지 않은 방식은 기존대로 준비 중입니다. 요청하지 않은 로그인 제거·활성화·프롬프트 producer 통합·서버/DB 변경은 하지 않았습니다. 거래소 연결은 기본 비활성화입니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치 push는 `main` 병합이나 자동 배포를 실행하지 않습니다. 사용자가 별도로 요청한 `teth.ai` 정적 프론트 업데이트는 [검증 기록](migration-verification.json)의 배포 상태로 구분합니다. 루트 원본·server/Worker 및 투자 프롬프트 draft `8646b65`는 이번에 병합·배포하지 않습니다. Apple·이메일 선택지는 유지하되 현재 서버에서 미연결인 방식은 ‘준비 중’으로 표시합니다.

현재 테스트 교정은 availability10개·service-entry40개를 각각 모두PASS/actual0로 확인했고, lint·공개/내부/service3build도 통과했습니다. 작은 personal(1) Sonnet5.5와 별도 독립 검수는 이 하니스 범위의 CODE_GO입니다. 이전 인증578PASS/Opus5.5는 이전입력의 영향범위로 보존합니다. 원전체14934는14879PASS/12FAIL/기존17SKIP/후속26미실행/actual1로 끝났으며 새14958 전수는 RUNNING입니다. 원FAIL·Low·copy 원인 미확정 이력을 지우거나 부분PASS를 합산하지 않습니다. 실Google callback/Apple등록/SMTP·React prompt producer·전체서비스/운영 승인은 미완료이므로 teth.ai는 기존 운영본을 유지합니다.

**현재 teth.ai는 이전 출처 `7dd066f`의 정적 UI입니다.** 이번 초안으로 교체하지 않았습니다. [검증 기록](migration-verification.json)의 현재 후보와 이전 운영 배포 증거를 구분해 확인하세요. 실제 사용자 Google callback/ACK 완료, Apple·이메일 운영 연결, React 프롬프트·거래소·주문 활성화 및 전체 서비스 완료는 미검증/미완료입니다.

추가 Node 반례에서 로그인 패널 컨트롤러의 Google/Apple 세션 확인은 같은 revision 불일치를 수용했습니다(4controlsPASS/2FAIL/actual1). host 장착·ACK·claim·실공급자는 실행하지 않아 인증 우회로 확대하지 않으며, 이 미수정 경로도 운영 HOLD의 잔여로 기록했습니다.
