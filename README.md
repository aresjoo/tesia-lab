# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **전체 서비스 완성·실거래 운영 승인본은 아닙니다.**

현재 React 스냅샷의 출처는 **`agent/web/release-closure@ef6e1d0364b34972ae399b462b8bd538cb8f5e4a`**입니다. 전체2,214파일의 byte/hash를 확인한 **운영 미배포 초안**입니다. 제품·시험 코드d9e5609에 남은 컨트롤러 반례의 보고서만 추가했습니다. 기존 누적 이식·거래소 연결 draft PR54 코드와 Google·Apple·이메일 선택지를 모두 보존합니다. 기존 OAuth 복귀·미전송 입력 보존 교정 위에, 복귀 화면의 직접 세션 GET 두 곳에서 기존 meta/data revision 일치 검사를 추가했습니다. 인증 SDK·provider·API·프롬프트·권한·가격·패키지·색상·SVG·DB는 바꾸지 않았습니다. 거래소 연결은 기본 비활성화입니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치 push는 `main` 병합이나 자동 배포를 실행하지 않습니다. 사용자가 별도로 요청한 `teth.ai` 정적 프론트 업데이트는 [검증 기록](migration-verification.json)의 배포 상태로 구분합니다. 루트 원본·server/Worker 및 투자 프롬프트 draft `8646b65`는 이번에 병합·배포하지 않습니다. Apple·이메일 선택지는 유지하되 현재 서버에서 미연결인 방식은 ‘준비 중’으로 표시합니다.

최종2207/0a217 입력의 양project 복귀72개·기존 로그인482개·원 copy-management30개는 각각 전부PASS/actual0이며, 같은 입력 lint·공개/내부/service3build actual0 및 personal(1) 실제 Opus5.5 REVISION_CONSUMER_CODE_GO/신규C·H·M0를 확인했습니다. readonly 독립 delta와 좁은 가시 UI 검수도 별도로 인수했습니다. 같은 입력의 전체534spec/14,934개는 진행 중입니다. 낮은 우선순위·범위외 가설·실공급자 검증은 남습니다. 이전 corrected 전체531spec/14,862개는 **14844PASS/1FAIL/기존17SKIP/actual1**로 종료됐고 모바일 복사전략 종료 확인 실패의 원인은 미확정입니다. 분리 재검증 PASS로 원FAIL을 면제하지 않습니다. 원155/최초전체/하니스 FAIL은 보존하며 영향 PASS와 코드 검수를 전체 PASS나 배포 승인으로 확대하지 않습니다.

**현재 teth.ai는 이전 출처 `7dd066f`의 정적 UI입니다.** 이번 초안으로 교체하지 않았습니다. [검증 기록](migration-verification.json)의 현재 후보와 이전 운영 배포 증거를 구분해 확인하세요. 실제 사용자 Google callback/ACK 완료, Apple·이메일 운영 연결, React 프롬프트·거래소·주문 활성화 및 전체 서비스 완료는 미검증/미완료입니다.

추가 Node 반례에서 로그인 패널 컨트롤러의 Google/Apple 세션 확인은 같은 revision 불일치를 수용했습니다(4controlsPASS/2FAIL/actual1). host 장착·ACK·claim·실공급자는 실행하지 않아 인증 우회로 확대하지 않으며, 이 미수정 경로도 운영 HOLD의 잔여로 기록했습니다.
