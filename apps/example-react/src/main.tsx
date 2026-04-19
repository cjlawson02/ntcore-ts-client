import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NtcoreProvider } from '@ntcore-ts/react';
import App from './app/App';
import './styles.scss';

const NT_URI = import.meta.env.VITE_NT_URI || '127.0.0.1';
const NT_PORT = parseInt(String(import.meta.env.VITE_NT_PORT ?? '5810'), 10) || 5810;

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');
createRoot(rootEl).render(
  <StrictMode>
    <NtcoreProvider uri={NT_URI} port={NT_PORT}>
      <App />
    </NtcoreProvider>
  </StrictMode>
);
