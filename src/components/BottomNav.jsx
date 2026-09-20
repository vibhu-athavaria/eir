import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarDays, Sparkles, MessageCircle, Phone, Palette } from 'lucide-react';
import { pillarOf, getLastPath } from '@/lib/tabNav';

const navItems = [
  { path: '/', icon: CalendarDays, label: 'Calendar' },
  { path: '/activities', icon: Sparkles, label: 'Activities' },
  { path: '/vent', icon: MessageCircle, label: 'Vent' },
  { path: '/contacts', icon: Phone, label: 'Help' },
  { path: '/settings', icon: Palette, label: 'Settings' },
];

// Persists scroll positions across tab switches (module-level, survives re-renders)
const scrollPositions = {};

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const activePillar = pillarOf(location.pathname);

  const handleTabPress = (path) => {
    if (path === activePillar) {
      // Tapping the already-active tab resets to its root and scrolls up
      navigate(path);
      requestAnimationFrame(() => {
        const activeContainer = document.querySelector('.overflow-y-auto');
        if (activeContainer) {
          activeContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      return;
    }

    // Save current scroll position for the route we're leaving
    scrollPositions[location.pathname] = window.scrollY;

    // Return to the last visited sub-route under that tab (or its root)
    const dest = getLastPath(path);
    navigate(dest);

    // Restore scroll position for the route we're going to (after render)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollPositions[dest] ?? 0, behavior: 'instant' });
      });
    });
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-t border-border pb-safe">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16 px-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = activePillar === path;
          return (
            <button
              key={path}
              onClick={() => handleTabPress(path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary scale-105'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}