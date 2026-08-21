// ===========================================================================
//  GoogleButton.jsx — "Continue with Google", using Google Identity Services.
//
//  GIS renders its own button into a slot we provide, which is what makes it
//  look and behave exactly like the one on the learner site (including the
//  "Continue as <name>" personalised state when the browser already knows the
//  user). The credential it hands back is a JWT, verified server-side in
//  auth.php — nothing is trusted from this file.
//
//  With VITE_GOOGLE_CLIENT_ID unset (local work, or before the client id is
//  provisioned) the component degrades to a disabled button with an honest
//  explanation rather than silently doing nothing.
// ===========================================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SRC = 'https://accounts.google.com/gsi/client';

/* One shared loader promise: two buttons on one page must not race in two
   copies of the script. */
let scriptPromise = null;
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google script loaded but empty')));
    el.onerror = () => reject(new Error('Google sign-in could not be loaded'));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export default function GoogleButton({ onError, text = 'continue_with' }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const slot = useRef(null);
  const [status, setStatus] = useState(CLIENT_ID ? 'loading' : 'unconfigured');

  useEffect(() => {
    if (!CLIENT_ID) return;
    let alive = true;

    loadGis()
      .then((google) => {
        if (!alive || !slot.current) return;

        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (response) => {
            try {
              await loginWithGoogle(response.credential);
              navigate('/', { replace: true });
            } catch (e) {
              onError?.(e.message);
            }
          },
          /* FedCM is the direction browsers are heading; the classic flow
             remains the fallback inside GIS itself. */
          use_fedcm_for_prompt: true,
          auto_select: false,
        });

        google.accounts.id.renderButton(slot.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'left',
          width: slot.current.offsetWidth || 380,
        });

        setStatus('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setStatus('error');
        onError?.(e.message);
      });

    return () => { alive = false; };
  }, [loginWithGoogle, navigate, onError, text]);

  if (status === 'unconfigured') {
    return (
      <div className="auth-google">
        <button type="button" className="auth-google-fallback" disabled title="Google sign-in is not configured yet">
          <GoogleMark /> Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div className="auth-google">
      <div ref={slot} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
      {status === 'loading' && (
        <div className="skeleton" style={{ width: '100%', height: 44, position: 'absolute' }} aria-hidden="true" />
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.6h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36.2 45 30.7 45 24Z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 41.2 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.5 28.4A13.3 13.3 0 0 1 10.8 24c0-1.5.3-3 .7-4.4l-7.1-5.5A22 22 0 0 0 2 24c0 3.5.8 6.9 2.3 9.9l7.2-5.5Z" />
      <path fill="#EA4335" d="M24 10.6c3.3 0 6.1 1.1 8.4 3.3l6.2-6.2C34.9 4.1 29.9 2 24 2 15.4 2 8 6.8 4.4 14.1l7.1 5.5C13.3 14.4 18.2 10.6 24 10.6Z" />
    </svg>
  );
}
