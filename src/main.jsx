import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { getAuth, hasSession, openSpace, publicWeb, rememberSession, setOpenSpace } from './lib/auth';
import { data, loadData, ui } from './store';

if (import.meta.env.DEV) window.__nudge = { data, ui };

// `npm run dev` in a browser: no sign-in, straight to the personal space.
const devBrowser = import.meta.env.DEV && !window.nudge;

function Root() {
  const [ready, setReady] = useState(false);
  // A refresh stays in the demo if that's where this tab was; otherwise a
  // remembered login goes straight to the personal space.
  const [resuming, setResuming] = useState(() => devBrowser || openSpace() === 'demo' || hasSession());
  const enter = async (space, { remember = false } = {}) => {
    if (publicWeb && space === 'demo') history.replaceState(null, '', location.pathname + location.search);
    if (space === 'owner' && remember) rememberSession();
    setOpenSpace(space);
    await loadData(space);
    setReady(true);
  };
  useEffect(() => {
    if (!resuming) return;
    if (openSpace() === 'demo') { enter('demo'); return; }
    if (devBrowser) { enter('owner'); return; }
    // Only skip the screen while a login still exists to skip.
    getAuth().then((auth) => (auth ? enter('owner', { remember: true }) : setResuming(false)));
  }, []);
  if (ready) return <App />;
  if (resuming) return <div className="auth-screen" />;
  return <AuthGate onEnter={enter} />;
}

const root = createRoot(document.getElementById('root'));
if (publicWeb && location.hash !== '#owner') {
  // Public website: everyone lands on the sample data. #owner opens the sign-in screen.
  loadData('demo').then(() => root.render(<App />));
} else {
  root.render(<Root />);
}
