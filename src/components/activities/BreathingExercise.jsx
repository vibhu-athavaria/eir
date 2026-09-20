import React, { useState } from 'react';
import BoxBreathing from '@/components/activities/BoxBreathing';
import WimHofBreathing from '@/components/activities/WimHofBreathing';

export default function BreathingExercise() {
  const [exercise, setExercise] = useState('box');

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-2 mb-6 w-full">
        <button
          onClick={() => setExercise('box')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
            exercise === 'box' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'
          }`}
        >
          Box Breathing
        </button>
        <button
          onClick={() => setExercise('wimhof')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
            exercise === 'wimhof' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'
          }`}
        >
          Wim Hof
        </button>
      </div>
      {exercise === 'box' ? <BoxBreathing /> : <WimHofBreathing />}
    </div>
  );
}