import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';
import { App } from './app/App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root 요소가 없다.');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
