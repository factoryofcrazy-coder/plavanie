import { useEffect, useState, type FormEvent } from 'react';
import { Loader } from '../components/ui';
import { useData } from '../lib/data';
import { DISTANCES, STROKES, courseName, disciplineLabel, fmtTime, goalStroke, goalStrokeBack, parseTimeInput, strokeName, type Course, type Stroke } from '../lib/format';
import { supabase, usernameToEmail } from '../lib/supabase';

interface ImportResult { meetId: number; ok: boolean; reason?: string; meet?: string; athletes?: number; swims?: number }

function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(u), password: p });
    setBusy(false);
    if (error) setErr('Nesprávne meno alebo heslo.');
  };
  return (
    <form className="login" onSubmit={submit}>
      <h1>Prihlásenie</h1>
      <p className="muted">Pridávať a upravovať výsledky môže iba admin.</p>
      <label><span>Meno</span><input autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} required /></label>
      <label><span>Heslo</span><input type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} required /></label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Prihlasujem…' : 'Prihlásiť sa'}</button>
    </form>
  );
}

export default function Admin() {
  const { session, isEditor, athlete, goals, reload, swims } = useData();
  const [meets, setMeets] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [listed, setListed] = useState<{ id: number; text: string }[]>([]);
  const [known, setKnown] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isEditor) return;
    fetch('/api/meet?list=SVK').then((r) => r.json()).then((j) => setListed(j.meets ?? [])).catch(() => {});
    supabase.from('meets').select('id').then(({ data }) => setKnown(new Set((data ?? []).map((m: any) => m.id))));
  }, [isEditor, results]);

  if (!session) return <div className="wrap narrow"><Login /></div>;
  if (!isEditor) return <div className="wrap narrow"><Loader /></div>;

  const runImport = async (input: string) => {
    setBusy(true);
    setResults([]);
    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ meets: input }),
      });
      const j = await r.json();
      setResults(j.results ?? [{ meetId: 0, ok: false, reason: j.error }]);
      await reload();
    } catch (e: any) {
      setResults([{ meetId: 0, ok: false, reason: e?.message ?? 'Import zlyhal' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap narrow admin">
      <header className="page-head row">
        <h1>Správa dát</h1>
        <button className="btn ghost small" onClick={() => supabase.auth.signOut()}>Odhlásiť sa</button>
      </header>

      <section className="panel">
        <h2>Nahrať výsledky zo SPF</h2>
        <p className="muted">Vlož odkaz na preteky z live.swimrankings.net (napr. https://live.swimrankings.net/49857/) alebo len číslo. Viac pretekov oddeľ medzerou. Nahrajú sa výsledky všetkých plavcov, takže sa naplní aj rebríček a konkurencia.</p>
        <textarea rows={3} value={meets} onChange={(e) => setMeets(e.target.value)} placeholder="https://live.swimrankings.net/49857/" />
        <button className="btn" disabled={busy || !meets.trim()} onClick={() => runImport(meets)}>{busy ? 'Nahrávam…' : 'Nahrať výsledky'}</button>
        {results.length > 0 && (
          <ul className="import-res">
            {results.map((r) => (
              <li key={r.meetId} className={r.ok ? 'ok' : 'bad'}>
                <b>{r.meet ?? `Preteky ${r.meetId}`}</b> {r.ok ? `nahraté: ${r.swims} výsledkov, ${r.athletes} plavcov` : r.reason}
              </li>
            ))}
          </ul>
        )}
      </section>

      {listed.length > 0 && (
        <section className="panel">
          <h2>Slovenské preteky z posledných týždňov</h2>
          <ul className="listed">
            {listed.map((m) => (
              <li key={m.id}>
                <span>{m.text.replace(/^(Upcoming|Live|Finished)\s*/i, '')}</span>
                <button className="btn ghost small" disabled={busy} onClick={() => runImport(String(m.id))}>
                  {known.has(m.id) ? 'Aktualizovať' : 'Nahrať'}
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">Nové slovenské preteky sa navyše nahrávajú automaticky raz denne.</p>
        </section>
      )}

      {athlete && <ManualSwim athleteId={athlete.id} onSaved={reload} />}
      <Goals goals={goals} onSaved={reload} />
      {athlete && <p className="muted small">V databáze je {swims.length} jej štartov.</p>}
    </div>
  );
}

function ManualSwim({ athleteId, onSaved }: { athleteId: number; onSaved: () => void }) {
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), competition: '', stroke: 'FREE' as Stroke, distance: 50, course: 'SCM' as Course, time: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ms = parseTimeInput(f.time);
    if (!ms) return setMsg('Čas zadaj v tvare 1:27.78 alebo 29.12');
    const { error } = await supabase.from('swims').insert({
      athlete_id: athleteId, race_date: f.date, competition: f.competition || 'Preteky', stroke: f.stroke,
      distance: f.distance, course: f.course, swim_ms: ms,
    });
    setMsg(error ? `Uloženie zlyhalo: ${error.message}` : `Uložené: ${disciplineLabel(f.distance, f.stroke)} ${fmtTime(ms)}`);
    if (!error) { setF({ ...f, time: '' }); onSaved(); }
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2>Pridať výsledok ručne</h2>
      <p className="muted">Pre preteky, ktoré nie sú na live.swimrankings.net.</p>
      <div className="form-grid">
        <label><span>Dátum</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
        <label className="wide"><span>Preteky</span><input value={f.competition} onChange={(e) => setF({ ...f, competition: e.target.value })} placeholder="Názov pretekov" /></label>
        <label><span>Spôsob</span>
          <select value={f.stroke} onChange={(e) => { const s = e.target.value as Stroke; setF({ ...f, stroke: s, distance: DISTANCES[s][0] }); }}>
            {STROKES.map((s) => <option key={s} value={s}>{strokeName[s]}</option>)}
          </select>
        </label>
        <label><span>Vzdialenosť</span>
          <select value={f.distance} onChange={(e) => setF({ ...f, distance: +e.target.value })}>
            {DISTANCES[f.stroke].map((d) => <option key={d} value={d}>{d} m</option>)}
          </select>
        </label>
        <label><span>Bazén</span>
          <select value={f.course} onChange={(e) => setF({ ...f, course: e.target.value as Course })}>
            <option value="SCM">{courseName.SCM}</option><option value="LCM">{courseName.LCM}</option>
          </select>
        </label>
        <label><span>Čas</span><input value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} placeholder="1:27.78" inputMode="decimal" required /></label>
      </div>
      {msg && <p className="note" role="status">{msg}</p>}
      <button className="btn">Uložiť výsledok</button>
    </form>
  );
}

function Goals({ goals, onSaved }: { goals: any[]; onSaved: () => void }) {
  const [f, setF] = useState({ stroke: 'FREE' as Stroke, distance: 50, course: 'SCM' as Course, time: '', label: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const ms = parseTimeInput(f.time);
    if (!ms) return setMsg('Čas zadaj v tvare 1:27.78 alebo 29.12');
    const { error } = await supabase.from('goals').insert({
      stroke: goalStroke[f.stroke], distance: f.distance, pool_length: f.course === 'LCM' ? 50 : 25, course: f.course,
      target_ms: ms, label: f.label || null,
    });
    setMsg(error ? `Uloženie zlyhalo: ${error.message}` : 'Cieľ uložený');
    if (!error) { setF({ ...f, time: '', label: '' }); onSaved(); }
  };
  const remove = async (id: number) => { await supabase.from('goals').delete().eq('id', id); onSaved(); };
  return (
    <form className="panel" onSubmit={add}>
      <h2>Ciele</h2>
      <p className="muted">Cieľ sa ukáže v grafe vývoja aj s odhadom, kedy by ho mohla dosiahnuť.</p>
      {goals.length > 0 && (
        <ul className="goal-list">
          {goals.map((g) => (
            <li key={g.id}>
              <span>{disciplineLabel(g.distance, goalStrokeBack[g.stroke] ?? 'FREE')}, {g.pool_length} m</span>
              <b>{fmtTime(g.target_ms)}</b>
              {g.label && <span className="muted">{g.label}</span>}
              <button type="button" className="btn ghost small" onClick={() => remove(g.id)}>Odstrániť</button>
            </li>
          ))}
        </ul>
      )}
      <div className="form-grid">
        <label><span>Spôsob</span>
          <select value={f.stroke} onChange={(e) => { const s = e.target.value as Stroke; setF({ ...f, stroke: s, distance: DISTANCES[s][0] }); }}>
            {STROKES.map((s) => <option key={s} value={s}>{strokeName[s]}</option>)}
          </select>
        </label>
        <label><span>Vzdialenosť</span>
          <select value={f.distance} onChange={(e) => setF({ ...f, distance: +e.target.value })}>
            {DISTANCES[f.stroke].map((d) => <option key={d} value={d}>{d} m</option>)}
          </select>
        </label>
        <label><span>Bazén</span>
          <select value={f.course} onChange={(e) => setF({ ...f, course: e.target.value as Course })}>
            <option value="SCM">{courseName.SCM}</option><option value="LCM">{courseName.LCM}</option>
          </select>
        </label>
        <label><span>Cieľový čas</span><input value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} placeholder="29.00" required /></label>
        <label className="wide"><span>Poznámka</span><input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="napr. limit na M SR" /></label>
      </div>
      {msg && <p className="note" role="status">{msg}</p>}
      <button className="btn">Pridať cieľ</button>
    </form>
  );
}
