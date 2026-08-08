import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 旧标签页/缓存导致动态 chunk 加载失败（404，构建后 hash 变化）时自动刷新一次恢复。
// 例如：用户一直开着旧页面，服务器重新构建后懒加载模块按旧文件名请求 404。
let chunkReloaded = false;
window.addEventListener('error', (e) => {
  if (chunkReloaded) return;
  const msg = e.message || '';
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
    chunkReloaded = true;
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
