import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ROOT_TABS, SUB_PAGE_PARENT } from '@/lib/tabNav';

const PAGE_TITLES = {
  '/': 'Your Journey',
  '/activities': 'Activities',
  '/vent': 'Vent',
  '/contacts': "You're Not Alone",
  '/settings': 'Settings',
  '/alternatives': 'Alternatives',
  '/progress': 'Progress Insights',
  '/journal': 'Journal History',
};

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = PAGE_TITLES[location.pathname] || '';
  const isSubPage = !ROOT_TABS.includes(location.pathname);
  const canGoBack = location.key !== 'default';

  return (
    <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 safe-top">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center relative">
        {isSubPage && (
          <button
            onClick={() => (canGoBack ? navigate(-1) : navigate(SUB_PAGE_PARENT[location.pathname] || '/'))}
            className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-sm font-bold text-foreground mx-auto">{title}</h1>
      </div>
    </div>
  );
}