// 독립 페이지의 언어 규칙 (원본 about/index.html, download/index.html 의 PIDX 와 data-i 바꿔 넣기).
import { PAGE_LANGS, type PageText } from './pi.data';

/** PIDX: 저장된 tethLang 이 표에 없으면 한국어(0) */
export function pageLangIndex(saved: string | null): number {
  const i = PAGE_LANGS.indexOf(saved || 'ko');
  return i < 0 ? 0 : i;
}

/**
 * data-i 문구. 한국어(0)는 문서에 적힌 글 그대로 두고, 다른 언어만 표의 값으로 바꾼다(그 언어 값이 없으면 영어).
 * 원본도 PIDX>0 일 때만 바꿔 넣어서, 한국어 화면의 글과 표의 한국어 값이 다른 곳이 있다(다운로드의 '시작하기' 와 '로그인').
 */
export function pageText(pi: PageText, idx: number, key: string, ko: string): string {
  if (idx <= 0) return ko;
  const v = pi[key];
  return v ? v[idx] || v[1] : ko;
}
