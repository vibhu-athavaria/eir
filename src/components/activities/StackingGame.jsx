import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trophy, Sparkles, Play, Pause } from 'lucide-react';

const HS_KEY = 'eir-stack-highscore';
const COLORS = ['#fb7185', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#60a5fa', '#c084fc', '#f472b6'];
const W = 360;
const H = 460;
const BLOCK_H = 26;
const START_W = 110;
const CAM_TOP = 120; // screen y at which the tower top should hover

export default function StackingGame() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem(HS_KEY)) || 0);
  const [status, setStatus] = useState('ready');
  const [newBest, setNewBest] = useState(false);
  const game = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!newBest) return;
    const fire = (opts) => confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, ...opts });
    fire();
    setTimeout(() => fire({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } }), 180);
    setTimeout(() => fire({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } }), 360);
  }, [newBest]);

  const initGame = useCallback(() => {
    game.current = {
      blocks: [{ x: (W - START_W) / 2, w: START_W, y: 0, h: BLOCK_H, color: COLORS[0] }],
      current: { x: 0, w: START_W, y: BLOCK_H, h: BLOCK_H, vx: 1.5, color: COLORS[1] },
      dir: 1,
      viewBottom: 0,
      falling: [],
      speed: 1.5,
      score: 0,
      over: false,
      active: false,
    };
    setScore(0);
    setStatus('ready');
    setNewBest(false);
  }, []);

  const startGame = useCallback(() => {
    const g = game.current;
    if (g) g.active = true;
    setStatus('playing');
  }, []);

  const pauseGame = useCallback(() => {
    const g = game.current;
    if (g) g.active = false;
    setStatus('paused');
  }, []);

  const restartAndPlay = useCallback(() => {
    initGame();
    const g = game.current;
    if (g) g.active = true;
    setStatus('playing');
  }, [initGame]);

  useEffect(() => {
    initGame();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const drawBlock = (b) => {
      const g = game.current;
      const top = H - (b.y + b.h - g.viewBottom);
      const bottom = H - (b.y - g.viewBottom);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, top, b.w, bottom - top);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(b.x, bottom - 4, b.w, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(b.x, top, b.w, 4);
    };

    const loop = () => {
      const g = game.current;
      if (g) {
        const topBlock = g.blocks[g.blocks.length - 1];
        const topY = topBlock.y + topBlock.h;
        const target = Math.max(0, topY - (H - CAM_TOP));
        g.viewBottom += (target - g.viewBottom) * 0.1;

        if (g.active && !g.over) {
          g.current.x += g.current.vx * g.dir;
          if (g.current.x <= 0) { g.current.x = 0; g.dir = 1; }
          if (g.current.x >= W - g.current.w) { g.current.x = W - g.current.w; g.dir = -1; }
        }

        if (g.active) {
          g.falling = g.falling.filter((p) => {
            p.vy -= 0.6;
            p.y += p.vy;
            p.x += p.vx;
            return H - (p.y - g.viewBottom) < H + 80;
          });
        }

        ctx.clearRect(0, 0, W, H);
        g.blocks.forEach(drawBlock);
        g.falling.forEach(drawBlock);
        if (!g.over) drawBlock(g.current);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initGame]);

  const drop = useCallback(() => {
    const g = game.current;
    if (!g || g.over || !g.active) return;
    const below = g.blocks[g.blocks.length - 1];
    const cur = g.current;
    const oL = Math.max(cur.x, below.x);
    const oR = Math.min(cur.x + cur.w, below.x + below.w);
    const newW = oR - oL;

    if (cur.x < oL) g.falling.push({ x: cur.x, w: oL - cur.x, y: cur.y, h: BLOCK_H, color: cur.color, vx: -1.4, vy: 0.5 });
    if (cur.x + cur.w > oR) g.falling.push({ x: oR, w: cur.x + cur.w - oR, y: cur.y, h: BLOCK_H, color: cur.color, vx: 1.4, vy: 0.5 });

    if (newW <= 0) {
      g.over = true;
      setStatus('over');
      const prev = Number(localStorage.getItem(HS_KEY)) || 0;
      if (g.score > prev) {
        localStorage.setItem(HS_KEY, String(g.score));
        setHighScore(g.score);
        setNewBest(true);
      }
      return;
    }

    const placed = { x: oL, w: newW, y: cur.y, h: BLOCK_H, color: cur.color };
    g.blocks.push(placed);
    g.score += 1;
    setScore(g.score);
    const nextColor = COLORS[g.blocks.length % COLORS.length];
    g.speed = Math.min(4, 1.5 + g.score * 0.12);
    g.dir = g.blocks.length % 2 === 0 ? 1 : -1;
    g.current = {
      x: g.dir === 1 ? 0 : W - newW,
      w: newW,
      y: placed.y + BLOCK_H,
      h: BLOCK_H,
      vx: g.speed,
      color: nextColor,
    };
  }, []);

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-stretch justify-between w-full mb-3 gap-2">
        <div className="flex items-center gap-2 bg-secondary/40 rounded-xl px-3 py-2 border border-border/50">
          <span className="text-xs text-muted-foreground">Blocks</span>
          <span className="text-lg font-extrabold text-foreground leading-none">{score}</span>
        </div>
        <div className="flex items-center gap-2 bg-primary/15 rounded-xl px-3 py-2 border border-primary/30">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary/80">Best</span>
          <span className="text-lg font-extrabold text-primary leading-none">{highScore}</span>
        </div>
      </div>

      <div
        onPointerDown={(e) => { e.preventDefault(); drop(); }}
        className="relative w-full touch-none rounded-2xl overflow-hidden bg-secondary/30 border border-border/50"
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />

        {status === 'playing' && (
          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground/80 pointer-events-none">
            Tap to drop
          </p>
        )}

        <AnimatePresence>
          {status === 'ready' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-3 px-6 text-center"
            >
              <p className="text-base font-bold text-foreground">Ready to stack?</p>
              <p className="text-xs text-muted-foreground max-w-[15rem]">
                Tap the screen to drop each drifting block. Build your tower as high as you can.
              </p>
              <Button onClick={startGame} size="sm" className="gap-1.5 rounded-xl">
                <Play className="w-3.5 h-3.5" /> Start
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'paused' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-3 px-6 text-center"
            >
              <p className="text-base font-bold text-foreground">Paused</p>
              <div className="flex gap-2">
                <Button onClick={startGame} size="sm" className="gap-1.5 rounded-xl">
                  <Play className="w-3.5 h-3.5" /> Resume
                </Button>
                <Button onClick={initGame} variant="outline" size="sm" className="gap-1.5 rounded-xl">
                  <RotateCcw className="w-3.5 h-3.5" /> Start Over
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'over' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm gap-3 px-6 text-center"
            >
              {newBest ? (
                <>
                  <motion.div
                    initial={{ scale: 0.5, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="w-6 h-6 text-primary" />
                    <p className="text-2xl font-extrabold text-primary">New Best!</p>
                    <Sparkles className="w-6 h-6 text-primary" />
                  </motion.div>
                  <p className="text-sm font-semibold text-foreground">
                    You beat your record with {score} blocks 🎉
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-foreground">Tower fell!</p>
                  <p className="text-sm text-muted-foreground">
                    You stacked {score} block{score === 1 ? '' : 's'}
                  </p>
                </>
              )}
              <Button onClick={restartAndPlay} size="sm" className="gap-1.5 rounded-xl">
                <RotateCcw className="w-3.5 h-3.5" /> Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-xs text-muted-foreground mt-3 text-center">
        Time your tap as the block drifts — overhanging edges fall away. Stack as high as you can.
      </p>

      {status === 'playing' && (
        <div className="flex gap-2 mt-3">
          <Button onClick={pauseGame} variant="outline" size="sm" className="gap-1.5 rounded-xl">
            <Pause className="w-3.5 h-3.5" /> Pause
          </Button>
          <Button onClick={initGame} variant="outline" size="sm" className="gap-1.5 rounded-xl">
            <RotateCcw className="w-3.5 h-3.5" /> Start Over
          </Button>
        </div>
      )}
    </div>
  );
}