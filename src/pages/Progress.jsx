import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Cell,
} from 'recharts';
import { TrendingUp, Award, Calendar, Heart, Lock, Check } from 'lucide-react';
import { useCleanDays } from '@/hooks/useCleanDays';

const MOOD_LABELS = {
  1: 'Hopeless', 2: 'Numb', 3: 'Dissociated', 21: 'Unsure', 4: 'Anxious',
  5: 'Sad', 6: 'Angry', 7: 'Scared', 8: 'Overwhelmed', 9: 'Restless',
  22: 'Tired', 23: 'Fidgety', 10: 'Okay', 11: 'Calm', 12: 'Relieved',
  13: 'Content', 14: 'Hopeful', 15: 'Grateful', 16: 'Proud', 17: 'Loved',
  18: 'Joyful', 19: 'Happy', 20: 'Excited',
};

// Maps each mood to a 1–10 wellbeing score so trends are meaningful on a line chart.
const WELLBEING = {
  1: 1, 2: 2, 3: 2, 21: 3, 4: 3, 5: 3, 6: 2, 7: 3, 8: 2, 9: 4,
  22: 4, 23: 4, 10: 5, 11: 7, 12: 7, 13: 8, 14: 8, 15: 9, 16: 9,
  17: 10, 18: 10, 19: 10, 20: 10,
};

const MILESTONES = [1, 7, 14, 30, 60, 90, 100, 180, 365];

const SCORE_COLOR = (score) => {
  if (score <= 2) return '#ef4444';
  if (score <= 4) return '#f59e0b';
  if (score <= 6) return '#eab308';
  if (score <= 8) return '#84cc16';
  return '#22c55e';
};

function StatCard({ icon: Icon, label, value, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-primary" />
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </motion.div>
  );
}

export default function Progress() {
  const { cleanDays, longestStreak, logs, joinDate } = useCleanDays();

  // Mood trend: average wellbeing score per day, last 30 days
  const moodTrend = useMemo(() => {
    const byDate = {};
    logs.forEach((l) => {
      if (!l.date) return;
      const all = l.moods?.length ? l.moods : (l.mood ? [l.mood] : []);
      if (!all.length) return;
      const avg = all.reduce((s, v) => s + (WELLBEING[v] ?? 5), 0) / all.length;
      byDate[l.date] = avg;
    });
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'yyyy-MM-dd');
      if (byDate[key] !== undefined) {
        days.push({ date: format(d, 'MMM d'), score: Number(byDate[key].toFixed(1)) });
      }
    }
    return days;
  }, [logs]);

  // Mood distribution: most frequent moods across all logs
  const moodDist = useMemo(() => {
    const counts = {};
    logs.forEach((l) => {
      const all = l.moods?.length ? l.moods : (l.mood ? [l.mood] : []);
      all.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    });
    return Object.entries(counts)
      .map(([v, c]) => ({ mood: MOOD_LABELS[v] || 'Unknown', count: c, value: Number(v) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [logs]);

  const totalCheckIns = logs.length;
  const totalAlternatives = useMemo(
    () => logs.reduce((s, l) => s + (l.alternatives_used?.length || 0), 0),
    [logs]
  );
  const cleanDaysNum = Math.max(0, cleanDays);

  const achievedMilestones = MILESTONES.filter((m) => cleanDaysNum >= m);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Your Progress</h1>
          <p className="text-xs text-muted-foreground mt-1">Trends, milestones, and how far you've come.</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard icon={Calendar} label="Check-ins" value={totalCheckIns} delay={0.05} />
          <StatCard icon={Heart} label="Clean days" value={cleanDaysNum} delay={0.1} />
          <StatCard icon={Award} label="Longest streak" value={longestStreak} delay={0.15} />
          <StatCard icon={TrendingUp} label="Coping used" value={totalAlternatives} delay={0.2} />
        </div>

        {/* Mood trend */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm text-foreground">Mood trend</h2>
          </div>
          {moodTrend.length < 2 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Log a few more days to see your mood trend take shape.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={moodTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="text-[10px] text-muted-foreground mt-2 text-center">Wellbeing score (1–10) from your daily moods</p>
        </motion.div>

        {/* Mood distribution */}
        {moodDist.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm text-foreground">Most felt moods</h2>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={moodDist} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <YAxis type="category" dataKey="mood" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={70} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {moodDist.map((entry, i) => (
                    <Cell key={i} fill={SCORE_COLOR(WELLBEING[entry.value] ?? 5)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Milestones */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm text-foreground">Clean streak milestones</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {MILESTONES.map((m) => {
              const achieved = cleanDaysNum >= m;
              return (
                <div
                  key={m}
                  className={`rounded-2xl p-3 text-center border transition-all ${
                    achieved
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-muted/30 border-border/50 opacity-60'
                  }`}
                >
                  <div className="flex justify-center mb-1">
                    {achieved
                      ? <Check className="w-4 h-4 text-primary" />
                      : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <p className={`text-sm font-bold ${achieved ? 'text-primary' : 'text-muted-foreground'}`}>{m}</p>
                  <p className="text-[10px] text-muted-foreground">{m === 1 ? 'day' : 'days'}</p>
                </div>
              );
            })}
          </div>
          {achievedMilestones.length > 0 && (
            <p className="text-xs text-center text-primary font-medium mt-4">
              🎉 {achievedMilestones.length} milestone{achievedMilestones.length > 1 ? 's' : ''} unlocked — keep going.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}