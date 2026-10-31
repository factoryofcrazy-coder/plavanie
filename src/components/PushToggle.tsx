import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const b64 = (s: string) => {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

type State = 'loading' | 'unsupported' | 'ios-install' | 'off' | 'on' | 'denied' | 'busy';

/** Zapnutie upozornení na mobil po pretekoch */
export default function PushToggle() {
  const [state, setState] = useState<State>('loading');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return setState(ios && !standalone ? 'ios-install' : 'unsupported');
    }
    if (Notification.permission === 'denied') return setState('denied');
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    }).catch(() => setState('off'));
  }, []);

  const enable = async () => {
    setState('busy'); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off');
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const { data } = await supabase.from('settings').select('value').eq('key', 'vapid_public').maybeSingle();
      if (!data?.value) throw new Error('Upozornenia ešte nie sú nastavené');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(data.value) });
      const j = sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').insert({ endpoint: j.endpoint, sub: j });
      if (error && error.code !== '23505') throw error;
      setState('on');
      setMsg('Hotovo. Správa príde, keď pribudnú nové výsledky.');
    } catch (e: any) {
      setState('off'); setMsg(e?.message ?? 'Nepodarilo sa zapnúť upozornenia');
    }
  };

  const disable = async () => {
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off'); setMsg(null);
    } catch { setState('on'); }
  };

  if (state === 'loading' || state === 'unsupported') return null;
  return (
    <aside className="push-card" aria-live="polite">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 3.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>
      <div>
        <b>Upozornenia po pretekoch</b>
        <p>
          {state === 'on' ? 'Zapnuté na tomto zariadení.' :
            state === 'denied' ? 'Upozornenia sú v nastaveniach telefónu zakázané pre túto stránku.' :
            state === 'ios-install' ? 'Na iPhone najprv pridaj stránku na plochu (Zdieľať → Pridať na plochu) a otvor ju z ikony.' :
            'Príde správa na mobil s novými časmi a osobákmi.'}
          {msg && <> {msg}</>}
        </p>
      </div>
      {(state === 'off' || state === 'busy') && <button className="btn small" disabled={state === 'busy'} onClick={enable}>Zapnúť</button>}
      {state === 'on' && <button className="btn small ghost" onClick={disable}>Vypnúť</button>}
    </aside>
  );
}
