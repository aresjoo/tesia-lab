// 약관 페이지의 해시 경로와 목차 규칙 (원본 policies/index.html 의 route(), tocSpy()).
export const POLICY_VIEWS = ['overview', 'privacy', 'terms', 'technologies', 'faq'] as const;
export type PolicyView = (typeof POLICY_VIEWS)[number];
export type PolicyDoc = 'privacy' | 'terms' | 'technologies';

/** route(): 해시가 표에 없으면 개요 */
export function policyView(hash: string): PolicyView {
  const h = (hash || '#overview').slice(1);
  return (POLICY_VIEWS as readonly string[]).includes(h) ? (h as PolicyView) : 'overview';
}

export const POLICY_TABS: { v: PolicyView; label: string }[] = [
  { v: 'overview', label: '개요' },
  { v: 'privacy', label: '개인정보처리방침' },
  { v: 'terms', label: '서비스 약관' },
  { v: 'technologies', label: '기술' },
  { v: 'faq', label: '자주 묻는 질문' },
];

/** 문서별 목차: t 는 본문 절의 id */
export const POLICY_TOC: Record<PolicyDoc, { t: string; label: string }[]> = {
  privacy: [
    { t: 'p-intro', label: '소개' },
    { t: 'p-collect', label: 'TETH에서 수집하는 정보' },
    { t: 'p-why', label: 'TETH에서 데이터를 수집하는 이유' },
    { t: 'p-settings', label: '개인정보 보호 설정' },
    { t: 'p-share', label: '정보 공유' },
    { t: 'p-secure', label: '정보 보안 유지' },
    { t: 'p-export', label: '정보 내보내기 및 삭제' },
    { t: 'p-retain', label: '정보 유지' },
    { t: 'p-comply', label: '규정 준수' },
  ],
  terms: [
    { t: 't-intro', label: '소개' },
    { t: 't-scope', label: '본 약관에서 다루는 내용' },
    { t: 't-risk', label: '투자 위험 고지' },
    { t: 't-auto', label: '자동매매와 승인' },
    { t: 't-use', label: 'TETH 서비스 사용' },
    { t: 't-about', label: '본 약관에 대하여' },
  ],
  technologies: [
    { t: 'x-backtest', label: '백테스트 엔진' },
    { t: 'x-holdout', label: '홀드아웃 검증' },
    { t: 'x-engine', label: 'AI 리서치 엔진' },
    { t: 'x-keys', label: 'TETH의 API 키 처리 방식' },
    { t: 'x-retain', label: 'TETH에서 수집한 데이터를 보관하는 방법' },
  ],
};
export const isPolicyDoc = (v: PolicyView): v is PolicyDoc => v in POLICY_TOC;

/** 목차를 눌러 절로 갈 때 고정 머리줄 아래로 띄우는 높이(px) */
export const TOC_SCROLL_GAP = 96;
/** tocSpy() 의 기준선: 절의 위쪽이 화면 위에서 이만큼 안으로 들어오면 그 절이 지금 절이다 */
export const TOC_SPY_LINE = 150;

/** 목차를 눌렀을 때 굴릴 자리: 절의 화면 위쪽 값 + 지금 스크롤 - 띄우는 높이 (0 아래로는 안 간다) */
export const tocScrollTop = (top: number, scrollY: number) => Math.max(top + scrollY - TOC_SCROLL_GAP, 0);

/** tocSpy(): 기준선 안으로 들어온 마지막 절의 색인. 하나도 없으면 첫 절. (없는 절은 null) */
export function tocCurrent(tops: (number | null)[]): number {
  let cur = 0;
  tops.forEach((top, i) => {
    if (top !== null && top <= TOC_SPY_LINE) cur = i;
  });
  return cur;
}
