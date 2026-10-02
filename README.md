# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **완성·배포 승인본이 아닙니다.**

현재 React 스냅샷은 `tesia-web` **`75a5f5b`**입니다. 최신 병합 main `62b5e69`와 **거래소 연결 draft PR54의 코드까지 모두 포함**합니다. 직전 전달 대비 **19개 파일 변경**을 추가했고 앞선 86개 파일 변경도 유지합니다. 거래소 연결은 기본 비활성화이며, 코드 전달과 정식 서비스 완료는 다릅니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치를 업데이트해도 `main` 또는 운영 사이트에 자동 병합·배포하지 않습니다.
