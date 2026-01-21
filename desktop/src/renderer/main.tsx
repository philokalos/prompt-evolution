import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Initialize i18n before rendering
import '../locales';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
