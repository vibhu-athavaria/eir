import React from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

export default function CleanCounter({ days }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-6"
    >
      <div className="inline-flex items-center gap-3 bg-secondary/60 rounded-2xl px-6 py-3">
        <Shield className="w-5 h-5 text-primary" />
        <div className="text-left">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Clean for</p>
          <p className="text-2xl font-bold text-foreground">
            {days} <span className="text-base font-medium text-muted-foreground">{days === 1 ? 'day' : 'days'}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}