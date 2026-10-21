import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource-variable/manrope';
import './styles/global.css';
import './styles/shell.css';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
