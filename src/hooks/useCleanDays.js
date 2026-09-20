import { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { listDailyLogs } from '@/api/dailyLogs';
import { useAuth } from '@/lib/AuthContext';

/**
 * Shared hook for "days clean" — the count of days since the user's most recent
 * self-harm log (or since they joined, if they have none). Shares the dailyLogs
 * query cache with other callers (e.g. the Home page).
 */
export function useCleanDays() {
  const { user } = useAuth();
  const joinDate = user?.created_at ? new Date(user.created_at) : null;

  const { data: logs = [] } = useQuery({
    queryKey: ['dailyLogs'],
    queryFn: listDailyLogs,
  });

  const cleanDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selfHarmDates = logs
      .filter(l => l.self_harmed && l.date)
      .map(l => new Date(l.date + 'T00:00:00'))
      .sort((a, b) => b.getTime() - a.getTime());

    const lastSelfHarm = selfHarmDates[0] || null;
    if (lastSelfHarm) return differenceInCalendarDays(today, lastSelfHarm);

    const firstLog = logs
      .filter(l => l.date)
      .map(l => new Date(l.date + 'T00:00:00'))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return firstLog ? differenceInCalendarDays(today, firstLog) : 0;
  }, [logs]);

  const longestStreak = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = joinDate ? new Date(joinDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const points = [
      start,
      ...logs
        .filter(l => l.self_harmed && l.date)
        .map(l => new Date(l.date + 'T00:00:00'))
        .sort((a, b) => a.getTime() - b.getTime()),
      today,
    ];

    let max = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const gap = differenceInCalendarDays(points[i + 1], points[i]);
      if (gap > max) max = gap;
    }
    return max;
  }, [logs, joinDate]);

  return { cleanDays, longestStreak, logs, joinDate };
}
