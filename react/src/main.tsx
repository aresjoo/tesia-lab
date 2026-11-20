import { createRoot } from 'react-dom/client';
import { App } from './App';
// 원본 CSS 그대로 (tools/extract-from-html.mjs 가 만든다). 순서는 원본 문서의 순서와 같다.
import './styles/logo.css';
import './styles/app.css';
import './styles/rd.css';
import './styles/footer.css';
import './styles/help.css';
import './styles/root.css';

createRoot(document.getElementById('root')!).render(<App />);
