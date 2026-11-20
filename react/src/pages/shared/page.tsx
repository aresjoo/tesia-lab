// 독립 페이지 셋이 같이 쓰는 것: 언어 읽기, 다크 테마 고정, 상담 안내 줄.
import { useEffect } from 'react';
import { PAGES } from '../../core/config';
import { pageLangIndex, pageText } from '../../core/pages/lang';
import { PAGE_LANGS, type PageText } from '../../core/pages/pi.data';
import { getState, useApp } from '../../state/store';

/**
 * 원본 페이지 스크립트의 i18n 앞부분: 저장된 tethLang 으로 <html lang> 과 제목을 정한다.
 * 첫 그림 전에 해야 한다(한자 글꼴이 lang 에 따라 달리 골라진다). 그래서 진입 파일이 그리기 전에 부른다.
 */
export function applyPageLang(pi: PageText) {
  const idx = pageLangIndex(getState().lang);
  document.documentElement.lang = PAGE_LANGS[idx];
  if (idx > 0 && pi.title) document.title = pi.title[idx];
}

/** data-i 문구 고르기. 다른 탭에서 언어를 바꾸면(storage) 문서를 다시 읽는다. */
export function usePageLang(pi: PageText) {
  const idx = pageLangIndex(useApp((s) => s.lang));
  useEffect(() => {
    const h = (ev: StorageEvent) => {
      if (ev.key === 'tethLang') window.location.reload();
    };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);
  return { idx, t: (key: string, ko: string) => pageText(pi, idx, key, ko) };
}

/** 원본 theme.js: 서비스는 다크 한 가지다 */
export function applyDarkTheme() {
  document.body.classList.remove('light');
  try {
    localStorage.setItem('tethTheme', 'dark');
  } catch {
    /* 저장 못 해도 화면은 그대로다 */
  }
}

/** 본문 아래 상담 안내 (앱 다운로드, 약관) */
export function SubHelp() {
  return (
    <p className="sub-help">
      막히면 상담원이 24시간 답합니다.<a href={PAGES.app}>상담원에게 묻기</a>
    </p>
  );
}
