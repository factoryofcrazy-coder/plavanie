import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fmtGap, fmtTime, strokeName, type Stroke } from '../lib/format';
import { useData } from '../lib/data';

interface Neighbor { lane: number | null; name: string; club: string | null; entry_ms: number | null; year: number | null; me?: boolean }
interface Entry { event: number; title: string; date: string | null; time: string | null; stroke: Stroke | null; distance: number | null; entry_ms: number | null; heat: number | null; heats: number | null; lane: number | null; neighbors: Neighbor[]; pdf: string | null }
interface Meet { id: number; name: string; date: string | null; city: string | null; pool: string | null; status: string; source: string; startlists: number; entries: Entry[] }

const nice = (n: string) => n.replace(/\s+/g, ' ').trim();

/** Najbližšie preteky: kde a kedy pláva, rozplavba, dráha a súperky vedľa nej */
export default function NextMeets() {
  const { pbs } = useData();
  const [meets, setMeets] = useState<Meet[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/next')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMeets(j?.meets ?? []))
      .catch(() => setMeets([]));
  }, []);

  const mine = (meets ?? []).filter((m) => m.entries.length);
  if (!meets) return null;
  if (!mine.length) {
    const soon = meets.filter((m) => m.status === 'upcoming').slice(0, 3);
    if (!soon.length) return null;
    return (
      <section className="section next" aria-labelledby="next-h">
        <header className="section-head">
          <div><p className="eyebrow">Najbližšie preteky</p><h2 id="next-h">Čo príde</h2></div>
        </header>
        <ul className="next-soon">
          {soon.map((m) => (
            <li key={m.id}>
              <b>{m.date}</b> <span>{nice(m.name)}</span> <small>{m.city}{m.pool ? ` · ${m.pool} m` : ''}</small>
            </li>
          ))}
        </ul>
        <p className="note">Keď organizátor zverejní štartovú listinu, uvidíš tu jej disciplíny, rozplavbu a dráhu.</p>
      </section>
    );
  }

  return (
    <section className="section next" aria-labelledby="next-h">
      <header className="section-head">
        <div><p className="eyebrow">Zo štartovej listiny</p><h2 id="next-h">Najbližšie štarty</h2></div>
      </header>
      {mine.map((m) => (
        <article key={m.id} className="next-meet">
          <h3>{nice(m.name)}</h3>
          <p className="tl-meta">{[m.date, m.city, m.pool && `${m.pool} m bazén`].filter(Boolean).join(' · ')}</p>
          <ol className="next-list">
            {m.entries.map((e, i) => {
              const k = `${m.id}-${e.event}`;
              const course = m.pool === '50' ? 'LCM' : 'SCM';
              const pb = pbs.find((p) => p.stroke === e.stroke && p.distance === e.distance && p.course === course);
              return (
                <motion.li key={k} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <button className="next-row" onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k}>
                    <span className="nx-ev">Disc. {e.event}</span>
                    <span className="nx-d">{e.distance && e.stroke ? `${e.distance} m ${strokeName[e.stroke]}` : nice(e.title)}</span>
                    <span className="nx-hl">
                      {e.heat ? <>rozpl. <b>{e.heat}</b>{e.heats ? `/${e.heats}` : ''}</> : null}
                      {e.lane ? <> · dráha <b>{e.lane}</b></> : null}
                    </span>
                    <span className="nx-t">{e.entry_ms ? fmtTime(e.entry_ms) : 'NT'}{e.time && <small>{e.time}</small>}</span>
                  </button>
                  {open === k && (
                    <div className="next-heat">
                      {pb && e.entry_ms && pb.best.swim_ms! < e.entry_ms && (
                        <p className="note">Prihlásený čas je pomalší ako osobák {fmtTime(pb.best.swim_ms)} ({fmtGap(e.entry_ms - pb.best.swim_ms!)}).</p>
                      )}
                      {e.neighbors.length > 0 ? (
                        <ol className="lanes">
                          {e.neighbors.map((n) => (
                            <li key={`${n.lane}-${n.name}`} className={n.me ? 'me' : ''}>
                              <span className="ln">{n.lane ?? '–'}</span>
                              <span className="nm">{n.name}{n.year ? <small> {n.year}</small> : null}<small className="cl">{n.club}</small></span>
                              <span className="et">{n.entry_ms ? fmtTime(n.entry_ms) : 'NT'}</span>
                            </li>
                          ))}
                        </ol>
                      ) : <p className="note">Rozplavby ešte nie sú nasadené.</p>}
                      {e.pdf && <a className="text-link" href={e.pdf} target="_blank" rel="noreferrer">Štartová listina (PDF)</a>}
                    </div>
                  )}
                </motion.li>
              );
            })}
          </ol>
        </article>
      ))}
    </section>
  );
}
