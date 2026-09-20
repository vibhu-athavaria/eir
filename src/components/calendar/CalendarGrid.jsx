import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, isFuture, startOfDay } from 'date-fns';
import { motion } from 'framer-motion';

export default function CalendarGrid({ currentMonth, logs, onSelectDate, selectedDate }) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const getLogForDay = (d) => {
    if (!logs || logs.length === 0) return null;
    const dateStr = format(d, 'yyyy-MM-dd');
    return logs.find(l => l.date === dateStr) || null;
  };

  const hasLogContent = (log) => {
    if (!log) return false;
    return log.self_harmed || log.mood || (log.moods && log.moods.length > 0) || (log.journal && log.journal.trim()) || (log.alternatives_used && log.alternatives_used.length > 0);
  };

  return (
    <div className="px-1">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((d, i) => (
          <div key={i} className="text-center text-xs font-semibold text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const log = getLogForDay(d);
          const inMonth = isSameMonth(d, currentMonth);
          const today = isToday(d);
          const future = isFuture(startOfDay(d)) && !today;
          const selected = selectedDate && isSameDay(d, selectedDate);
          const logged = hasLogContent(log);
          const dayBg = !future && logged
            ? (log.self_harmed ? 'bg-destructive/25' : 'bg-primary/25')
            : (!future ? 'hover:bg-secondary/40' : '');

          return (
            <motion.button
              key={i}
              whileTap={future ? {} : { scale: 0.9 }}
              onClick={() => !future && onSelectDate(d)}
              disabled={future}
              className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-all ${
                !inMonth ? 'opacity-20' : ''
              } ${future ? 'opacity-25 cursor-not-allowed' : ''} ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''} ${
                today ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
              } ${dayBg}`}
            >
              <span className={`font-bold ${log?.self_harmed ? 'text-destructive' : (logged || today ? 'text-primary' : '')}`}>
                {format(d, 'd')}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}