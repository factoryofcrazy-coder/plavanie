import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader } from './components/ui';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useData } from './lib/data';
import Prehlad from './pages/Prehlad';
import Konkurencia from './pages/Konkurencia';
import Rebricek from './pages/Rebricek';
import Preteky from './pages/Preteky';
import Admin from './pages/Admin';

const Vyvoj = lazy(() => import('./pages/Vyvoj'));

const NAV = [
  { to: '/', label: 'Prehľad', icon: 'M3 12l9-8 9 8v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/vyvoj', label: 'Vývoj', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { to: '/konkurencia', label: 'Konkurencia', icon: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 2a3 3 0 1 0 0-6M2 21c0-3.3 2.7-6 6-6s6 2.7 6 6m2-6c2.8 0 5 2.2 5 5' },
  { to: '/rebricek', label: 'Rebríček', icon: 'M8 21V11H3v10zm6.5 0V3h-5v18zM21 21v-7h-5v7' },
  { to: '/preteky', label: 'Preteky', icon: 'M4 4h16v16H4zM4 9h16M9 4v16' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function App() {
  const loc = useLocation();
  const { isEditor, displayName } = useData();
  const first = displayName.split(' ')[0];
  return (
    <>
      <a href="#obsah" className="skip">Preskočiť na obsah</a>
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="Domov">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <circle cx="16" cy="16" r="15" fill="var(--water)" />
            <path d="M5 18c3-3 5-3 8 0s5 3 8 0 5-3 6-1" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <circle cx="20" cy="10" r="2.6" fill="var(--rope-yellow)" />
          </svg>
          <span>{first}</span>
        </NavLink>
        <nav className="mainnav" aria-label="Hlavná navigácia">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <Icon d={n.icon} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink to="/admin" className="adminlink" aria-label={isEditor ? 'Správa dát' : 'Prihlásenie'}>
          <Icon d={isEditor ? 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' : 'M6 10V7a6 6 0 1 1 12 0v3M5 10h14v11H5z'} />
        </NavLink>
      </header>

      <main id="obsah">
        <AnimatePresence mode="wait">
          <motion.div
            key={loc.pathname.split('/')[1] || 'home'}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={loc}>
              <Route path="/" element={<Prehlad />} />
              <Route path="/vyvoj" element={<Suspense fallback={<div className="wrap"><Loader /></div>}><Vyvoj /></Suspense>} />
              <Route path="/konkurencia" element={<Konkurencia />} />
              <Route path="/rebricek" element={<Rebricek />} />
              <Route path="/preteky" element={<Preteky />} />
              <Route path="/preteky/:id" element={<Preteky />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Prehlad />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="tabbar" aria-label="Navigácia">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <Icon d={n.icon} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <footer className="foot">
        <p>Stránka plavkyne {displayName}. Výsledky pochádzajú z oficiálnych výsledkov pretekov Slovenskej plaveckej federácie na live.swimrankings.net.</p>
      </footer>
    </>
  );
}
