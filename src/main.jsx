import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth.jsx'
import { HelmetProvider } from "react-helmet-async";
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{
          duration: 3500,
          style: { borderRadius: '8px', fontFamily: 'Inter, sans-serif', fontSize: '13px' },
          success: { style: { background: '#22c55e', color: '#fff' } },
          error: { style: { background: '#ef4444', color: '#fff' } },
        }} />
        <HelmetProvider>
        <App />
        </HelmetProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
