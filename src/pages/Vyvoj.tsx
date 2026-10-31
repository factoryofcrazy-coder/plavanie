import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import Splits from '../components/Splits';
import { DisciplinePicker, Empty, Loader, type Disc } from '../components/ui';
import { useData } from '../lib/data';
import { courseName, disciplineKey, disciplineLabel, fmtDate, fmtDateLong, fmtGap, fmtTime, goalStroke, parseDisciplineKey, resultPdf } from '../lib/format';
import { forecast, reachDate } from '../lib/predict';

const MONTH = 30.44 * 86400_000;

export default function Vyvoj() {
  const { loading, swims, pbs, goals, athlete } = useData();
  const [params, setParams] = useSearchParams();

  const fallback = useMemo(() => {
    const top = [...pbs].sort((a, b) => b.count - a.count)[0];
    return top ? { stroke: top.stroke, distance: top.distance, course: top.course } : { stroke: 'FREE', distance: 50, course: 'SCM' };
  }, [pbs]) as Disc;
  const d: Disc = params.get('d') ? parseDisciplineKey(params.get('d')!) : fallback;
  const setD = (x: Disc) => setParams({ d: disciplineKey(x.stroke, x.distance, x.course) }, { replace: true });
  const [open, setOpen] = useState<number | null>(null);

  const available = useMemo(() => new Set(pbs.map((p) => p.key)), [pbs]);
  const list = swims.filter((s) => s.stroke === d.stroke && s.distance === d.distance && s.course === d.course);
  const valid = list.filter((s) => !s.status && s.swim_ms);
  const fc = useMemo(() => forecast(valid.map((s) => ({ date: new Date(s.race_date), ms: s.swim_ms! }))), [valid]);
  const pb = valid.reduce<number | null>((m, s) => (m == null || s.swim_ms! < m ? s.swim_ms! : m), null);
  const goal = goals.find((g) => g.stroke === goalStroke[d.stroke] && g.distance === d.distance && (g.course ?? (g.pool_length === 50 ? 'LCM' : 'SCM')) === d.course);

  const now = Date.now();
  const chart = useMemo(() => {
    const pts: any[] = valid.map((s) => ({ t: new Date(s.race_date).getTime(), ms: s.swim_ms }));
    let best = Infinity;
    pts.forEach((p) => { best = Math.min(best, p.ms); p.pb = best; });
    if (fc.ok) {
      const last = pts[pts.length - 1].t;
      for (let m = 0; m <= 12; m++) {
        const t = Math.max(last, now) + m * MONTH;
        const f = fc.at(new Date(t));
        pts.push({ t, f: Math.round(f.ms), band: [Math.round(f.lo), Math.round(f.hi)] });
      }
      // napojenie predikcie na posledný bod
      pts.push({ t: last, f: pts.find((p) => p.t === last)?.ms });
      pts.sort((a, b) => a.t - b.t);
    }
    return pts;
  }, [valid, fc, now]);

  if (loading) return <div className="wrap"><Loader /></div>;
  if (!athlete) return <div className="wrap"><Empty title="Zatiaľ tu nie sú žiadne výsledky" /></div>;

  const horizons = [3, 6, 12].map((m) => ({ m, f: fc.ok ? fc.at(new Date(now + m * MONTH)) : null }));
  const reach = goal && fc.ok ? reachDate(fc, goal.target_ms) : null;

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Vývoj a predikcie</h1>
        <p className="lede">Ako sa časy menia v čase a kam smerujú. Predikcia vychádza z výsledkov za posledné tri roky, novšie preteky majú väčšiu váhu.</p>
      </header>

      <DisciplinePicker value={d} onChange={setD} available={available} />

      {valid.length === 0 ? (
        <Empty title={`${disciplineLabel(d.distance, d.stroke)} v ${courseName[d.course]} ešte nebola plávaná`}>
          <p>Vyber inú disciplínu. Tie, ktoré už má zaplávané, sú zvýraznené.</p>
        </Empty>
      ) : (
        <>
          <section className="forecast-grid">
            <div className="stat big">
              <span className="stat-k">Osobný rekord</span>
              <span className="stat-v">{fmtTime(pb)}</span>
              <span className="stat-s">{valid.length} {valid.length === 1 ? 'štart' : valid.length < 5 ? 'štarty' : 'štartov'}</span>
            </div>
            {horizons.map(({ m, f }) => (
              <div className="stat" key={m}>
                <span className="stat-k">O {m} mesiac{m === 3 ? 'e' : 'ov'}</span>
                <span className="stat-v">{f ? fmtTime(f.ms) : '–'}</span>
                <span className="stat-s">{f ? `${fmtTime(f.lo)} až ${fmtTime(f.hi)}` : fc.reason}</span>
              </div>
            ))}
            <div className="stat">
              <span className="stat-k">Tempo zlepšovania</span>
              <span className="stat-v">{fc.ok ? `${(-fc.slopePerYear * 100).toFixed(1).replace('.', ',')} %` : '–'}</span>
              <span className="stat-s">{fc.ok ? 'za rok podľa trendu' : 'málo dát'}</span>
            </div>
            {goal && (
              <div className="stat goal">
                <span className="stat-k">Cieľ {goal.label ? `(${goal.label})` : ''}</span>
                <span className="stat-v">{fmtTime(goal.target_ms)}</span>
                <span className="stat-s">
                  {pb && pb <= goal.target_ms ? 'Splnené' : reach ? `Podľa trendu okolo ${fmtDateLong(reach)}` : `Chýba ${fmtGap(pb! - goal.target_ms).replace('+', '')}`}
                </span>
              </div>
            )}
          </section>

          <section className="chart-card">
            <div className="chart-legend">
              <span className="lg dot">výsledky</span>
              <span className="lg line">osobný rekord</span>
              {fc.ok && <span className="lg dash">predikcia s pásmom 80 %</span>}
              {goal && <span className="lg goal">cieľ</span>}
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chart} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="bandg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#39d5db" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#39d5db" stopOpacity="0.06" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(6,27,42,.08)" vertical={false} />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => new Date(t).toLocaleDateString('sk-SK', { month: 'numeric', year: '2-digit' })} stroke="#4a5d6b" tickLine={false} fontSize={12} />
                <YAxis reversed domain={['auto', 'auto']} tickFormatter={(v) => fmtTime(v)} stroke="#4a5d6b" tickLine={false} axisLine={false} width={56} fontSize={12} />
                <Tooltip
                  contentStyle={{ borderRadius: 2, border: '1px solid rgba(6,27,42,.2)', fontFamily: 'var(--body)', background: '#fbfaf7' }}
                  labelFormatter={(t) => fmtDate(new Date(t as number).toISOString())}
                  formatter={(v: any, n: any) => [Array.isArray(v) ? `${fmtTime(v[0])} až ${fmtTime(v[1])}` : fmtTime(v), n === 'ms' ? 'čas' : n === 'pb' ? 'rekord' : n === 'f' ? 'predikcia' : 'pásmo']}
                />
                {fc.ok && <Area dataKey="band" stroke="none" fill="url(#bandg)" isAnimationActive animationDuration={900} connectNulls />}
                <Line dataKey="pb" type="stepAfter" stroke="#061b2a" strokeWidth={2} dot={false} connectNulls isAnimationActive animationDuration={1100} />
                {fc.ok && <Line dataKey="f" stroke="#0b858b" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls animationBegin={600} />}
                <Scatter dataKey="ms" fill="#061b2a" stroke="#fbfaf7" strokeWidth={2} />
                {goal && <ReferenceLine y={goal.target_ms} stroke="#e0563f" strokeDasharray="3 4" strokeWidth={1.5} />}
                <ReferenceLine x={now} stroke="#4a5d6b" strokeOpacity={0.3} strokeDasharray="2 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </section>

          <Splits list={list} stroke={d.stroke} distance={d.distance} course={d.course} birthYear={athlete.birth_year ?? 2013} />

          <section className="block">
            <h2>Všetky štarty</h2>
            <ol className="swim-list">
              {[...list].reverse().map((s) => (
                <li key={s.id} className={s.swim_ms === pb ? 'is-pb' : ''}>
                  <button className="swim-row" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id} disabled={!s.splits}>
                    <span className="sd">{fmtDate(s.race_date)}</span>
                    <span className="sm">{s.meets?.name ?? s.competition ?? 'Preteky'}{s.swim_ms === pb && <em className="tag pb">osobák</em>}</span>
                    <span className="stime">{s.status ?? fmtTime(s.swim_ms)}</span>
                    <span className="sp">{s.points ? `${s.points} b.` : ''}</span>
                  </button>
                  {resultPdf(s.meet_id, s.event_number) ? (
                    <a className="pdf" href={resultPdf(s.meet_id, s.event_number)!} target="_blank" rel="noreferrer">PDF</a>
                  ) : (
                    <span className="pdf off" aria-hidden="true" />
                  )}
                  {open === s.id && s.splits && (
                    <div className="splits">
                      {s.splits.map((sp, i) => (
                        <span key={sp.d}>
                          <small>{sp.d} m</small> {fmtTime(sp.ms)}
                          {i > 0 && <small className="lap"> ({fmtTime(sp.ms - s.splits![i - 1].ms)})</small>}
                        </span>
                      ))}
                      {s.reaction_ms != null && <span><small>reakcia</small> {(s.reaction_ms / 1000).toFixed(2).replace('.', ',')} s</span>}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
