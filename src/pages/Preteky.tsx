import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Empty, LaneRope, Loader } from '../components/ui';
import { groupByMeet, meetCity, meetTitle, useData, type Swim } from '../lib/data';
import { supabase } from '../lib/supabase';
import { courseName, disciplineLabel, fmtDate, fmtTime, LIVE, plural, resultPdf, seasonOf } from '../lib/format';

interface Listed { id: number; text: string; pool: string | null; status: 'live' | 'upcoming' | 'finished'; name: string; date: string | null; city: string | null }
interface MeetIndex {
  id: number;
  title: string;
  url: string;
  files: { name: string; url: string }[];
  events: { number: number; title: string; start: string | null; result: string | null }[];
}

const fileName: Record<string, string> = {
  'Medals.pdf': 'Medailová štatistika',
  'MedalsByClub.pdf': 'Medaily podľa klubov',
  'ProgressionSummary.pdf': 'Zlepšenia plavcov',
  'EntryStatistics.pdf': 'Štatistika prihlášok',
};

function MeetSheet({ id, mine, onClose }: { id: number; mine: Swim[]; onClose: () => void }) {
  const [data, setData] = useState<MeetIndex | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [onlyWomen, setOnlyWomen] = useState(true);
  useEffect(() => {
    fetch(`/api/meet?id=${id}`)
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j.error))))
      .then(setData)
      .catch((e) => setErr(String(e || 'Preteky sa nepodarilo načítať')));
  }, [id]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const myEvents = new Set(mine.filter((s) => s.meet_id === id).map((s) => s.event_number));
  const isWomen = (t: string) => /(ženy|žiačky|juniorky|women|girls|dievčatá|\bW\b)/i.test(t);
  const events = data?.events.filter((e) => !onlyWomen || isWomen(e.title) || myEvents.has(e.number)) ?? [];

  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Disciplíny pretekov"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{data?.title?.replace(/\s*[-|].*live.*$/i, '') || 'Preteky'}</h2>
          <button className="btn ghost small" onClick={onClose}>Zavrieť</button>
        </div>
        {err ? (
          <p className="muted">{err}</p>
        ) : !data ? (
          <Loader />
        ) : (
          <>
            <div className="sheet-actions">
              <a className="btn" href={data.url} target="_blank" rel="noreferrer">Otvoriť živé výsledky</a>
              <label className="check">
                <input type="checkbox" checked={onlyWomen} onChange={(e) => setOnlyWomen(e.target.checked)} /> Iba ženské disciplíny
              </label>
            </div>
            {events.length === 0 ? (
              <p className="muted">Disciplíny ešte nie sú zverejnené.</p>
            ) : (
              <ol className="events">
                {events.map((e) => (
                  <li key={e.number} className={myEvents.has(e.number) ? 'mine' : ''}>
                    <span className="en">{e.number}</span>
                    <span className="et">{e.title.replace(/StartList.*|ResultList.*/g, '').trim() || `Disciplína ${e.number}`}</span>
                    <span className="el">
                      {e.start && <a href={e.start} target="_blank" rel="noreferrer">Štartovka</a>}
                      {e.result && <a href={e.result} target="_blank" rel="noreferrer" className="res">Výsledky</a>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {data.files.length > 0 && (
              <div className="files">
                {data.files.map((f) => (
                  <a key={f.name} href={f.url} target="_blank" rel="noreferrer">{fileName[f.name] ?? f.name}</a>
                ))}
              </div>
            )}
          </>
        )}
      </motion.aside>
    </motion.div>
  );
}

export default function Preteky() {
  const { swims, pbs, loading } = useData();
  const { id } = useParams();
  const nav = useNavigate();
  const [listed, setListed] = useState<Listed[] | null>(null);
  const [listErr, setListErr] = useState(false);
  const [dbNames, setDbNames] = useState<Map<number, { name: string; city: string | null }>>(new Map());
  useEffect(() => {
    supabase.from('meets').select('id,name,city').then(({ data }) => setDbNames(new Map((data ?? []).map((m: any) => [m.id, m]))));
  }, []);

  useEffect(() => {
    fetch('/api/meet?list=SVK')
      .then((r) => r.json())
      .then((j) => setListed(j.meets ?? []))
      .catch(() => setListErr(true));
  }, []);

  const groups = useMemo(() => groupByMeet(swims), [swims]);
  const seasons = useMemo(() => {
    const set = new Map<string, { label: string; from: string; to: string }>();
    for (const g of groups) { const se = seasonOf(new Date(g[0].race_date)); set.set(se.label, se); }
    return [...set.values()];
  }, [groups]);
  const [season, setSeason] = useState<string | null>(null);
  const activeSeason = seasons.find((x) => x.label === season) ?? seasons[0];
  const shownGroups = activeSeason ? groups.filter((g) => g[0].race_date >= activeSeason.from && g[0].race_date <= activeSeason.to) : [];
  const [open, setOpen] = useState<Set<string>>(new Set());
  const pbIds = new Set(pbs.map((p) => p.best.id));

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Preteky</h1>
        <p className="lede">Výsledkové listiny v PDF na jedno ťuknutie, aj priamo na pretekoch.</p>
      </header>

      <section className="block">
        <div className="block-head">
          <h2>Slovenské preteky</h2>
          <p className="muted small">Ťukni na preteky a otvoríš štartovky a výsledky v PDF.</p>
        </div>
        {listErr ? (
          <p className="muted">Zoznam pretekov sa nepodarilo načítať. Skús to o chvíľu.</p>
        ) : !listed ? (
          <Loader />
        ) : (
          <ul className="live-list">
            {listed.slice(0, 15).map((m) => {
              const db = dbNames.get(m.id);
              const label = m.status === 'live' ? 'Práve prebieha' : m.status === 'upcoming' ? 'Čoskoro' : 'Skončené';
              return (
                <li key={m.id}>
                  <button onClick={() => nav(`/preteky/${m.id}`)}>
                    <span className={`st ${m.status}`}>{label}</span>
                    <span className="lt">{db?.name ?? m.name}</span>
                    <span className="lm">
                      {[m.date, db?.city ?? m.city, m.pool ? `${m.pool} m bazén` : null].filter(Boolean).join(', ')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <LaneRope />

      <section className="block">
        <div className="block-head">
          <h2>Kristínkine preteky</h2>
          {seasons.length > 1 && (
            <div className="seg" role="radiogroup" aria-label="Sezóna">
              {seasons.map((x) => (
                <button key={x.label} role="radio" aria-checked={x.label === activeSeason?.label} className={x.label === activeSeason?.label ? 'on' : ''} onClick={() => setSeason(x.label)}>
                  {x.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {loading ? (
          <Loader />
        ) : groups.length === 0 ? (
          <Empty title="Zatiaľ žiadne preteky" />
        ) : (
          <div className="meets">
            {shownGroups.map((g) => {
              const s0 = g.find((x) => x.meet_id) ?? g[0];
              const key = String(s0.id);
              const isOpen = open.has(key) || g.length <= 4;
              const list = isOpen ? g : g.slice(0, 3);
              const nPb = g.filter((x) => pbIds.has(x.id)).length;
              return (
                <article key={key} className="meet">
                  <time className="meet-date" dateTime={s0.race_date}>
                    <b>{new Date(s0.race_date).getDate()}</b>
                    <span>{['jan','feb','mar','apr','máj','jún','júl','aug','sep','okt','nov','dec'][new Date(s0.race_date).getMonth()]} {new Date(s0.race_date).getFullYear()}</span>
                  </time>
                  <div>
                  <header>
                    <div>
                      <h3>{meetTitle(s0)}</h3>
                      <p className="muted">{[meetCity(s0), courseName[s0.course]].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="meet-actions">
                      {nPb > 0 && <span className="flag">{nPb} {plural(nPb, 'osobák', 'osobáky', 'osobákov')}</span>}
                      {s0.meet_id && s0.meet_id > 999 && (
                        <button className="btn ghost small" onClick={() => nav(`/preteky/${s0.meet_id}`)}>Všetky disciplíny</button>
                      )}
                    </div>
                  </header>
                  <ul>
                    {list.map((x) => {
                      const pdf = resultPdf(x.meet_id, x.event_number);
                      return (
                        <li key={x.id}>
                          <Link to={`/vyvoj?d=${x.stroke}-${x.distance}-${x.course}`} className="md">{disciplineLabel(x.distance, x.stroke)}</Link>
                          <span className={`pbmark${pbIds.has(x.id) ? ' on' : ''}`} title={pbIds.has(x.id) ? 'osobný rekord' : undefined} />
                          <span className="mtm">{x.status ?? fmtTime(x.swim_ms)}</span>
                          <span className="mp">{x.points ? `${x.points} b.` : ''}</span>
                          {pdf ? <a className="pdf mini" href={pdf} target="_blank" rel="noreferrer">PDF</a> : <span className="pdf mini off" aria-hidden="true" />}
                        </li>
                      );
                    })}
                  </ul>
                  {!isOpen && (
                    <button className="more" onClick={() => setOpen(new Set(open).add(key))}>
                      Zobraziť ďalšie {g.length - 3} {plural(g.length - 3, 'štart', 'štarty', 'štartov')}
                    </button>
                  )}
                  {g.some((x) => !x.meet_id) && <p className="src">{s0.meet_id ? 'Doplnené' : 'Najlepšie časy sezóny'} podľa swimrankings.net</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="muted small">Ďalšie preteky nájdeš na <a href={LIVE} target="_blank" rel="noreferrer">live.swimrankings.net</a>.</p>
      </section>

      <AnimatePresence>{id && <MeetSheet id={+id} mine={swims} onClose={() => nav('/preteky')} />}</AnimatePresence>
    </div>
  );
}
