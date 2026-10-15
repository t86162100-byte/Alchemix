import { Buffer } from 'buffer';
import processPolyfill from 'process';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Some browser bundles in Stellar's SDK dependency tree expect Node globals.
// Install these polyfills before any lazily-loaded chain adapter executes.
const browserGlobal = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  process?: typeof processPolyfill;
};
if (!browserGlobal.Buffer) browserGlobal.Buffer = Buffer;
if (!browserGlobal.process) browserGlobal.process = processPolyfill;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
