import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getSavedColor } from './components/ColorPicker';
import './styles/global.css';

// 初始化主题色
const saved = getSavedColor();
const r = parseInt(saved.slice(1, 3), 16);
const g = parseInt(saved.slice(3, 5), 16);
const b = parseInt(saved.slice(5, 7), 16);
const darken = (amt: number) => `rgb(${Math.max(0, r - amt)},${Math.max(0, g - amt)},${Math.max(0, b - amt)})`;
const lighten = (amt: number) => `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`;
document.documentElement.style.setProperty('--primary', saved);
document.documentElement.style.setProperty('--primary-dark', darken(40));
document.documentElement.style.setProperty('--primary-light', lighten(90));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
