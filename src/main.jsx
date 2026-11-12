import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.jsx';
// 書体は同梱する（外のサイトから読み込まない。docs/architecture.md）。
// 画面は BIZ UDPゴシック。SQL の英数字は IBM Plex Mono（下線・0 と O が見分けやすい）、SQL の中の日本語は BIZ UDゴシック
import '@fontsource/biz-udpgothic/400.css';
import '@fontsource/biz-udpgothic/700.css';
import '@fontsource/biz-udgothic/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './ui/styles/tokens.css';
import './ui/styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
