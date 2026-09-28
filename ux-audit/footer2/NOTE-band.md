# band 시안 노트
- 콘셉트: 라임 푸터 최상단 가장자리에 붙은 슬림 풀폭 밴드. `.gft-in` 상단 패딩을 0으로 두고 밴드(높이 64px, 상하 9px 여유)를 얹으며, 밴드의 아래 가장자리 자체가 1px hairline(rgba(12,13,15,.35), x40~1400 콘텐츠 폭 전체)이고 그 아래 48px 뒤에 4칼럼이 시작한다.
- 바 배치: 왼쪽 "고객 관계 요약" 밑줄 링크 1개(policies/teth-crs.pdf, _blank), 오른쪽 "팔로우하세요"(12px, 600, 자간 .06em) + X, Instagram, YouTube, Telegram 순. 글리프 20px, 각 링크는 44x44 원형 히트 영역(평소 비가시, hover 시 8% 다크 원). 링크는 TETH_CONFIG.social, 경로는 icons.js TETH_SNS_ICONS.
- 글리프 확인(bar.png, 3배 확대본): X는 교차 X 로고, Instagram은 둥근 사각 카메라(렌즈+점), YouTube는 둥근 사각 안 재생 삼각형, Telegram은 원 안 종이비행기로 전부 실제 로고와 동일하게 읽힘. 이상 글리프 없음.
- 1440 확인: 밴드 y=348(푸터 상단과 일치), 높이 64, 4칼럼 시작 y=460, hairline 선명하게 보임. 다크 콘텐츠 300px 위에 라임 푸터 전체가 full page 에 담김.
- 390 확인: 링크(y 358)가 위, 팔로우 줄(y 401)이 아래로 쌓이고 둘 다 x=20 좌측 정렬. 팔로우 줄 폭 277px(우측 끝 297)로 잘림 없음, 문서 scrollWidth 390.
- 위험 1개: 밴드가 라임 최상단에 딱 붙어 다크 콘텐츠와 hairline 사이 여백이 얇게 느껴질 수 있고, 목업 CSS 가 `.gft .gft-in{padding-top:0}` 로 site-footer.js 의 기본 패딩(64px)을 덮어쓰므로 실제 반영 시 site-footer.js 쪽 패딩 규칙을 함께 손봐야 한다.
