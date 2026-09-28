# rail

- 콘셉트: 로빈후드 그대로. 상단 바를 라임 푸터 안 최상단(`.gft-in` 첫 자식)에 두고, 1px hairline(rgba(12,13,15,.35))을 콘텐츠 폭 전체에 긋는다. 나머지 푸터는 site-footer.js 출력 그대로.
- 바 배치(1440 실측): `.gft-in` 상단 패딩 64→28로 줄여 바 높이 61px, hairline 아래 4칼럼까지 48px. 왼쪽 밑줄 링크 "고객 관계 요약"(teth-crs.pdf, _blank), 오른쪽 "팔로우하세요" + 글리프 4개(svg 20px, 터치 영역 44x44, `TETH_CONFIG.social` 링크, aria-label). 마지막 글리프는 -12px 보정으로 hairline 오른끝에 시각 정렬.
- 글리프 확인(3배 확대 캡처로 봄): X는 X 로고, Instagram은 둥근 사각 카메라+렌즈+점, YouTube는 둥근 사각 안 재생 삼각형, Telegram은 원 안 종이비행기. 4개 모두 실제 로고로 읽히고 이상한 글리프 없음. hairline은 1440, 390 둘 다 선명히 보임.
- 390 대응: 컨테이너 쿼리 600px 이하에서 세로 쌓임(링크 위 44px 줄, 팔로우 줄 아래 44px 줄), hairline 아래 36px. scrollWidth 390 = clientWidth, 잘림 없음. 글리프 간격 44px 그대로.
- 위험 1개: 바를 최상단에 두려고 목업 CSS가 `.gft-in{padding-top}`을 덮어쓴다. 실제 반영 시 site-footer.js 의 CSS 상수(64px, 모바일 48px)를 같이 수정해야 하며, 그러지 않으면 바 위 여백이 두 배로 벌어진다.
