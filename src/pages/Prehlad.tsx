import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import PoolVisual from '../components/PoolVisual';
import { CountUp, Empty, Loader } from '../components/ui';
import { groupByMeet, meetCity, meetTitle, useData, type PB, type Swim } from '../lib/data';
import { courseShort, disciplineLabel, fmtDate, fmtTime, plural, resultPdf, seasonOf, STROKES, strokeName, type Course } from '../lib/format';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];

function Spark({ history, best }: { history: Swim[]; best: number }) {
  const pts = history.filter((h) => h.swim_ms).slice(-10);
  if (pts.length < 2) return <span className="spark" aria-hidden="true" />;
  const ys = pts.map((p) => p.swim_ms!);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const y = (v: number) => 2 + ((v - min) / span) * 16;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 100},${y(p.swim_ms!)}`).join(' ');
  const bi = ys.lastIndexOf(best);
  return (
    <svg className="spark" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
      {bi >= 0 && <circle cx={(bi / (pts.length - 1)) * 100} cy={y(best)} r="2.2" />}
    </svg>
  );
}

const rise: Variants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } } };

export default function Prehlad() {
  const { loading, athlete, displayName, heroPhoto, swims, pbs } = useData();
  const [course, setCourse] = useState<Course>('SCM');

  const valid = swims.filter((s) => !s.status && s.swim_ms);
  const meets = useMemo(() => groupByMeet(swims), [swims]);
  const season = seasonOf();
  const year = new Date().getFullYear();
  const pbsYear = pbs.filter((p) => p.best.race_date.startsWith(String(year))).length;
  const bestPoints = valid.reduce<Swim | null>((b, s) => ((s.points ?? 0) > (b?.points ?? 0) ? s : b), null);
  const sprint = pbs.find((p) => p.stroke === 'FREE' && p.distance === 50 && p.course === 'SCM') ?? pbs[0];

  const shown = pbs.filter((p) => p.course === course);
  const byStroke = STROKES.map((st) => ({ st, items: shown.filter((p) => p.stroke === st) })).filter((g) => g.items.length);
  const hasLCM = pbs.some((p) => p.course === 'LCM');
  const pbIds = new Set(pbs.map((p) => p.best.id));
  const [first, ...rest] = displayName.split(' ');

  const stats = [
    { v: valid.length, k: plural(valid.length, 'štart', 'štarty', 'štartov') },
    { v: meets.length, k: plural(meets.length, 'preteky', 'preteky', 'pretekov') },
    { v: pbsYear, k: `osobných rekordov v ${year}` },
    { v: bestPoints?.points ?? 0, k: bestPoints ? `bodov za ${bestPoints.distance} m ${strokeName[bestPoints.stroke]}` : 'bodov' },
  ];

  return (
    <>
      <section className="hero" aria-labelledby="hero-name">
        <div className="hero-grid">
          <motion.div className="hero-copy" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } }}>
            <motion.p className="eyebrow light" variants={rise}>Plavkyňa / Slovensko</motion.p>
            <motion.h1 id="hero-name" className="hero-name" variants={rise}>
              <span>{first}</span>
              <span>{rest.join(' ')}</span>
            </motion.h1>
            <motion.p className="hero-sub" variants={rise}>
              {athlete?.club ?? 'Triatlon Team Dolný Kubín'} · Ročník {athlete?.birth_year ?? 2013}
            </motion.p>
            {athlete && (
              <motion.dl className="hero-stats" variants={rise}>
                {stats.map((s) => (
                  <div key={s.k}>
                    <dd><CountUp value={s.v} duration={1600} /></dd>
                    <dt>{s.k}</dt>
                  </div>
                ))}
              </motion.dl>
            )}
          </motion.div>

          <motion.figure className="hero-visual" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}>
            <PoolVisual photo={heroPhoto} />
            <span className="anno anno-lane">Dráha 4</span>
            {sprint && (
              <figcaption className="anno anno-pb">
                <span>Osobný rekord<br />{sprint.distance} m {strokeName[sprint.stroke]}, {courseShort[sprint.course]} bazén</span>
                <strong>{fmtTime(sprint.best.swim_ms)}</strong>
              </figcaption>
            )}
          </motion.figure>
        </div>
        <div className="hero-lanes" aria-hidden="true"><i /><i /><i /></div>
        <a href="#rekordy" className="scroll-cue"><span>Rekordy</span><i aria-hidden="true" /></a>
      </section>

      <div className="wrap" id="rekordy">
        {loading ? (
          <Loader />
        ) : !athlete ? (
          <Empty title="Zatiaľ tu nie sú žiadne výsledky">
            <p>Výsledky sa nahrávajú automaticky z pretekov SPF. Ručne ich vieš pridať v <Link to="/admin">Správe</Link>.</p>
          </Empty>
        ) : (
          <>
            <section className="section">
              <header className="section-head">
                <div>
                  <p className="eyebrow">Najlepšie časy</p>
                  <h2>Osobné rekordy</h2>
                </div>
                <div className="tabs" role="radiogroup" aria-label="Bazén">
                  {(['SCM', 'LCM'] as Course[]).map((c) => (
                    <button key={c} role="radio" aria-checked={course === c} className={course === c ? 'on' : ''} disabled={c === 'LCM' && !hasLCM} onClick={() => setCourse(c)}>
                      {courseShort[c]} bazén
                    </button>
                  ))}
                </div>
              </header>

              <motion.div key={course} className="pb-columns" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
                {byStroke.map(({ st, items }) => (
                  <motion.section key={st} className={`pb-col st-${st.toLowerCase()}`} variants={rise}>
                    <h3>{strokeName[st]}</h3>
                    <ol>
                      {items.map((p: PB) => {
                        const pdf = resultPdf(p.best.meet_id, p.best.event_number);
                        const fresh = Date.now() - new Date(p.best.race_date).getTime() < 45 * 86400_000;
                        return (
                          <li key={p.key}>
                            <Link to={`/vyvoj?d=${p.key}`} className="pb-line">
                              <span className="pb-dist">{p.distance}<small> m</small></span>
                              <Spark history={p.history} best={p.best.swim_ms!} />
                              <span className="pb-time">{fmtTime(p.best.swim_ms)}</span>
                              <span className="pb-meta">
                                {fresh && <em className="flag">Nový</em>}
                                {fmtDate(p.best.race_date)}
                                {p.best.points ? ` · ${p.best.points} b.` : ''}
                              </span>
                            </Link>
                            {pdf && <a className="pdf-link" href={pdf} target="_blank" rel="noreferrer" aria-label={`Výsledková listina, ${disciplineLabel(p.distance, p.stroke)}`}>PDF</a>}
                          </li>
                        );
                      })}
                    </ol>
                  </motion.section>
                ))}
              </motion.div>
              <p className="note">Kliknutím na disciplínu otvoríš vývoj časov a predikciu.</p>
            </section>

            <section className="section">
              <header className="section-head">
                <div>
                  <p className="eyebrow">Posledné štarty</p>
                  <h2>Preteky</h2>
                </div>
                <Link to="/preteky" className="text-link">Všetky preteky</Link>
              </header>
              <ol className="timeline">
                {meets.slice(0, 4).map((g) => {
                  const s0 = g.find((x) => x.meet_id) ?? g[0];
                  const d = new Date(s0.race_date);
                  const nPb = g.filter((x) => pbIds.has(x.id)).length;
                  return (
                    <li key={s0.id} className="tl-item">
                      <time className="tl-date" dateTime={s0.race_date}>
                        <b>{d.getDate()}</b>
                        <span>{MONTHS[d.getMonth()]} {d.getFullYear()}</span>
                      </time>
                      <div className="tl-body">
                        <h3>{meetTitle(s0)}</h3>
                        <p className="tl-meta">
                          {[meetCity(s0), `${courseShort[s0.course]} bazén`].filter(Boolean).join(' · ')}
                          {nPb > 0 && <em className="flag">{nPb} {plural(nPb, 'osobák', 'osobáky', 'osobákov')}</em>}
                        </p>
                        <ul className="tl-results">
                          {g.map((x) => (
                            <li key={x.id} className={pbIds.has(x.id) ? 'is-pb' : ''}>
                              <span>{disciplineLabel(x.distance, x.stroke)}</span>
                              <b>{x.status ?? fmtTime(x.swim_ms)}</b>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </>
        )}
      </div>
    </>
  );
}
