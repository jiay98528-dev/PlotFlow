import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../styles/tokens-light.css';
import '../styles/tokens-dark.css';
import '../styles/global.css';
import '../styles/app-shell.css';
import '../styles/new-file-dialog.css';
import '../styles/diagnostics.css';
import '../styles/branch-graph.css';
import '../styles/graph-lab.css';
import '../styles/official-themes.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
