import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LaneRace from '../components/LaneRace';
import { Empty, Loader } from '../components/ui';
import { computePBs, fetchSwims, useData, type Athlete, type PB, type Swim } from '../lib/data';
import { courseShort, disciplineLabel, fmtGap, fmtTime, type Course } from '../lib/format';
import { supabase } from '../lib/supabase';

interface Rival {
  athlete: Athlete;
  swims: Swim[];
  pbs: PB[];
}

export default function Konkurencia() {
  const { athlete: me, pbs: myPbs, swims: mySwims, loading } = useData();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Athlete[]>([]);
  const [searching, setSearching] = useState(false);
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [course, setCourse] = useState<Course>('SCM');
  const [disc, setDisc] = useState<string | null>(null);
  const ids = (params.get('s') ?? '').split(',').filter(Boolean).map(Number);

  // vyhľadávanie s oneskorením
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setHits([]);
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_athletes', { p_q: term, p_gender: me?.gender ?? 'F' });
      setHits(((data as Athlete[]) ?? []).filter((a) => a.id !== me?.id));
      setSearching(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q, me]);

  // načítanie vybraných súperiek
  useEffect(() => {
    let cancel = false;
    (async () => {
      const out: Rival[] = [];
      for (const id of ids) {
        const have = rivals.find((r) => r.athlete.id === id);
        if (have) { out.push(have); continue; }
        const { data: a } = await supabase.from('athletes').select('*').eq('id', id).maybeSingle();
        if (!a) continue;
        const swims = await fetchSwims(id);
        out.push({ athlete: a as Athlete, swims, pbs: computePBs(swims) });
      }
      if (!cancel) setRivals(out);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('s')]);

  const toggle = (a: Athlete) => {
    const next = ids.includes(a.id) ? ids.filter((i) => i !== a.id) : [...ids, a.id].slice(-4);
    setParams(next.length ? { s: next.join(',') } : {}, { replace: true });
    setQ('');
  };

  // disciplíny, kde má Kristínka rekord aspoň s jednou súperkou
  const rows = useMemo(() => {
    return myPbs
      .filter((p) => p.course === course)
      .map((p) => ({ p, others: rivals.map((r) => r.pbs.find((x) => x.key === p.key) ?? null) }))
      .filter((r) => r.others.some(Boolean));
  }, [myPbs, rivals, course]);

  const activeKey = disc && rows.some((r) => r.p.key === disc) ? disc : rows[0]?.p.key ?? null;
  const active = rows.find((r) => r.p.key === activeKey);

  // vzájomné súboje v tej istej disciplíne na tých istých pretekoch
  const h2h = useMemo(() => {
    const mine = new Map(mySwims.filter((s) => s.meet_id && s.swim_ms && !s.status).map((s) => [`${s.meet_id}|${s.event_number}`, s]));
    return rivals.map((r) => {
      let w = 0, l = 0;
      for (const s of r.swims) {
        const m = mine.get(`${s.meet_id}|${s.event_number}`);
        if (!m || !s.swim_ms || s.status) continue;
        if (m.swim_ms! < s.swim_ms) w++;
        else if (m.swim_ms! > s.swim_ms) l++;
      }
      return { id: r.athlete.id, w, l };
    });
  }, [rivals, mySwims]);

  if (loading) return <div className="wrap"><Loader /></div>;
  if (!me) return <div className="wrap"><Empty title="Najprv treba nahrať výsledky" /></div>;

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Konkurencia</h1>
        <p className="lede">Vyhľadaj plavkyne podľa mena alebo klubu a porovnaj osobné rekordy. Vidíš, o koľko je pred nimi alebo za nimi.</p>
      </header>

      <div className="search">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Meno, priezvisko alebo klub" aria-label="Hľadať plavkyňu" />
        {searching && <span className="spin" aria-hidden="true" />}
      </div>
      <AnimatePresence>
        {hits.length > 0 && (
          <motion.ul className="hits" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {hits.map((a) => (
              <li key={a.id}>
                <button onClick={() => toggle(a)} className={ids.includes(a.id) ? 'on' : ''}>
                  <span className="hn">{a.first_name} {a.last_name}</span>
                  <span className="hc">{a.club ?? ''}{a.birth_year ? `, ročník ${a.birth_year}` : ''}</span>
                  <span className="ha">{ids.includes(a.id) ? 'Odobrať' : 'Porovnať'}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      {q.trim().length >= 2 && !searching && hits.length === 0 && <p className="muted">Nikoho sme nenašli. Skús iba priezvisko alebo názov klubu.</p>}

      {rivals.length > 0 && (
        <div className="chips">
          {rivals.map((r) => (
            <button key={r.athlete.id} className="chip" onClick={() => toggle(r.athlete)} aria-label={`Odobrať ${r.athlete.first_name} ${r.athlete.last_name}`}>
              {r.athlete.first_name} {r.athlete.last_name} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      {rivals.length === 0 ? (
        <Empty title="Vyber, s kým sa chceš porovnať">
          <p>Môžeš pridať až štyri plavkyne naraz.</p>
        </Empty>
      ) : (
        <>
          <div className="block-head">
            <h2>Porovnanie osobných rekordov</h2>
            <div className="seg">
              {(['SCM', 'LCM'] as Course[]).map((c) => (
                <button key={c} className={course === c ? 'on' : ''} onClick={() => setCourse(c)}>{courseShort[c]}</button>
              ))}
            </div>
          </div>

          <div className="h2h">
            {rivals.map((r) => {
              const h = h2h.find((x) => x.id === r.athlete.id)!;
              const idx = rivals.indexOf(r);
              const common = rows.filter((x) => x.others[idx]);
              const faster = common.filter((x) => x.p.best.swim_ms! < x.others[idx]!.best.swim_ms!).length;
              return (
                <div key={r.athlete.id} className="h2h-card">
                  <span className="h2h-name">proti {r.athlete.first_name} {r.athlete.last_name}</span>
                  <span className="h2h-score"><b>{h.w}</b> : <b>{h.l}</b></span>
                  <span className="muted small">{h.w + h.l ? 'výhry : prehry v spoločných rozplavbách' : 'zatiaľ spolu neplávali v rovnakej disciplíne'}</span>
                  {common.length > 0 && (
                    <span className="h2h-pb">
                      Rýchlejší osobák má {me.first_name} v <b>{faster}</b> z {common.length} disciplín ({courseShort[course]} bazén)
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <p className="muted">V {courseShort[course]} bazéne nemajú spoločnú disciplínu.</p>
          ) : (
            <>
              <p className="muted small legend">
                Pod časom súperky je rozdiel oproti {me.first_name}: <span className="gap ahead inline">červený</span> znamená, že súperka je rýchlejšia, <span className="gap behind inline">zelený</span>, že je pomalšia.
              </p>
              <div className="table-scroll">
                <table className="cmp">
                  <thead>
                    <tr>
                      <th scope="col">Disciplína</th>
                      <th scope="col" className="me">{me.first_name}</th>
                      {rivals.map((r) => <th scope="col" key={r.athlete.id}>{r.athlete.first_name} {r.athlete.last_name[0]}.</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ p, others }) => (
                      <tr key={p.key} className={p.key === activeKey ? 'sel' : ''} onClick={() => setDisc(p.key)}>
                        <th scope="row">{disciplineLabel(p.distance, p.stroke)}</th>
                        <td className="me">{fmtTime(p.best.swim_ms)}</td>
                        {others.map((o, i) => (
                          <td key={i}>
                            {o ? (
                              <>
                                {fmtTime(o.best.swim_ms)}
                                <span className={o.best.swim_ms! < p.best.swim_ms! ? 'gap ahead' : 'gap behind'}>
                                  {fmtGap(o.best.swim_ms! - p.best.swim_ms!)}
                                </span>
                                <span className="diff-bar" aria-hidden="true">
                                  <i
                                    className={o.best.swim_ms! < p.best.swim_ms! ? 'ahead' : 'behind'}
                                    style={{ width: `${Math.min(50, (Math.abs(o.best.swim_ms! - p.best.swim_ms!) / p.best.swim_ms!) * 1000)}%` }}
                                  />
                                </span>
                              </>
                            ) : '–'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">Klikni na riadok a pozri si súboj v dráhach.</p>
              {active && (
                <LaneRace
                  key={active.p.key + rivals.length}
                  title={`${disciplineLabel(active.p.distance, active.p.stroke)}, ${courseShort[course]} bazén`}
                  distance={active.p.distance}
                  pool={course === 'LCM' ? 50 : 25}
                  lanes={[
                    { id: me.id, name: `${me.first_name} ${me.last_name}`, sub: 'osobný rekord', ms: active.p.best.swim_ms!, highlight: true },
                    ...rivals.flatMap((r, i) => (active.others[i] ? [{ id: r.athlete.id, name: `${r.athlete.first_name} ${r.athlete.last_name}`, sub: r.athlete.club, ms: active.others[i]!.best.swim_ms! }] : [])),
                  ].sort((a, b) => a.ms - b.ms)}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
