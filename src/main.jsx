import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';
import App from './App';
import { data, loadData, ui } from './store';

if (import.meta.env.DEV) window.__nudge = { data, ui };

loadData().then(() => {
  createRoot(document.getElementById('root')).render(<App />);
});
