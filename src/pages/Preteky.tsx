import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Empty, LaneRope, Loader } from '../components/ui';
import { useData, type Swim } from '../lib/data';
import { courseName, disciplineLabel, fmtDate, fmtTime, LIVE, resultPdf } from '../lib/format';

interface Listed { id: number; text: string; pool: string | null }
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

  useEffect(() => {
    fetch('/api/meet?list=SVK')
      .then((r) => r.json())
      .then((j) => setListed(j.meets ?? []))
      .catch(() => setListErr(true));
  }, []);

  const groups = useMemo(() => {
    const by = new Map<string, Swim[]>();
    for (const s of [...swims].reverse()) {
      const k = String(s.meet_id ?? `${s.competition}|${s.race_date}`);
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push(s);
    }
    return [...by.values()];
  }, [swims]);
  const pbIds = new Set(pbs.map((p) => p.best.id));

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Preteky</h1>
        <p className="lede">Výsledkové listiny v PDF na jedno ťuknutie, aj priamo na pretekoch.</p>
      </header>

      <section className="block">
        <h2>Slovenské preteky teraz</h2>
        {listErr ? (
          <p className="muted">Zoznam pretekov sa nepodarilo načítať. Skús to o chvíľu.</p>
        ) : !listed ? (
          <Loader />
        ) : (
          <ul className="live-list">
            {listed.slice(0, 14).map((m) => {
              const t = m.text.replace(/^(Upcoming|Live|Finished|Nadchádzajúce|Prebieha|Ukončené)\s*/i, '');
              const status = /live|prebieha/i.test(m.text) ? 'live' : /upcoming|nadch/i.test(m.text) ? 'soon' : 'done';
              return (
                <li key={m.id}>
                  <button onClick={() => nav(`/preteky/${m.id}`)}>
                    <span className={`st ${status}`}>{status === 'live' ? 'Práve prebieha' : status === 'soon' ? 'Čoskoro' : 'Skončené'}</span>
                    <span className="lt">{t}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <LaneRope />

      <section className="block">
        <h2>Jej preteky</h2>
        {loading ? (
          <Loader />
        ) : groups.length === 0 ? (
          <Empty title="Zatiaľ žiadne preteky" />
        ) : (
          <div className="meets">
            {groups.map((g) => {
              const s0 = g[0];
              return (
                <article key={s0.id} className="meet">
                  <header>
                    <div>
                      <h3>{s0.meets?.name ?? s0.competition ?? 'Preteky'}</h3>
                      <p className="muted">{s0.meets?.city ? `${s0.meets.city}, ` : ''}{fmtDate(s0.race_date)}, {courseName[s0.course]}</p>
                    </div>
                    {s0.meet_id && s0.meet_id > 999 && (
                      <button className="btn ghost small" onClick={() => nav(`/preteky/${s0.meet_id}`)}>Všetky disciplíny</button>
                    )}
                  </header>
                  <ul>
                    {g.sort((a, b) => (a.event_number ?? 0) - (b.event_number ?? 0)).map((s) => {
                      const pdf = resultPdf(s.meet_id, s.event_number);
                      return (
                        <li key={s.id}>
                          <Link to={`/vyvoj?d=${s.stroke}-${s.distance}-${s.course}`} className="md">{disciplineLabel(s.distance, s.stroke)}</Link>
                          <span className="mtm">{s.status ?? fmtTime(s.swim_ms)}</span>
                          <span className="mp">{s.points ? `${s.points} b.` : ''}</span>
                          {pbIds.has(s.id) && <em className="tag pb">osobák</em>}
                          {pdf && <a className="pdf" href={pdf} target="_blank" rel="noreferrer">PDF</a>}
                        </li>
                      );
                    })}
                  </ul>
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
