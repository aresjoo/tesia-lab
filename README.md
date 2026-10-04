# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **전체 서비스 완성·실거래 운영 승인본은 아닙니다.**

현재 React 스냅샷은 **기존 UI 복구 및 로그인 방식 공존 수정본**입니다. 정확한 출처 커밋은 manifest의 `sourceCommit`을 따릅니다. 병합 main `62b5e69`와 **거래소 연결 draft PR54 코드**를 보존하면서 AI 트레이딩 소개·공개 목록·설정·문서 탐색·키보드 복귀 및 Google·Apple·이메일 선택지를 보완했습니다. 거래소 연결은 기본 비활성화이며, 코드 전달과 실제 서비스 완료는 다릅니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치 push는 `main` 병합이나 자동 배포를 실행하지 않습니다. 사용자가 별도로 요청한 `teth.ai` 정적 프론트 업데이트는 [검증 기록](migration-verification.json)의 배포 상태로 구분합니다. 루트 원본·server/Worker 및 투자 프롬프트 draft `8646b65`는 이번에 병합·배포하지 않습니다. Apple·이메일 선택지는 유지하되 현재 서버에서 미연결인 방식은 ‘준비 중’으로 표시합니다.

사용자 승인으로 React 출처 `fa8601e`의 정적 번들을 **teth.ai에 반영 완료**했습니다. 단일1,674개 회귀·lint/build·비밀정보 검사, 배포 후 공개 자산350개·정보 경로4개·화면3폭 및 실제 Google START201/인증 대기 경계를 확인했습니다. 기존 서버·키·DB를 교체하지 않았고 rollback 백업을 보존합니다. 실제 사용자 Google callback/ACK 완료, Apple·이메일 연결, 프롬프트·거래소·주문 활성화는 완료로 표시하지 않습니다.
