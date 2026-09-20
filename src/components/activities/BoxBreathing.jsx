import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { RotateCcw, Play } from 'lucide-react';

const PATTERN = { breathe: 4, hold1: 4, exhale: 4, hold2: 4 };

const phaseLabels = {
  breathe: 'Breathe in...',
  hold1: 'Hold...',
  exhale: 'Breathe out...',
  hold2: 'Hold...',
};

const phaseOrder = ['breathe', 'hold1', 'exhale', 'hold2'];

export default function BoxBreathing() {
  const [phase, setPhase] = useState('breathe');
  const [seconds, setSeconds] = useState(PATTERN.breathe);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          setPhase(currentPhase => {
            const currentIdx = phaseOrder.indexOf(currentPhase);
            const nextPhase = phaseOrder[(currentIdx + 1) % phaseOrder.length];
            setTimeout(() => setSeconds(PATTERN[nextPhase]), 0);
            return nextPhase;
          });
          return prev;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [running, phase]);

  const reset = () => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setPhase('breathe');
    setSeconds(PATTERN.breathe);
  };

  const start = () => {
    setPhase('breathe');
    setSeconds(PATTERN.breathe);
    setRunning(true);
  };

  const circleScale = phase === 'breathe' || phase === 'hold1' ? 1.15 : 0.65;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-6 text-center">
        <p className="text-sm font-semibold text-foreground">Box Breathing</p>
        <p className="text-xs text-muted-foreground mt-1">4 in. 4 hold. 4 out. 4 hold.</p>
      </div>

      <div className="relative w-44 h-44 flex items-center justify-center mb-6">
        <motion.div
          animate={{ scale: running ? circleScale : 1 }}
          transition={{
            duration: phase === 'breathe' ? PATTERN.breathe : phase === 'exhale' ? PATTERN.exhale : 0.05,
            ease: 'easeInOut'
          }}
          className="absolute inset-0 rounded-full bg-primary/25 border-4 border-primary/50"
        />
        <div className="relative z-10 text-center px-2">
          <p className="text-sm font-semibold text-foreground leading-tight">
            {running ? phaseLabels[phase] : 'Ready'}
          </p>
          {running && <p className="text-3xl font-bold text-primary mt-1">{seconds}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        {!running ? (
          <Button onClick={start} className="rounded-full px-6 gap-2">
            <Play className="w-4 h-4" /> Start
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="rounded-full w-12 h-12" onClick={reset}>
            <RotateCcw className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}