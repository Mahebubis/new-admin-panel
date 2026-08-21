// ===========================================================================
//  SignUp.jsx — "Create Your Account".
//
//  Mirrors the learner site's sign-up, including the live password-strength
//  meter under the password field.
//
//  One honest difference, surfaced in the UI rather than hidden: this portal
//  does not open new accounts on its own. Access comes from a purchase — the
//  dashboard, or the ₹99 store — so the form's job is to get an existing buyer
//  to the right door instead of creating a second, empty account they would
//  then have to have merged. Submitting attempts a sign-in with what they
//  typed, which is what a returning buyer actually wants.
// ===========================================================================
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Help } from '../components/icons';
import GoogleButton from '../components/GoogleButton';
import './auth.css';

/** Cheap, legible strength check — length first, then variety. */
function strengthOf(pw) {
  if (!pw) return { level: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 2) return { level: 1, label: 'Password strength is weak.', tone: 'weak' };
  if (score <= 4) return { level: 2, label: 'Password strength is moderate.', tone: 'medium' };
  return { level: 3, label: 'Password strength is strong.', tone: 'strong' };
}

export default function SignUp() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const strength = useMemo(() => strengthOf(password), [password]);
  const ready = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 6;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      /* If they already have access, this is simply their login. */
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

        <h1 className="auth-title">Create Your Account</h1>
        <p className="auth-switch">
          Already have an account? <Link to="/signin">SIGN IN</Link>
        </p>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form onSubmit={submit} noValidate>
          <div className="auth-field">
            <input
              className="field"
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
            />
          </div>

          <div className="auth-field field-wrap" style={{ marginBottom: 8 }}>
            <input
              className="field"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
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

          {password && (
            <>
              <p className="auth-hint"><Help size={15} /> {strength.label}</p>
              <div className="auth-strength" aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <i key={i} className={i <= strength.level ? `on-${strength.tone}` : ''} />
                ))}
              </div>
            </>
          )}

          <button
            type="submit"
            className={`btn-auth${ready ? ' ready' : ''}`}
            disabled={!ready || busy}
            style={{ marginTop: 18 }}
          >
            {busy ? 'Please wait…' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-hint" style={{ justifyContent: 'center', marginTop: 16, textAlign: 'center' }}>
          Access to the portal comes with your purchase — buy a course and sign in with that email.
        </p>

        <div className="auth-or"><span>or</span></div>

        <GoogleButton onError={setError} text="signup_with" />

        <p className="auth-explore">
          Continue without signup? <Link to="/explore">EXPLORE</Link>
        </p>
      </div>
    </div>
  );
}
