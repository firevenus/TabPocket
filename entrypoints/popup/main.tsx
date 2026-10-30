import React from 'react';
import ReactDOM from 'react-dom/client';
import { initI18n } from '../../src/i18n/core';
import App from './App.tsx';
import './style.css';

// 读取用户的语言设置（默认跟随浏览器），不阻塞首屏
void initI18n();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
