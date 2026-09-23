import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { publicWeb } from './lib/auth';
import { data, loadData, ui } from './store';

if (import.meta.env.DEV) window.__nudge = { data, ui };

function Root() {
  const [ready, setReady] = useState(false);
  const enter = async (space) => {
    if (publicWeb && space === 'demo') history.replaceState(null, '', location.pathname + location.search);
    await loadData(space);
    setReady(true);
  };
  if (ready) return <App />;
  return <AuthGate onEnter={enter} />;
}

const root = createRoot(document.getElementById('root'));
if (publicWeb && location.hash !== '#owner') {
  // Public website: everyone lands on the sample data. #owner opens the sign-in screen.
  loadData('demo').then(() => root.render(<App />));
} else {
  root.render(<Root />);
}
