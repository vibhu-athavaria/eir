import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, ChevronDown, ChevronUp } from 'lucide-react';

// Real things people who've struggled with self-harm say help them when an urge hits.
const COMMUNITY_TIPS = [
  {
    id: 'exercise',
    name: 'Move it out — hard',
    voice:
      "When the urge spikes, pushing hard physically — push-ups, sprints, anything that burns — leaves less room for the urge.",
    try: [
      'Drop and do push-ups, squats, or jumping jacks until the muscles genuinely burn',
      'Sprint, run stairs, or hit a pillow hard',
      'Pick an exercise that doubles as a hobby — bike riding, swimming, skateboarding, dancing, hiking — and go until the urge loosens',
      'Keep going until tired; the urge often shrinks as the energy does',
    ],
  },
  {
    id: 'spicy',
    name: 'Eat something really spicy',
    voice:
      'A strong hit of heat or sharp flavour can shock the brain out of the urge for a minute.',
    try: [
      'Keep hot sauce, chilli flakes, spicy chips, a raw chilli, or even a raw onion nearby',
      'Eat a small amount — the burn (or the onion\'s sharpness) gives a strong, safe sensory hit',
      'Focus on the sensation until the wave passes',
    ],
  },
  {
    id: 'boundaries',
    name: 'Set firm boundaries with yourself',
    voice:
      'Deciding the rule ahead of time — and holding yourself to it — gives the urge something solid to hit against.',
    try: [
      'Decide the rule now, while calm: when the urge comes, it doesn\'t get acted on — full stop',
      'When it hits, hold the line firmly, like protecting someone you love — because you are',
      'Say it in your head or out loud, whichever feels stronger — the point is to mean it',
      'Repeat it until the urge loses its grip',
    ],
  },
  {
    id: 'journaling',
    name: 'Journal it out',
    voice:
      "Writing takes the thought out of the head and puts it somewhere it can be seen. Prompts help when everything feels too overwhelming to think through.",
    try: [
      '"What am I actually feeling right now — and what happened just before this urge?"',
      '"If I don\'t act on this, what will I be proud of in an hour?"',
      '"Who would be glad I chose differently — and what would I tell them?"',
      '"What does the urge want me to believe — and what\'s actually true?"',
      '"What\'s one tiny thing I can do right now that isn\'t this?"',
    ],
  },
  {
    id: 'hobby',
    name: 'Have a go-to hobby',
    voice:
      'Picking one thing to do the moment the urge hits gives the hands a job and the mind a target.',
    try: [
      'Pick one specific thing now, while calm (drawing, Lego, a game, knitting, puzzles)',
      'Keep it within arm\'s reach',
      'When the urge hits, that\'s the only job — do that thing until the wave passes',
    ],
  },
  {
    id: 'comfort',
    name: 'Get comfortable and let it out',
    voice:
      'Sometimes wrapping up in blankets, putting a movie on, and letting the tears come — no fighting it, just safe.',
    try: [
      'Swaddle up in heavy blankets',
      'Put on a comfort movie or show',
      'Let the tears come if they do — it\'s a release, not a weakness',
    ],
  },
  {
    id: 'remove',
    name: 'Get the tools out of reach',
    voice:
      "Walking anything that could be used out of the room first makes acting on the urge that much harder.",
    try: [
      'Walk anything that could be used to harm out of the room — hand it to someone, or put it far away',
      'Change rooms entirely if needed',
      'Make acting on the urge as inconvenient as possible',
    ],
  },
  {
    id: 'distraction',
    name: 'Get lost in something',
    voice:
      'A book, a game, music, drawing, writing — anything that eats the whole attention until the urge is forgotten.',
    try: [
      'Pick something that needs full attention: a game, a book, drawing, writing, music',
      'Give it everything — don\'t half-do it',
      'Come up for air in 20 minutes; the urge is usually weaker by then',
    ],
  },
  {
    id: 'friend',
    name: 'Call or see someone',
    voice:
      'Calling a friend, or asking for a video call — a real voice pulls out of the spiral faster than almost anything.',
    try: [
      'Call or text someone trusted — even just "can we talk?"',
      'If possible, video call or see them face to face',
      'No need to explain everything; just being connected helps',
    ],
  },
];

function CommunityTipCard({ tip, index }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-2xl border border-border/60 overflow-hidden shadow-sm bg-card"
    >
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <Quote className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground">{tip.name}</p>
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
            <div className="px-4 pb-4 pt-1 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{tip.voice}</p>
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Try this</p>
                <ol className="space-y-1.5">
                  {tip.try.map((s, i) => (
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

export default function CommunityTips() {
  return (
    <div className="space-y-3">
      {COMMUNITY_TIPS.map((tip, i) => (
        <CommunityTipCard key={tip.id} tip={tip} index={i} />
      ))}
    </div>
  );
}