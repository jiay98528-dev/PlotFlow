import React from 'react';
import ReactDOM from 'react-dom/client';
import { DashboardApp } from './App';
import './styles/tokens.css';
import './styles/dashboard.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
