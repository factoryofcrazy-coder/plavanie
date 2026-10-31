import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import WaterCanvas from '../components/WaterCanvas';
import { CountUp, Empty, LaneRope, Loader } from '../components/ui';
import { useData, type PB, type Swim } from '../lib/data';
import { courseName, disciplineLabel, fmtDate, fmtTime, plural, resultPdf, type Course } from '../lib/format';

function Spark({ history, best }: { history: Swim[]; best: number }) {
  const pts = history.filter((h) => h.swim_ms).slice(-12);
  if (pts.length < 2) return <svg className="spark" viewBox="0 0 100 28" aria-hidden="true" />;
  const ys = pts.map((p) => p.swim_ms!);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const d = pts
    .map((p, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 100},${4 + ((p.swim_ms! - min) / span) * 20}`)
    .join(' ');
  const bi = ys.lastIndexOf(best);
  return (
    <svg className="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
      {bi >= 0 && <circle cx={(bi / (pts.length - 1)) * 100} cy={4 + ((best - min) / span) * 20} r="2.6" />}
    </svg>
  );
}

export default function Prehlad() {
  const { loading, athlete, displayName, swims, pbs } = useData();
  const [course, setCourse] = useState<Course>('SCM');

  const valid = swims.filter((s) => !s.status && s.swim_ms);
  const meetsCount = new Set(swims.map((s) => s.meet_id ?? s.competition)).size;
  const bestPoints = valid.reduce<Swim | null>((b, s) => ((s.points ?? 0) > (b?.points ?? 0) ? s : b), null);
  const thisYear = new Date().getFullYear();
  const pbsThisYear = pbs.filter((p) => p.best.race_date.startsWith(String(thisYear))).length;

  const shown = pbs.filter((p) => p.course === course);
  const hasLCM = pbs.some((p) => p.course === 'LCM');
  const hasSCM = pbs.some((p) => p.course === 'SCM');

  // posledné preteky
  const recent = useMemo(() => {
    const by = new Map<string, Swim[]>();
    for (const s of [...swims].reverse()) {
      const k = String(s.meet_id ?? s.competition ?? s.race_date);
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push(s);
    }
    return [...by.values()].slice(0, 3);
  }, [swims]);

  const [first, ...rest] = displayName.split(' ');

  return (
    <>
      <section className="hero">
        <WaterCanvas className="hero-water" />
        <div className="hero-inner">
          <h1 className="hero-name" aria-label={displayName}>
            <span className="n1">{first}</span>
            <span className="n2">{rest.join(' ')}</span>
          </h1>
          <p className="hero-sub">
            {athlete ? (
              <>Plávanie za {athlete.club ?? 'TT Dolný Kubín'}, ročník {athlete.birth_year ?? 2013}</>
            ) : (
              <>Plávanie za TT Dolný Kubín</>
            )}
          </p>
          {athlete && (
            <motion.dl className="hero-stats" initial="h" animate="v" variants={{ v: { transition: { staggerChildren: 0.08, delayChildren: 0.9 } } }}>
              {[
                { k: 'štartov', v: valid.length, f: (n: number) => String(Math.round(n)) },
                { k: plural(meetsCount, 'preteky', 'preteky', 'pretekov'), v: meetsCount, f: (n: number) => String(Math.round(n)) },
                { k: `osobných rekordov v ${thisYear}`, v: pbsThisYear, f: (n: number) => String(Math.round(n)) },
                { k: bestPoints ? `bodov za ${disciplineLabel(bestPoints.distance, bestPoints.stroke)}` : 'bodov', v: bestPoints?.points ?? 0, f: (n: number) => String(Math.round(n)) },
              ].map((s) => (
                <motion.div key={s.k} variants={{ h: { opacity: 0, y: 12 }, v: { opacity: 1, y: 0 } }}>
                  <dt>{s.k}</dt>
                  <dd><CountUp value={s.v} format={s.f} /></dd>
                </motion.div>
              ))}
            </motion.dl>
          )}
        </div>
        <svg className="hero-edge" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 30 C 240 0 480 60 720 30 S 1200 0 1440 30 V60 H0z" />
        </svg>
      </section>

      <div className="wrap">
        {loading ? (
          <Loader />
        ) : !athlete ? (
          <Empty title="Zatiaľ tu nie sú žiadne výsledky">
            <p>Výsledky sa nahrávajú z oficiálnych výsledkov SPF. Po prihlásení ich vieš pridať v časti <Link to="/admin">Správa</Link>.</p>
          </Empty>
        ) : (
          <>
            <section className="block">
              <div className="block-head">
                <h2>Osobné rekordy</h2>
                <div className="seg" role="radiogroup" aria-label="Bazén">
                  {(['SCM', 'LCM'] as Course[]).map((c) => (
                    <button key={c} role="radio" aria-checked={course === c} className={course === c ? 'on' : ''} disabled={c === 'LCM' ? !hasLCM : !hasSCM} onClick={() => setCourse(c)}>
                      {courseName[c]}
                    </button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? (
                <p className="muted">V {courseName[course]} zatiaľ nie sú výsledky.</p>
              ) : (
                <ol className="pb-list">
                  {shown.map((p: PB, i) => {
                    const pdf = resultPdf(p.best.meet_id, p.best.event_number);
                    const fresh = Date.now() - new Date(p.best.race_date).getTime() < 45 * 86400_000;
                    return (
                      <motion.li key={p.key} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.4 }}>
                        <Link to={`/vyvoj?d=${p.key}`} className="pb-row">
                          <span className="pb-disc">
                            <strong>{p.distance} m</strong> {disciplineLabel(p.distance, p.stroke).replace(`${p.distance} m `, '')}
                          </span>
                          <Spark history={p.history} best={p.best.swim_ms!} />
                          <span className="pb-time">{fmtTime(p.best.swim_ms)}</span>
                          <span className="pb-meta">
                            {fmtDate(p.best.race_date)}
                            {p.best.points ? <>, {p.best.points} b.</> : null}
                            {fresh && <em className="tag new">nový</em>}
                          </span>
                        </Link>
                        {pdf && (
                          <a className="pdf" href={pdf} target="_blank" rel="noreferrer" aria-label={`Výsledková listina ${disciplineLabel(p.distance, p.stroke)}`}>
                            PDF
                          </a>
                        )}
                      </motion.li>
                    );
                  })}
                </ol>
              )}
            </section>

            <LaneRope />

            <section className="block">
              <div className="block-head">
                <h2>Posledné preteky</h2>
                <Link to="/preteky" className="btn ghost small">Všetky preteky</Link>
              </div>
              <div className="recent">
                {recent.map((group) => {
                  const s0 = group[0];
                  return (
                    <article key={s0.id} className="meet-card">
                      <h3>{s0.meets?.name ?? s0.competition ?? 'Preteky'}</h3>
                      <p className="muted">
                        {s0.meets?.city ? `${s0.meets.city}, ` : ''}
                        {fmtDate(s0.race_date)}, {courseName[s0.course]}
                      </p>
                      <ul>
                        {group.map((s) => {
                          const pb = pbs.find((p) => p.best.id === s.id);
                          return (
                            <li key={s.id}>
                              <span>{disciplineLabel(s.distance, s.stroke)}</span>
                              <span className="t">{s.status ?? fmtTime(s.swim_ms)}</span>
                              {pb && <em className="tag pb">osobák</em>}
                            </li>
                          );
                        })}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
