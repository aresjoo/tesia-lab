# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **전체 서비스 완성·실거래 운영 승인본은 아닙니다.**

현재 React 스냅샷은 **이전 UI 복구에 다국어 푸터·헤더 스크롤·원본 거래소 아이콘/필터를 보완한 수정본**입니다. 정확한 출처 커밋은 manifest의 `sourceCommit`을 따릅니다. 병합 main `62b5e69`와 **거래소 연결 draft PR54 코드**, 모바일 시장 필터·문서 복귀·카탈로그 전체 근거·차트 마커와 성능 개선을 보존합니다. Google·Apple·이메일 선택지를 유지하며 이번 수정은 인증 로직을 바꾸지 않습니다. 거래소 연결은 기본 비활성화입니다. 코드 전달과 실제 서비스 완료는 다릅니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치 push는 `main` 병합이나 자동 배포를 실행하지 않습니다. 사용자가 별도로 요청한 `teth.ai` 정적 프론트 업데이트는 [검증 기록](migration-verification.json)의 배포 상태로 구분합니다. 루트 원본·server/Worker 및 투자 프롬프트 draft `8646b65`는 이번에 병합·배포하지 않습니다. Apple·이메일 선택지는 유지하되 현재 서버에서 미연결인 방식은 ‘준비 중’으로 표시합니다.

직전 `fa8601e`의 teth.ai 반영과 인증 시작 검증은 이전 전달 이력입니다. 이번 수정본의 단일 영향 검사·빌드·보안·배포 상태는 [검증 기록](migration-verification.json)을 따릅니다. 이전 navigation 전수의 실패1건은 후속 실제 반례로 수정했으며 원실패 기록은 보존합니다. 실제 사용자 Google callback/ACK 완료, Apple·이메일 연결, 프롬프트·거래소·주문 활성화는 완료로 표시하지 않습니다.

이전 `a6e737f` 정적 프론트는 teth.ai에 반영한 상태입니다. 새 수정본의 정확한 배포 여부는 [검증 기록](migration-verification.json)의 `deployment.status`를 확인하세요. 최초 영향664개 중 CDP Promise 수거 실패1건과 각 원본 누락 반례는 보존하고, 교정 뒤의 단일 영향 검사와 lint·3종 빌드·비밀정보 검사 결과를 별도로 결속합니다. 서버·키·DB를 교체하지 않으며 별도 프롬프트 draft와 Git 충돌 검사는 실제 프롬프트 연결 성공과 구분합니다.
