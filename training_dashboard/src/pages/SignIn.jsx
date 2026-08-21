// ===========================================================================
//  SignIn.jsx — the portal's front door.
//
//  Same structure as the learner site: centred logo, heading, the cross-link to
//  sign-up, two fields, the CTA that only fills in once the form is usable,
//  "forgot password", an `or` divider, Google, and the "continue without
//  signing in" escape hatch.
//
//  Three kinds of learner arrive here (see public/api/auth.php):
//    • dashboard users, with their dashboard email + password
//    • Google accounts whose email is already on file
//    • ₹99-store buyers who never registered, using the shared store password
//  One form covers all three — the server decides which path applies, so the
//  learner is never asked to know which kind of account they have.
// ===========================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from '../components/icons';
import GoogleButton from '../components/GoogleButton';
import './auth.css';

export default function SignIn() {
  const { login, notice, setNotice } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  /* The CTA stays flat until both fields hold something plausible — the same
     "not yet" cue the learner site gives, and it stops most empty submits. */
  const ready = useMemo(
    () => /\S+@\S+\.\S+/.test(email.trim()) && password.length > 0,
    [email, password]
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card fade-up">
        <div className="auth-logo"><span>i</span>Studio</div>

        <h1 className="auth-title">Sign In To Your Account</h1>
        <p className="auth-switch">
          Don't have an account? <Link to="/signup">SIGN UP</Link>
        </p>

        {notice && <div className="auth-note">{notice}</div>}
        {error && <div className="auth-error" role="alert">{error}</div>}

        <form onSubmit={submit} noValidate>
          <div className="auth-field">
            <input
              ref={emailRef}
              className="field"
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
            />
          </div>

          <div className="auth-field field-wrap">
            <input
              className="field"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
            />
            <button
              type="button"
              className="field-btn"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>

          <button type="submit" className={`btn-auth${ready ? ' ready' : ''}`} disabled={!ready || busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <Link to="/forgot-password" className="auth-forgot">FORGOT PASSWORD?</Link>

        <div className="auth-or"><span>or</span></div>

        <GoogleButton onError={setError} />

        <p className="auth-explore">
          Continue without signin? <Link to="/explore">EXPLORE</Link>
        </p>
      </div>
    </div>
  );
}
