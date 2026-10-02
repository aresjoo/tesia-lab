# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **완성·배포 승인본이 아닙니다.**

현재 React 스냅샷은 `tesia-web` 병합 main **`62b5e69`**입니다. 이전 전달 대비 **86개 파일 변경**을 반영했습니다. 신규 거래소 연결 draft PR54는 코드에 섞지 않고 MIGRATION.md에 별도로 안내합니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치를 업데이트해도 `main` 또는 운영 사이트에 자동 병합·배포하지 않습니다.
