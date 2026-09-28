# 로빈후드 푸터 상단 바 실측 (robinhood.com/us/en, 헤드리스 Chrome 1440x900, 2026-09-28)

- 라임 배경 rgb(204,255,0). 바 행: 라임 상단 y=407 부터 y=493, 높이 86px, display flex, padding 0.
- 왼쪽 링크 "Customer Relationship Summaries": 16px / 400 / line-height normal, 글자 박스 21px(y 440~461), padding 0. 클릭 영역 = 글자 박스. 라임 상단 → 글자 상단 33px, 글자 하단 → 선 32px.
- "Follow us on": x=744(오른쪽 칼럼 시작선, 페이지 패딩 24px 기준), 16px / 24px / 400. 라벨 오른끝 832 → 첫 아이콘 856 (24px).
- 아이콘: X 24x24, Instagram, LinkedIn, TikTok, YouTube 20x20. 아이콘 사이 간격 20px(중심 40px). 링크 영역 = 아이콘 크기.
- 선: 오른쪽 칼럼 셀(css-fmjz49)의 border-bottom 1px solid rgb(53,50,45). 실선, 투명도 없음. 화면 전체 폭.
- 선 → "Product" 제목 글자 상단 23px (제목 16px 굵게, 박스 25px).
- 참고 이미지: rh-ref-bar.webp (사용자 제공 캡처)
