// 화면 없는 순수 로직. Flutter 로 옮길 때 Dart 로 1:1 옮기는 층이다.
import { GLC_CURS, GLC_LANGS, I18N } from './i18n.data';

export type Lang = string;

export function isLang(c: string | null): c is Lang {
  return !!c && GLC_LANGS.some((l) => l.c === c);
}
export function isCur(c: string | null): c is string {
  return !!c && GLC_CURS.some((x) => x.c === c);
}

/** 원본 L(k): 지금 언어 > 영어 > 한국어 > 키 그대로 */
export function translate(lang: Lang, k: string): string {
  const e = I18N[k];
  return e ? e[lang] || e.en || e.ko : k;
}

export function curInfo(cur: string) {
  return GLC_CURS.find((c) => c.c === cur) || GLC_CURS[0];
}
/** 데모 수치(USD 기준)를 표시 통화 숫자로 (기호 없음) */
export function fmtMoneyNum(cur: string, usd: number): string {
  const ci = curInfo(cur);
  const v = usd * ci.r;
  if (ci.c === 'BTC') return v.toFixed(6);
  if (ci.r >= 100 || Math.abs(v) >= 100) return Math.round(v).toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
export function fmtMoney(cur: string, usd: number): string {
  const ci = curInfo(cur);
  return (ci.s || ci.c + ' ') + fmtMoneyNum(cur, usd);
}
