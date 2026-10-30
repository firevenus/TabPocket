import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n } from '../../src/i18n/core';
import StatsApp from './StatsApp';
import './style.css';

// 读取用户的语言设置（默认跟随浏览器），不阻塞首屏
void initI18n();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StatsApp />
  </StrictMode>,
);
