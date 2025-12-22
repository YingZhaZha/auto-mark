
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      // 使用基于当前 window.location 的绝对路径来注册 sw.js
      // 避免在某些预览环境（如 AI Studio）中，相对路径被解析到错误的源
      let swUrl = './sw.js';
      try {
        swUrl = new URL('sw.js', window.location.href).href;
      } catch (e) {
        console.warn('Failed to construct absolute SW URL, falling back to relative:', e);
      }

      navigator.serviceWorker.register(swUrl)
        .then((registration) => {
          console.log('SW registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('SW registration failed:', error);
        });
    } catch (e) {
      console.warn('Unexpected error during SW registration:', e);
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
