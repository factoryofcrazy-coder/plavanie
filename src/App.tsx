import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Loader } from './components/ui';
import InstallHint from './components/InstallHint';
import { useData } from './lib/data';
import Prehlad from './pages/Prehlad';
import Konkurencia from './pages/Konkurencia';
import Sestry from './pages/Sestry';
import Rebricek from './pages/Rebricek';
import Preteky from './pages/Preteky';
import Admin from './pages/Admin';

const Vyvoj = lazy(() => import('./pages/Vyvoj'));

const NAV = [
  { to: '/', label: 'Prehľad', icon: 'M4 11l8-6 8 6v8H4z' },
  { to: '/vyvoj', label: 'Vývoj', icon: 'M4 17l5-5 4 3 7-8' },
  { to: '/konkurencia', label: 'Konkurencia', icon: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6M3 20c0-3 2.2-5 5-5s5 2 5 5m3-5c2.6 0 5 2 5 5' },
  { to: '/sestry', label: 'Sestry', icon: 'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm9 2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 21c0-3.3 2.7-6 6-6s6 2.7 6 6m1-3c.6-1.8 2.2-3 4-3 2.2 0 4 1.8 4 4' },
  { to: '/rebricek', label: 'Rebríček', icon: 'M5 20V12M12 20V5M19 20v-5' },
  { to: '/preteky', label: 'Preteky', icon: 'M5 4h14v16H5zM5 9h14M10 4v16' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function App() {
  const loc = useLocation();
  const { isEditor } = useData();
  const section = loc.pathname.split('/')[1] || 'home';

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [section]);

  return (
    <>
      <a href="#obsah" className="skip">Preskočiť na obsah</a>
      <header className={`topbar${section === 'home' ? ' on-dark' : ''}`}>
        <NavLink to="/" className="wordmark" aria-label="Kristínka – domov">
          <span className="wm-mark" aria-hidden="true"><i /><i /><i /></span>
          KRISTÍNKA
        </NavLink>
        <nav className="mainnav" aria-label="Hlavná navigácia">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              {({ isActive }) => (
                <>
                  <span>{n.label}</span>
                  {isActive && <motion.span className="nav-line" layoutId="nav-line" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/admin" className="adminlink" aria-label={isEditor ? 'Správa dát' : 'Prihlásenie pre admina'}>
          {isEditor ? 'Správa' : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z" /></svg>
          )}
        </NavLink>
      </header>

      <main id="obsah">
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Routes location={loc}>
              <Route path="/" element={<Prehlad />} />
              <Route path="/vyvoj" element={<Suspense fallback={<div className="wrap"><Loader /></div>}><Vyvoj /></Suspense>} />
              <Route path="/konkurencia" element={<Konkurencia />} />
              <Route path="/sestry" element={<Sestry />} />
              <Route path="/rebricek" element={<Rebricek />} />
              <Route path="/preteky" element={<Preteky />} />
              <Route path="/preteky/:id" element={<Preteky />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Prehlad />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <InstallHint />

      <nav className="tabbar" aria-label="Navigácia">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <Icon d={n.icon} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <footer className="foot">
        <div className="foot-inner">
          <span className="wordmark small">KRISTÍNKA</span>
          <p>Výsledky z oficiálnych pretekov Slovenskej plaveckej federácie (live.swimrankings.net), staršie časy podľa swimrankings.net.</p>
        </div>
      </footer>
    </>
  );
}
