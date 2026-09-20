import React from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wind, Puzzle, Paintbrush, Layers } from 'lucide-react';
import BreathingExercise from '@/components/activities/BreathingExercise';
import MemoryGame from '@/components/activities/MemoryGame';
import ArtPad from '@/components/activities/ArtPad';
import StackingGame from '@/components/activities/StackingGame';

export default function Activities() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mb-6"
        >
          <p className="text-xs text-muted-foreground">Take a moment for yourself</p>
        </motion.div>

        <Tabs defaultValue="breathe" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-6 h-11 rounded-xl">
            <TabsTrigger value="breathe" className="gap-1 text-[11px] rounded-lg">
              <Wind className="w-3.5 h-3.5" /> Breathe
            </TabsTrigger>
            <TabsTrigger value="games" className="gap-1 text-[11px] rounded-lg">
              <Puzzle className="w-3.5 h-3.5" /> Focus
            </TabsTrigger>
            <TabsTrigger value="stack" className="gap-1 text-[11px] rounded-lg">
              <Layers className="w-3.5 h-3.5" /> Stack
            </TabsTrigger>
            <TabsTrigger value="draw" className="gap-1 text-[11px] rounded-lg">
              <Paintbrush className="w-3.5 h-3.5" /> Draw
            </TabsTrigger>
          </TabsList>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <TabsContent value="breathe">
              <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
                <BreathingExercise />
              </div>
            </TabsContent>

            <TabsContent value="games">
              <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
                <MemoryGame />
              </div>
            </TabsContent>

            <TabsContent value="stack">
              <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
                <StackingGame />
              </div>
            </TabsContent>

            <TabsContent value="draw">
              <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
                <ArtPad />
              </div>
            </TabsContent>
          </motion.div>
        </Tabs>
      </div>
    </div>
  );
}