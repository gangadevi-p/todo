import { useEffect, useState } from 'react';

export const MOBILE_BREAKPOINT = 720;

/** Live "narrow enough to be a phone" check, kept in sync as the window resizes. */
export function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT}px)`;
  const [mobile, setMobile] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    // A plain resize listener is a belt-and-braces fallback: some viewport
    // emulation (devtools, embedded preview panes) resizes without firing
    // the MediaQueryList's own "change" event.
    const check = () => setMobile(mq ? mq.matches : window.innerWidth <= MOBILE_BREAKPOINT);
    mq?.addEventListener('change', check);
    window.addEventListener('resize', check);
    check();
    return () => {
      mq?.removeEventListener('change', check);
      window.removeEventListener('resize', check);
    };
  }, [query]);
  return mobile;
}
