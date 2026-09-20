import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CommunityTips from '@/components/alternatives/CommunityTips';

const ALTERNATIVES = [
  {
    id: 'butterfly',
    name: 'The Butterfly Project',
    tagline: 'Draw a butterfly, keep it alive',
    description:
      'When you feel the urge to hurt yourself, draw a butterfly on your wrist or wherever you feel the urge. Name the butterfly after someone you love or someone who cares about you. You must let the butterfly fade naturally — if you hurt yourself, you wash it away.',
    helps: [
      'Creates a visual reminder of people who care about you',
      'Gives you something to protect (the butterfly)',
      'Connects your body to love rather than pain',
      'The temporary nature mirrors how urges pass',
    ],
    steps: [
      "Draw a butterfly on your wrist, hand, or wherever the urge is strongest",
      "Name it after someone who loves you, or someone you want to stay alive for",
      "Let it fade on its own — don't wash it off",
      "Every time you see it, think of who it's named after",
      "If the urge passes, you kept your butterfly alive",
    ],
  },
  {
    id: 'bracelet',
    name: 'The Bracelet Project',
    tagline: 'Wear a bracelet, snap it instead',
    description:
      'Wear a rubber band or hair tie on your wrist. When you feel an urge, snap it against your skin instead. It provides a brief sting that redirects the sensation without causing lasting harm. Over time, the bracelet can also become a symbol of your commitment to yourself.',
    helps: [
      'Provides a safe physical sensation to redirect urges',
      'The snap sensation can interrupt the urge cycle',
      'Can be done anywhere, discreetly',
      'Becomes a physical reminder of your commitment',
    ],
    steps: [
      'Put a rubber band or soft bracelet on your wrist',
      'When an urge hits, snap it gently against your skin',
      'Focus on the brief sting and take a slow breath',
      'Repeat as needed until the urge subsides',
      'Over time, just touching the bracelet can help ground you',
    ],
  },
  {
    id: 'paperchain',
    name: 'The Paper Chain Project',
    tagline: 'Build your chain, one day at a time',
    description:
      'Every day you get through without self-harming, you add a colorful link to your paper chain. On a day where you do harm, you add a white link instead. Watching the colorful links grow is a powerful, tangible reminder of your strength — and the white links remind you that even hard days are still days you survived.',
    helps: [
      'Makes your progress visible and real',
      'Each colorful link is a small win you can be proud of',
      'White links honor the hard days without erasing them',
      'Hard to break a chain you\'ve worked hard to build',
    ],
    steps: [
      'Cut paper into strips about 2cm wide and 10cm long — lots of colors plus white',
      'At the end of each clean day, write something on a colorful strip and add it to the chain',
      'On a day you harmed, add a white link — it still counts as a day you got through',
      'Loop each strip through the last link and tape or glue it closed',
      'Hang your chain somewhere you\'ll see it — watch it grow',
    ],
  },
  {
    id: 'ice',
    name: 'The Ice Technique',
    tagline: 'Cold sensation without harm',
    description:
      "Hold an ice cube in your hand or press it against your skin where the urge is. The intense cold sensation can satisfy the need for a physical release without causing lasting damage. It's immediate, accessible, and safe.",
    helps: [
      'Provides intense physical sensation safely',
      'Accessible — ice is available almost everywhere',
      'The cold can ground you and pull you out of dissociation',
      'No lasting marks or damage',
    ],
    steps: [
      'Get a few ice cubes from the freezer',
      'Hold them tightly in your hand, or press against your skin',
      'Focus on the sensation — notice how it changes',
      'Breathe slowly while you hold the ice',
      'Let it go when the urge starts to pass',
    ],
  },
  {
    id: 'marker',
    name: 'The Red Marker Method',
    tagline: 'Mark where it hurts — safely',
    description:
      'Using a red washable marker, draw or scribble on the part of your body where you usually feel the urge to harm. It gives your hand something to do, leaves a visible mark where the pain lives, and is completely safe and reversible. Many people find it surprisingly effective at releasing the pressure.',
    helps: [
      'Directly substitutes the action with a safe one',
      'Marks the place of pain without causing damage',
      'Completely harmless and washable',
      'Can be combined with other coping methods',
    ],
    steps: [
      'Keep a red washable marker with you',
      'When an urge comes, uncap it',
      'Draw or color on the area of your body where you usually harm',
      'Take slow breaths and let yourself feel whatever comes up',
      'Wash it off when you\'re ready to move on',
    ],
  },
];

function AlternativeCard({ alt, index }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border border-primary/30 overflow-hidden shadow-sm"
      style={{ backgroundColor: 'hsl(var(--primary) / 0.15)' }}
    >
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-3"
        style={{ backgroundColor: 'hsl(var(--primary) / 0.25)' }}
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <p className="font-bold text-sm text-foreground">{alt.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{alt.tagline}</p>
        </div>
        {open
        ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4 bg-card">
              <p className="text-sm text-foreground leading-relaxed">{alt.description}</p>

              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">How to do it</p>
                <ol className="space-y-1.5">
                  {alt.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="font-bold text-primary shrink-0">{i + 1}.</span> {s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Alternatives() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="mb-6">
          <p className="text-xs text-muted-foreground">Things to try when urges feel strong</p>
        </div>

        <div className="bg-primary/10 rounded-2xl p-4 mb-6 border border-primary/20">
          <p className="text-sm text-foreground leading-relaxed">
            These techniques won't make the pain disappear, but they can help you get through the moment safely. Give them a try — even if it feels silly at first.
          </p>
        </div>

        <div className="space-y-3">
          {ALTERNATIVES.map((alt, i) => (
            <AlternativeCard key={alt.id} alt={alt} index={i} />
          ))}
        </div>

        <div className="mt-10 mb-3">
          <h2 className="text-lg font-bold text-foreground">What the community says</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Real things people who've been there do when the urge hits. Nothing clinical — just what's worked.
          </p>
        </div>

        <CommunityTips />
      </div>
    </div>
  );
}