/* 생성 파일: tools/extract-from-html.mjs 가 원본 about/index.html, download/index.html 의 PI 표에서 그대로 꺼낸다. 손으로 고치지 않는다. */
/** 값 순서는 PAGE_LANGS 와 같다 */
export type PageText = Record<string, string[]>;
export const PAGE_LANGS: string[] = [
 "ko",
 "en",
 "ja",
 "zh-CN",
 "zh-TW",
 "es",
 "fr"
];
export const ABOUT_PI: PageText = {
 "navAbout": [
  "TETH 정보",
  "About TETH",
  "TETHについて",
  "关于TETH",
  "關於TETH",
  "Acerca de TETH",
  "À propos de TETH"
 ],
 "navDl": [
  "앱 다운로드",
  "Get the app",
  "アプリを入手",
  "下载应用",
  "下載應用",
  "Descargar la app",
  "Télécharger l'app"
 ],
 "cta": [
  "시작하기",
  "Start with TETH",
  "TETHを始める",
  "开始使用TETH",
  "開始使用TETH",
  "Empieza con TETH",
  "Commencer avec TETH"
 ],
 "title": [
  "TETH 정보",
  "About TETH",
  "TETHについて",
  "关于TETH",
  "關於TETH",
  "Acerca de TETH",
  "À propos de TETH"
 ]
};
export const DOWNLOAD_PI: PageText = {
 "navAbout": [
  "TETH 정보",
  "About TETH",
  "TETHについて",
  "关于TETH",
  "關於TETH",
  "Acerca de TETH",
  "À propos de TETH"
 ],
 "navDl": [
  "TETH 앱 다운로드",
  "Get TETH app",
  "TETHアプリを入手",
  "下载TETH应用",
  "下載TETH應用",
  "Descargar la app TETH",
  "Télécharger l'app TETH"
 ],
 "login": [
  "로그인",
  "Log in",
  "ログイン",
  "登录",
  "登入",
  "Iniciar sesión",
  "Se connecter"
 ],
 "title": [
  "TETH 앱 다운로드",
  "Get the TETH app",
  "TETHアプリをダウンロード",
  "下载TETH应用",
  "下載TETH應用",
  "Descarga la app TETH",
  "Téléchargez l'app TETH"
 ],
 "linkOpen": [
  "링크로 열기",
  "Open link",
  "リンクを開く",
  "打开链接",
  "打開連結",
  "Abrir enlace",
  "Ouvrir le lien"
 ]
};
