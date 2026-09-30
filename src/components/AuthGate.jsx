import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { createAuth, getAuth, verifyAuth } from '../lib/auth';

/**
 * Login screen shown before the personal space opens: user name and password only.
 */
export function AuthGate({ onEnter }) {
  const [auth, setAuth] = useState(undefined); // undefined = loading, null = not set up yet
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [resetting, setResetting] = useState(false); // forgot password: replace the saved login, tasks stay

  useEffect(() => { getAuth().then((a) => setAuth(a || null)); }, []);
  if (auth === undefined) return <div className="auth-screen" />;

  const setup = auth === null || resetting;

  const toggleReset = () => { setResetting((r) => !r); setError(''); setPassword(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) { setError('Enter a user name and password.'); return; }
    if (setup) {
      if (password.length < 6) { setError('Use at least 6 characters.'); return; }
    }
    setBusy(true);
    try {
      if (setup) {
        if (!(await createAuth(username, password))) { setError('Couldn’t save your sign-in. Try again.'); return; }
        onEnter('owner');
      } else if (await verifyAuth(auth, username, password)) {
        onEnter('owner');
      } else {
        setError('Wrong user name or password.');
        setPassword('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-head">
          <h1 className="auth-title">{resetting ? 'New login' : setup ? 'Create login' : 'Login'}</h1>
          <button type="button" className="btn btn-primary" onClick={() => onEnter('demo')}>Back to demo</button>
        </div>
        <label className="auth-field">
          <span>User name</span>
          <input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <div className="auth-password">
            <input type={reveal ? 'text' : 'password'} autoComplete={setup ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="auth-reveal" aria-label={reveal ? 'Hide password' : 'Show password'} aria-pressed={reveal} onClick={() => setReveal((r) => !r)}>
              {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {resetting && <p className="auth-note">Choose a new user name and password. Your tasks stay as they are.</p>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>{setup ? 'Create login' : 'Login'}</button>
        {auth !== null && (
          <button type="button" className="auth-link" onClick={toggleReset}>{resetting ? 'Back to login' : 'Forgot password?'}</button>
        )}
      </form>
    </div>
  );
}
