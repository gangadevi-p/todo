import { createContext, useContext, useEffect, useState } from 'react';
import { todayKey } from './dates';

export const TodayContext = createContext(todayKey());

/** Ticking source of the current local date key; used once, at the app root. */
export function useTodayClock() {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayKey() ? prev : todayKey()));
    const timer = setInterval(check, 30000);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}

export const useToday = () => useContext(TodayContext);
