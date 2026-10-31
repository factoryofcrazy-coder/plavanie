import { useEffect, useState } from 'react';

const KEY = 'kristinka-install-hint';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = () => { try { localStorage.setItem(KEY, '1'); } catch { /* súkromný režim */ } };

/** Ponuka pridať stránku na plochu ako appku (iPhone: návod, Android/PC: tlačidlo) */
export default function InstallHint() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    if (standalone || read()) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (ios) { const t = setTimeout(() => setShow(true), 2500); return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt); }; }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [standalone, ios]);

  if (!show) return null;
  const close = () => { write(); setShow(false); };

  return (
    <aside className="install" role="dialog" aria-label="Pridať appku na plochu">
      <img src="/icon-192.png" alt="" width="44" height="44" />
      <div>
        <b>Kristínka ako appka</b>
        {prompt ? (
          <p>Pridaj si stránku na plochu, otvorí sa bez prehliadača.</p>
        ) : (
          <p>
            V Safari ťukni na{' '}
            <svg viewBox="0 0 24 24" width="15" height="15" aria-label="Zdieľať" style={{ verticalAlign: '-2px' }}><path d="M12 3v12M8 7l4-4 4 4M5 11v9h14v-9" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>{' '}
            <b>Zdieľať</b> a potom na <b>Pridať na plochu</b>.
          </p>
        )}
      </div>
      {prompt && (
        <button className="btn small" onClick={async () => { prompt.prompt(); await prompt.userChoice; close(); }}>Nainštalovať</button>
      )}
      <button className="install-x" onClick={close} aria-label="Zavrieť">×</button>
    </aside>
  );
}
