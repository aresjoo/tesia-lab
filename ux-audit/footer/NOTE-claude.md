# NOTE claude: 레퍼런스 충실형
- 콘셉트: Robinhood 구조를 그대로 옮기고 TETH 톤만 입힘. 위 왼쪽 절반 링크 4칼럼(제목 13px bold, 링크 14px, 간격 10px), 오른쪽 절반 문단(13.5px, 행간 1.7, 첫 문단과 파트너 줄만 진하게), 120px 비우고 워드마크 영역.
- 워드마크: 굵은 기하 산세리프 시스템 스택(SF Pro Display, Helvetica Neue, Segoe UI Black, Arial Black) 900, 자간 -0.04em. 세리프 헤드라인과 대비되는 무게로 페이지의 마침표 역할. 외부 폰트 없음.
- fit: 인라인 SVG의 viewBox를 콘텐츠 폭 x 대문자 높이(1 유닛 = 1px)로 두고, canvas measureText의 실제 잉크 박스로 font-size를 역산해 T 왼쪽 잉크와 H 오른쪽 잉크가 콘텐츠 좌우 끝에 닿게 함. 베이스라인이 SVG 바닥, 아래 여백 22px(모바일 14px). ResizeObserver로 스크롤바 등장까지 재맞춤. 캡처 픽셀 실측 1440: 잉크 104~1398 / 콘텐츠 104~1400, 390: 21~368 / 20~370.
- Powered by 줄: 워드마크 바로 위 18px, 왼쪽 정렬 15px, "Powered by"는 한 단계 흐리게, Bitget 아이콘 22px 둥근 사각(모서리 6px, 원본 글로우 테두리는 1.14배 확대로 잘라냄) + 굵은 "Bitget".
- 추천: lime. 다크 본문이 끝나는 지점이 한 번에 드러나 "여기가 끝"이라는 신호가 확실하고, 라임 위 검정 TETH가 CTA 버튼과 같은 브랜드색 기억을 남김. 다크는 워드마크가 상단 문단을 압도해 무거움.
- 390: 사이드바 숨김, 링크 2열 그리드(행 간격 36px), 문단은 아래로(keep-all 줄바꿈), 120px 간격은 72px로 줄이고 TETH는 350px 폭에 그대로 fit.
- 위험: 워드마크 서체가 OS마다 달라짐(Windows는 Segoe UI Black, Mac은 SF Pro Display Heavy). fit은 실측이라 폭은 항상 맞지만 글자 인상과 높이는 기기마다 다름.
