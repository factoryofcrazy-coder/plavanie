import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import WaterCanvas from '../components/WaterCanvas';
import { CountUp, Empty, LaneRope, Loader } from '../components/ui';
import { groupByMeet, meetCity, meetTitle, useData, type PB, type Swim } from '../lib/data';
import { courseName, disciplineLabel, fmtDate, fmtTime, plural, resultPdf, seasonOf, STROKES, strokeName, type Course } from '../lib/format';

function Spark({ history, best }: { history: Swim[]; best: number }) {
  const pts = history.filter((h) => h.swim_ms).slice(-10);
  if (pts.length < 2) return <span className="spark" aria-hidden="true" />;
  const ys = pts.map((p) => p.swim_ms!);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const y = (v: number) => 3 + ((v - min) / span) * 18;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 100},${y(p.swim_ms!)}`).join(' ');
  const bi = ys.lastIndexOf(best);
  return (
    <svg className="spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
      {bi >= 0 && <circle cx={(bi / (pts.length - 1)) * 100} cy={y(best)} r="2.4" />}
    </svg>
  );
}

const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function Prehlad() {
  const { loading, athlete, displayName, swims, pbs } = useData();
  const [course, setCourse] = useState<Course>('SCM');

  const valid = swims.filter((s) => !s.status && s.swim_ms);
  const meets = useMemo(() => groupByMeet(swims), [swims]);
  const season = seasonOf();
  const pbsThisSeason = pbs.filter((p) => p.best.race_date >= season.from).length;
  const bestPoints = valid.reduce<Swim | null>((b, s) => ((s.points ?? 0) > (b?.points ?? 0) ? s : b), null);

  const shown = pbs.filter((p) => p.course === course);
  const byStroke = STROKES.map((st) => ({ st, items: shown.filter((p) => p.stroke === st) })).filter((g) => g.items.length);
  const hasLCM = pbs.some((p) => p.course === 'LCM');
  const recent = meets.slice(0, 3);
  const pbIds = new Set(pbs.map((p) => p.best.id));
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
            {athlete?.club ?? 'Triatlon team Dolný Kubín'}, ročník {athlete?.birth_year ?? 2013}
          </p>
          {athlete && (
            <motion.dl className="hero-stats" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.9 } } }}>
              {[
                { k: plural(valid.length, 'štart', 'štarty', 'štartov'), v: valid.length },
                { k: plural(meets.length, 'preteky', 'preteky', 'pretekov'), v: meets.length },
                { k: `osobákov v sezóne ${season.label}`, v: pbsThisSeason },
                { k: bestPoints ? `najviac bodov (${bestPoints.distance} m ${strokeName[bestPoints.stroke]})` : 'najviac bodov', v: bestPoints?.points ?? 0 },
              ].map((s) => (
                <motion.div key={s.k} variants={fade}>
                  <dt>{s.k}</dt>
                  <dd><CountUp value={s.v} /></dd>
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
            <p>Výsledky sa nahrávajú automaticky z pretekov SPF. Ručne ich vieš pridať v <Link to="/admin">Správe</Link>.</p>
          </Empty>
        ) : (
          <>
            <section className="block">
              <div className="block-head">
                <h2>Osobné rekordy</h2>
                <div className="seg" role="radiogroup" aria-label="Bazén">
                  {(['SCM', 'LCM'] as Course[]).map((c) => (
                    <button key={c} role="radio" aria-checked={course === c} className={course === c ? 'on' : ''} disabled={c === 'LCM' && !hasLCM} onClick={() => setCourse(c)}>
                      {courseName[c]}
                    </button>
                  ))}
                </div>
              </div>
              <motion.div key={course} className="pb-grid" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
                {byStroke.map(({ st, items }) => (
                  <motion.section key={st} className={`pb-group st-${st.toLowerCase()}`} variants={fade}>
                    <h3>{strokeName[st]}</h3>
                    <ul>
                      {items.map((p: PB) => {
                        const pdf = resultPdf(p.best.meet_id, p.best.event_number);
                        const fresh = Date.now() - new Date(p.best.race_date).getTime() < 45 * 86400_000;
                        return (
                          <li key={p.key}>
                            <Link to={`/vyvoj?d=${p.key}`} className="pb-row" title={`${meetTitle(p.best)}, ${fmtDate(p.best.race_date)}`}>
                              <span className="pb-dist">{p.distance} m</span>
                              <Spark history={p.history} best={p.best.swim_ms!} />
                              <span className="pb-time">{fmtTime(p.best.swim_ms)}</span>
                              <span className="pb-meta">
                                {fmtDate(p.best.race_date)}
                                {fresh && <em className="tag new">nový</em>}
                              </span>
                            </Link>
                            {pdf ? (
                              <a className="pdf mini" href={pdf} target="_blank" rel="noreferrer" aria-label={`Výsledková listina, ${disciplineLabel(p.distance, p.stroke)}`}>PDF</a>
                            ) : (
                              <span className="pdf mini off" aria-hidden="true" />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </motion.section>
                ))}
              </motion.div>
              <p className="muted small hint">Ťukni na disciplínu a uvidíš vývoj časov a predikciu.</p>
            </section>

            <LaneRope />

            <section className="block">
              <div className="block-head">
                <h2>Posledné preteky</h2>
                <Link to="/preteky" className="btn ghost small">Všetky preteky</Link>
              </div>
              <div className="recent">
                {recent.map((group) => {
                  const s0 = group.find((x) => x.meet_id) ?? group[0];
                  const city = meetCity(s0);
                  const nPb = group.filter((s) => pbIds.has(s.id)).length;
                  return (
                    <article key={s0.id} className="meet-card">
                      <header>
                        <h3>{meetTitle(s0)}</h3>
                        <p className="muted">
                          {[city, fmtDate(s0.race_date), courseName[s0.course]].filter(Boolean).join(', ')}
                        </p>
                        {nPb > 0 && <span className="tag pb">{nPb} {plural(nPb, 'osobák', 'osobáky', 'osobákov')}</span>}
                      </header>
                      <ul>
                        {group.map((s) => (
                          <li key={s.id}>
                            <span>{disciplineLabel(s.distance, s.stroke)}</span>
                            <span className="t">{s.status ?? fmtTime(s.swim_ms)}</span>
                            <span className={`pbmark${pbIds.has(s.id) ? ' on' : ''}`} aria-label={pbIds.has(s.id) ? 'osobný rekord' : undefined} />
                          </li>
                        ))}
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
