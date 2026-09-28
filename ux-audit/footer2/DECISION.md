# 결정: rail 채택

- 리드(CRIT-lead.md) rail 8.4 / band 8.1 / codex 7.4, Codex(CRIT-codex.md) rail 61 / band 57 / codex 52. 두 심사 모두 rail.
- 이유: 로빈후드 문장 구조(왼쪽 밑줄 링크, "팔로우하세요" 바로 옆 글리프 4개, hairline, 그 아래 4칼럼)를 그대로 옮겼고, 라임 상단 28px 여백으로 다크에서 넘어온 뒤 바가 시작되는 호흡이 가장 가깝다. codex안은 라벨과 아이콘이 약 390px 떨어져 한 묶음 관계가 깨지고, band안은 라벨이 12px 캡션으로 위계가 달라진다.
- 필수 수정 반영: (1) 오른쪽 글리프 묶음 오른끝을 hairline 오른끝에 고정(-12px), (2) 390 에서 바 위 20px, hairline 아래 40px, (3) `.gft-in` 상단 패딩을 site-footer.js 공용 CSS 에 직접 통합(64→28, 모바일 48→20), 덮어쓰기 규칙 없음.
- 구현: site-footer.js 단일 출처에 바 HTML, 글리프 path, CSS 추가. 링크는 TETH_CONFIG.social, PDF 는 policies/teth-crs.pdf.
