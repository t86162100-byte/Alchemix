import { Buffer } from 'buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// TON's browser SDK reads Buffer at runtime. Install it globally during app
// bootstrap, before the user can trigger the lazy TON adapter import.
const browserGlobal = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!browserGlobal.Buffer) browserGlobal.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
