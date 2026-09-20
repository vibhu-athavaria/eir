import React, { useState, useMemo, useEffect } from 'react';
import { format, addMonths, subMonths, differenceInCalendarDays } from 'date-fns';
import { listDailyLogs, upsertDailyLog } from '@/api/dailyLogs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import CleanCounter from '@/components/calendar/CleanCounter';
import DailyLogModal from '@/components/calendar/DailyLogModal';
import usePullToRefresh from '@/hooks/usePullToRefresh';
import { toast } from '@/components/ui/use-toast';

export default function Home() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dailyLogs'] });
  };
  const { containerRef, pullDistance, refreshing, threshold } = usePullToRefresh(handleRefresh);

  const { data: logs = [], isError: isLogsError } = useQuery({
    queryKey: ['dailyLogs'],
    queryFn: listDailyLogs,
  });

  useEffect(() => {
    if (isLogsError) {
      console.error('Failed to load daily logs');
      toast({
        title: "Couldn't load your logs",
        description: 'Check your connection and try refreshing.',
        variant: 'destructive',
      });
    }
  }, [isLogsError]);

  const cleanDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the most recent self-harm date
    const selfHarmDates = logs
      .filter(l => l.self_harmed && l.date)
      .map(l => new Date(l.date + 'T00:00:00'))
      .sort((a, b) => b.getTime() - a.getTime());

    const lastSelfHarm = selfHarmDates[0] || null;

    if (lastSelfHarm) {
      return differenceInCalendarDays(today, lastSelfHarm);
    }

    // No self-harm logged: count from the user's first log (their own recovery start).
    // Nothing logged yet → fresh start, 0 clean days.
    const firstLog = logs
      .filter(l => l.date)
      .map(l => new Date(l.date + 'T00:00:00'))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return firstLog ? differenceInCalendarDays(today, firstLog) : 0;
  }, [logs]);

  // Single upsert covers both create and update — the database's (user_id, date)
  // unique constraint decides which one happens, atomically, so we no longer need
  // to guess by searching the (possibly stale) query cache.
  const upsertMutation = useMutation({
    mutationFn: (/** @type {any} */ data) => upsertDailyLog(data),
    onMutate: async (newLog) => {
      await queryClient.cancelQueries({ queryKey: ['dailyLogs'] });
      const previous = queryClient.getQueryData(['dailyLogs']);
      queryClient.setQueryData(['dailyLogs'], (/** @type {any[]} */ old = []) => {
        const exists = old.some(l => l.date === newLog.date);
        if (exists) {
          return old.map(l => l.date === newLog.date ? { ...l, ...newLog } : l);
        }
        return [...old, { id: `temp-${Date.now()}`, ...newLog }];
      });
      return { previous };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['dailyLogs'], ctx.previous);
      toast({
        title: "Couldn't save your entry",
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['dailyLogs'] }),
  });

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedDate(null);
  };

  const handleSave = (data) => {
    upsertMutation.mutate(data);
  };

  const existingLog = selectedDate
    ? logs.find(l => l.date === format(selectedDate, 'yyyy-MM-dd'))
    : null;

  return (
    <div ref={containerRef} className="min-h-screen bg-background pb-24 overflow-y-auto">
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-primary"
          style={{ height: pullDistance, transition: refreshing ? 'height 0.2s' : 'none' }}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing || pullDistance >= threshold ? 'animate-spin' : ''}`} />
        </div>
      )}
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Clean Counter */}
        <CleanCounter days={cleanDays} />

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4 px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-bold text-foreground">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-4 shadow-sm border border-border/50"
        >
          <CalendarGrid
            currentMonth={currentMonth}
            logs={logs}
            onSelectDate={handleSelectDate}
            selectedDate={selectedDate}
          />
        </motion.div>

        {/* Quick Add for Today */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <Button
            onClick={() => handleSelectDate(new Date())}
            className="w-full h-12 rounded-2xl font-semibold text-base gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-5 h-5" />
            Log Today
          </Button>
        </motion.div>
      </div>

      <DailyLogModal
        open={modalOpen}
        onClose={handleCloseModal}
        date={selectedDate}
        existingLog={existingLog}
        onSave={handleSave}
      />
    </div>
  );
}