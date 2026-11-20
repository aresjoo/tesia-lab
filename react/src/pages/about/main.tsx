import { createRoot } from 'react-dom/client';
import { ABOUT_PI } from '../../core/pages/pi.data';
import { applyPageLang } from '../shared/page';
import { About } from './About';
// 원본 about/index.html 의 CSS 그대로 (tools/extract-from-html.mjs 가 만든다). 순서는 원본 문서의 순서와 같다:
// 문서의 <style> 둘, site-footer.js 가 넣는 푸터 CSS, help-widget.js 가 넣는 고객지원 버튼 CSS.
import './page.css';
import './sk-sub.css';
// 뒤의 ?about 는 이 진입만의 사본으로 묶이게 한다. 없으면 빌드가 푸터와 버튼 CSS 를 진입들이 같이 쓰는 묶음으로 빼서 문서 CSS 보다 먼저 싣고,
// 앱(index.html)의 CSS 순서까지 바뀐다.
import '../../styles/footer.css?about';
import '../../styles/help.css?about';

applyPageLang(ABOUT_PI);
createRoot(document.getElementById('root')!).render(<About />);
