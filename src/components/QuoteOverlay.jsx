import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRandomQuote } from '@/lib/quotes';

export default function QuoteOverlay({ onComplete }) {
  const [visible, setVisible] = useState(true);
  const [quote] = useState(() => getRandomQuote());

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          onClick={() => setVisible(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="max-w-lg mx-auto px-8 text-center"
          >
            <p className="text-2xl md:text-3xl font-handwritten text-foreground leading-relaxed mb-6">
              "{quote.text}"
            </p>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              — {quote.author}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-8">tap anywhere to continue</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}