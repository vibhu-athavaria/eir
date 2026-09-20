import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';

const TOTAL_BREATHS = 30;
const HALF_BREATH_MS = 2000;
const HOLD_DURATIONS = [60, 60, 90];

const INSTRUCTIONS = [
  '30 deep breaths — in through the nose, out through the mouth',
  'Breathe into your stomach first, then fill your chest',
  'On the 30th breath, breathe out and hold your breath',
  'Hold for 1 minute (1.5 minutes on the third round)',
  'Pressure on the forehead, tingling in hands or feet is normal',
  'You can breathe if you need to — but try to hold',
  'Repeat 3 rounds',
];

export default function WimHofBreathing() {
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('breathe');
  const [step, setStep] = useState(0);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [paused, setPaused] = useState(false);

  const breathTimerRef = useRef(null);
  const holdTimerRef = useRef(null);

  useEffect(() => {
    if (!started || phase !== 'breathe' || paused) return;

    breathTimerRef.current = setInterval(() => {
      setStep(prev => {
        if (prev >= TOTAL_BREATHS * 2 - 1) {
          clearInterval(breathTimerRef.current);
          setPhase('hold');
          setHoldSeconds(HOLD_DURATIONS[round]);
          return prev;
        }
        return prev + 1;
      });
    }, HALF_BREATH_MS);

    return () => clearInterval(breathTimerRef.current);
  }, [started, phase, paused, round]);

  useEffect(() => {
    if (!started || phase !== 'hold' || paused) return;

    holdTimerRef.current = setInterval(() => {
      setHoldSeconds(prev => {
        if (prev <= 1) {
          clearInterval(holdTimerRef.current);
          if (round < HOLD_DURATIONS.length - 1) {
            setRound(r => r + 1);
            setStep(0);
            setPhase('breathe');
          } else {
            setPhase('done');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(holdTimerRef.current);
  }, [started, phase, paused, round]);

  const handleStart = () => {
    setStarted(true);
    setRound(0);
    setPhase('breathe');
    setStep(0);
    setHoldSeconds(0);
    setPaused(false);
  };

  const handleReset = () => {
    clearInterval(breathTimerRef.current);
    clearInterval(holdTimerRef.current);
    setStarted(false);
    setRound(0);
    setPhase('breathe');
    setStep(0);
    setHoldSeconds(0);
    setPaused(false);
  };

  const breathPhase = step % 2 === 0 ? 'inhale' : 'exhale';
  const breathCount = Math.floor(step / 2) + 1;
  const circleScale = phase === 'breathe'
    ? (breathPhase === 'inhale' ? 1.15 : 0.65)
    : phase === 'done' ? 1 : 0.5;

  if (!started) {
    return (
      <div className="flex flex-col items-center">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold text-foreground">Wim Hof Method</p>
          <p className="text-xs text-muted-foreground mt-1">3 rounds of 30 deep breaths + breath hold</p>
        </div>
        <div className="w-full mb-6 space-y-2.5">
          {INSTRUCTIONS.map((instruction, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="font-bold text-primary shrink-0">{i + 1}.</span>
              <span>{instruction}</span>
            </div>
          ))}
        </div>
        <Button onClick={handleStart} className="rounded-full px-6 gap-2">
          <Play className="w-4 h-4" /> Start
        </Button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-44 h-44 flex items-center justify-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute inset-0 rounded-full bg-primary/25 border-4 border-primary/50"
          />
          <div className="relative z-10 text-center">
            <p className="text-sm font-semibold text-foreground">Complete</p>
            <p className="text-xs text-muted-foreground mt-1">Well done</p>
          </div>
        </div>
        <Button variant="outline" size="icon" className="rounded-full w-12 h-12" onClick={handleReset}>
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-center">
        <p className="text-sm font-semibold text-foreground">Round {round + 1} of 3</p>
      </div>

      <div className="relative w-44 h-44 flex items-center justify-center mb-6">
        <motion.div
          animate={{ scale: circleScale }}
          transition={{ duration: phase === 'breathe' ? HALF_BREATH_MS / 1000 : 0.3, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-primary/25 border-4 border-primary/50"
        />
        <div className="relative z-10 text-center px-2">
          {phase === 'breathe' ? (
            <>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {paused ? 'Paused' : (breathPhase === 'inhale' ? 'Breathe in' : 'Breathe out')}
              </p>
              <p className="text-3xl font-bold text-primary mt-1">{breathCount}</p>
              <p className="text-xs text-muted-foreground">/ {TOTAL_BREATHS}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {paused ? 'Paused' : 'Hold'}
              </p>
              <p className="text-3xl font-bold text-primary mt-1">{holdSeconds}</p>
              <p className="text-xs text-muted-foreground">seconds</p>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="rounded-full px-6 gap-2"
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="outline" size="icon" className="rounded-full w-12 h-12" onClick={handleReset}>
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {phase === 'hold' && (
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Tingling or pressure is normal. Breathe if you need to.
        </p>
      )}
    </div>
  );
}