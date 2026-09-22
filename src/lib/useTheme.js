import { useEffect, useState } from 'react';

/** Live OS dark-mode preference, kept in sync while the app is open. */
function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

/** Resolves "system" | "light" | "dark" to the theme actually on screen right now. */
export function useEffectiveTheme(prefsTheme) {
  const systemDark = useSystemDark();
  if (prefsTheme === 'light' || prefsTheme === 'dark') return prefsTheme;
  return systemDark ? 'dark' : 'light';
}
