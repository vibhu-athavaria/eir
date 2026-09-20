import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'reminder-enabled';
const TIME_KEY = 'reminder-time';
const LAST_KEY = 'reminder-last-sent';

export function getReminderEnabled() {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function getReminderTime() {
  return localStorage.getItem(TIME_KEY) || '20:00';
}

export function setReminderEnabled(enabled) {
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

export function setReminderTime(time) {
  localStorage.setItem(TIME_KEY, time);
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Fires a daily reminder notification at the user's chosen time.
 * Only triggers while the app is open. Checks every 30s.
 */
export function useDailyReminder() {
  const intervalRef = useRef(null);

  useEffect(() => {
    const check = () => {
      if (!getReminderEnabled()) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const lastSent = localStorage.getItem(LAST_KEY);

      // Already reminded today
      if (lastSent === todayStr) return;

      const [h, m] = getReminderTime().split(':').map(Number);
      const reminderTime = new Date(now);
      reminderTime.setHours(h, m, 0, 0);

      // Past the reminder time today → fire
      if (now >= reminderTime) {
        localStorage.setItem(LAST_KEY, todayStr);
        try {
          new Notification('Time to check in 🌿', {
            body: 'Log your mood and check your clean streak today.',
          });
        } catch (_) {
          // Some browsers require a service worker — silently ignore
        }
      }
    };

    // Check immediately, then every 30 seconds
    check();
    intervalRef.current = setInterval(check, 30000);

    return () => clearInterval(intervalRef.current);
  }, []);
}