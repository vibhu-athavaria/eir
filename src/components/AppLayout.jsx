import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import TopNav from '@/components/TopNav';
import Footer from '@/components/Footer';
import QuoteOverlay from '@/components/QuoteOverlay';
import TutorialOverlay from '@/components/TutorialOverlay';
import Home from '@/pages/Home';
import Activities from '@/pages/Activities';
import Vent from '@/pages/Vent';
import EmergencyContacts from '@/pages/EmergencyContacts';
import Settings from '@/pages/Settings';
import LocationPrompt from '@/components/LocationPrompt';
import { useDailyReminder } from '@/hooks/useDailyReminder';
import { useAuth } from '@/lib/AuthContext';
import { recordVisit } from '@/lib/tabNav';

// These are the main bottom-nav tabs — kept mounted to preserve state
const TAB_PATHS = ['/', '/activities', '/vent', '/contacts', '/settings'];

const pageVariants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

export default function AppLayout() {
  useDailyReminder();
  const { user, updateProfile } = useAuth();
  const [showQuote, setShowQuote] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const location = useLocation();

  // Onboarding flags live on the user profile, not the device, so every new user
  // (on any device) logs in, shares location, and reads the intro exactly once.
  // `user` can briefly (or, if the profile fetch fails, indefinitely) be just the
  // bare session fields with no profile spread in yet — `tutorial_done` is
  // `undefined` in that case, not `false`, so we wait for the real value instead
  // of treating "not loaded" as "not done" (which would flash both overlays on
  // every sign-in and get stuck open forever if the profile never loads).
  useEffect(() => {
    if (!user || user.tutorial_done === undefined) return;
    setShowTutorial(!user.tutorial_done);
    setShowLocation(!user.location_asked);
  }, [user]);

  // Remember the last route visited under each tab pillar so tabbing returns there
  useEffect(() => {
    recordVisit(location.pathname);
  }, [location.pathname]);

  // Per-page browser tab titles
  useEffect(() => {
    const PAGE_TITLES = {
      '/': 'Eir — Home',
      '/vent': 'Eir — Vent',
      '/activities': 'Eir — Activities',
      '/settings': 'Eir — Settings',
      '/contacts': 'Eir — Help',
      '/alternatives': 'Eir — Right Now',
      '/progress': 'Eir — Check-in',
      '/journal': 'Eir — Journal',
    };
    document.title = PAGE_TITLES[location.pathname] || 'Eir — A Private Space for Recovery';
  }, [location.pathname]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    updateProfile({ tutorial_done: true }).catch(() => {});
  };

  const handleLocationComplete = () => {
    setShowLocation(false);
    updateProfile({ location_asked: true }).catch(() => {});
  };

  const isTabRoute = TAB_PATHS.includes(location.pathname);

  return (
    <>
      <AnimatePresence>
        {!!user && showTutorial && <TutorialOverlay onComplete={handleTutorialComplete} />}
      </AnimatePresence>
      {!!user && showQuote && !showTutorial && <QuoteOverlay onComplete={() => setShowQuote(false)} />}
      <AnimatePresence>
        {!!user && showLocation && !showTutorial && !showQuote && (
          <LocationPrompt onComplete={handleLocationComplete} />
        )}
      </AnimatePresence>
      <div className={showQuote ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}>
        <TopNav />

        {/* Tab pages: always mounted, toggled visible/hidden to preserve state */}
        <div style={{ display: isTabRoute ? 'block' : 'none' }}>
          <div style={{ display: location.pathname === '/' ? 'block' : 'none' }}><Home /></div>
          <div style={{ display: location.pathname === '/activities' ? 'block' : 'none' }}><Activities /></div>
          <div style={{ display: location.pathname === '/vent' ? 'block' : 'none' }}><Vent /></div>
          <div style={{ display: location.pathname === '/contacts' ? 'block' : 'none' }}><EmergencyContacts /></div>
          <div style={{ display: location.pathname === '/settings' ? 'block' : 'none' }}><Settings /></div>
        </div>

        {/* Sub-pages (e.g. /alternatives) use animated Outlet */}
        {!isTabRoute && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        )}

        <Footer />
        <BottomNav />
      </div>
    </>
  );
}