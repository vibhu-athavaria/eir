import React from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { listDailyLogs } from '@/api/dailyLogs';
import { BookOpen, CalendarDays } from 'lucide-react';

export default function JournalHistory() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['dailyLogs'],
    queryFn: listDailyLogs,
  });

  const entries = logs
    .filter(l => l.journal && l.journal.trim().length > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 mb-6"
        >
          <BookOpen className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Journal History</h1>
            <p className="text-xs text-muted-foreground">Read-only — edit entries from the calendar</p>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No journal entries yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Your logged reflections will appear here.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span className="font-medium">
                    {format(parseISO(entry.date), 'EEEE, d MMM yyyy')}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {entry.journal}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}