import { createRoot } from 'react-dom/client';
import { DOWNLOAD_PI } from '../../core/pages/pi.data';
import { applyDarkTheme, applyPageLang } from '../shared/page';
import { Download } from './Download';
// 원본 download/index.html 의 CSS 그대로 (tools/extract-from-html.mjs 가 만든다). 순서는 원본과 같다: 문서, 푸터, 고객지원 버튼.
import './page.css';
// 뒤의 ?download 는 이 진입만의 사본으로 묶이게 한다. 없으면 빌드가 푸터와 버튼 CSS 를 진입들이 같이 쓰는 묶음으로 빼서 문서 CSS 보다 먼저 싣고,
// 앱(index.html)의 CSS 순서까지 바뀐다.
import '../../styles/footer.css?download';
import '../../styles/help.css?download';

applyDarkTheme();
applyPageLang(DOWNLOAD_PI);
createRoot(document.getElementById('root')!).render(<Download />);
