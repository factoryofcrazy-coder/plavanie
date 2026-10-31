import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useData } from '../lib/data';
import { courseShort, disciplineKey, fmtGap, fmtTime, strokeName, STROKES, type Course, type Stroke } from '../lib/format';

interface Limit { stroke: Stroke; distance: number; course: Course; age: number; limit_ms: number; name: string; season: string; qual_from: string; source: string }
interface Bench { stroke: Stroke; distance: number; course: Course; starters: number; gold: number; bronze: number; eighth: number }

/** Cesta na M SR: limity pre jej vek na najbližších majstrovstvách + čo stačilo na medailu a top 8 minulý rok */
export default function Limits() {
  const { athlete, swims } = useData();
  const [all, setAll] = useState<Limit[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [bench, setBench] = useState<Bench[]>([]);
  const [course, setCourse] = useState<Course>('LCM');

  const by = athlete?.birth_year ?? 2013;
  const now = new Date();
  // M SR žiakov sú v júni – po júni sa už pozeráme na budúci rok
  const champYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const age = champYear - by;

  useEffect(() => {
    (async () => {
      const { data: l } = await supabase.from('limits').select('*').eq('gender', athlete?.gender ?? 'F').eq('age', age).order('season', { ascending: false });
      // pre každý cieľ (M SR, reprezentácia…) iba najnovšie limity
      const latest = new Map<string, string>();
      for (const x of (l ?? []) as Limit[]) if (!latest.has(x.name) || x.season > latest.get(x.name)!) latest.set(x.name, x.season);
      setAll(((l ?? []) as Limit[]).filter((x) => latest.get(x.name) === x.season));
      const { data: st } = await supabase.from('settings').select('value').eq('key', 'benchmark_meets').maybeSingle();
      const meetId = parseInt(String(st?.value ?? '').split(',')[0], 10);
      if (meetId) {
        // súperky, ktoré mali na minulých M SR rovnaký vek, aký bude mať ona
        const { data: b } = await supabase.rpc('meet_benchmarks', { p_meet_id: meetId, p_birth_year: by - 1, p_gender: athlete?.gender ?? 'F' });
        setBench((b ?? []) as Bench[]);
      }
    })();
  }, [age, by, athlete?.gender]);

  const targets = useMemo(() => [...new Set(all.map((l) => l.name))].sort((a, b) => (a.startsWith('M SR') ? -1 : b.startsWith('M SR') ? 1 : b.localeCompare(a))), [all]);
  const name = target && targets.includes(target) ? target : targets[0];
  const limits = all.filter((l) => l.name === name);
  const isRepre = /reprezent/i.test(name ?? '');
  const season = limits[0]?.season;
  // M SR: kvalifikácia od 1. 5. predošlého roka; reprezentácia (zaradenie k 1. 1.): výkony z tohto roka
  const qualFrom = isRepre ? `${now.getFullYear()}-01-01` : season ? `${+season}-05-01` : '';
  const rows = useMemo(() => {
    const ls = limits.filter((l) => l.course === course);
    return STROKES.flatMap((st) =>
      ls.filter((l) => l.stroke === st).sort((a, b) => a.distance - b.distance).map((l) => {
        const mine = swims.filter((s) => !s.status && s.swim_ms && s.stroke === l.stroke && s.distance === l.distance && s.course === l.course);
        const best = mine.reduce<number | null>((m, s) => (m == null || s.swim_ms! < m ? s.swim_ms! : m), null);
        const fresh = mine.filter((s) => s.race_date >= qualFrom).reduce<number | null>((m, s) => (m == null || s.swim_ms! < m ? s.swim_ms! : m), null);
        const b = bench.find((x) => x.stroke === l.stroke && x.distance === l.distance && x.course === l.course);
        return { l, best, fresh, b: isRepre ? undefined : b };
      }),
    );
  }, [limits, swims, course, bench, qualFrom, isRepre]);

  if (!limits.length) return null;
  const done = rows.filter((r) => r.fresh != null && r.fresh <= r.l.limit_ms).length;
  const hasBench = rows.some((r) => r.b);

  return (
    <section className="section limits" aria-labelledby="limits-h">
      <header className="section-head">
        <div>
          <p className="eyebrow">{isRepre ? `Reprezentácia od 1. 1. ${now.getFullYear() + 1}` : `Majstrovstvá Slovenska ${champYear}`}</p>
          <h2 id="limits-h">{isRepre ? 'Cesta do reprezentácie' : 'Cesta na M SR'}</h2>
        </div>
        <div className="tabs" role="radiogroup" aria-label="Bazén">
          {(['LCM', 'SCM'] as Course[]).map((c) => (
            <button key={c} role="radio" aria-checked={course === c} className={course === c ? 'on' : ''} onClick={() => setCourse(c)}>
              {courseShort[c]} bazén
            </button>
          ))}
        </div>
      </header>

      {targets.length > 1 && (
        <div className="seg limits-targets" role="radiogroup" aria-label="Cieľ">
          {targets.map((t) => (
            <button key={t} role="radio" aria-checked={t === name} className={t === name ? 'on' : ''} onClick={() => setTarget(t)}>
              {t.startsWith('M SR') ? `M SR ${champYear}` : t.replace('Reprezentácia – ', 'Repre ')}
            </button>
          ))}
        </div>
      )}

      <p className="limits-sum">
        <strong>{done}</strong> z {rows.length} limitov splnených pre kategóriu {age} rokov.
        <span> Rátajú sa časy od {new Date(qualFrom).toLocaleDateString('sk-SK')}.</span>
      </p>

      <div className="limits-table" role="table" aria-label="Limity">
        <div className="lt-row lt-head" role="row">
          <span role="columnheader">Disciplína</span>
          <span role="columnheader">Jej čas</span>
          <span role="columnheader">Limit</span>
          <span role="columnheader" className="lt-bar-h">Rozdiel</span>
          {hasBench && <span role="columnheader" className="lt-b">Top 8 / bronz</span>}
        </div>
        {rows.map(({ l, best, fresh, b }, i) => {
          const t = fresh ?? best;
          const gap = t != null ? t - l.limit_ms : null;
          const ok = fresh != null && fresh <= l.limit_ms;
          const stale = fresh == null && best != null;
          const pct = gap == null ? 0 : Math.max(-1, Math.min(1, gap / (l.limit_ms * 0.08)));
          return (
            <motion.div key={l.stroke + l.distance} role="row" className={`lt-row ${ok ? 'ok' : ''} ${t == null ? 'none' : ''} ${stale ? 'stale' : ''}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link role="cell" to={`/vyvoj?d=${disciplineKey(l.stroke, l.distance, l.course)}`} className="lt-d">
                {l.distance} m <small>{strokeName[l.stroke]}</small>
              </Link>
              <span role="cell" className="lt-t">
                {t != null ? fmtTime(t) : '–'}
                {stale && <small title="Čas je starší ako začiatok kvalifikácie">pred kvalifikáciou</small>}
              </span>
              <span role="cell" className="lt-l">{fmtTime(l.limit_ms)}</span>
              <span role="cell" className="lt-bar" aria-label={gap == null ? 'nezaplávané' : ok ? 'splnené' : `chýba ${fmtGap(gap)}`}>
                {gap == null ? <em>nezaplávané</em> : (
                  <>
                    <i className="lt-track"><b style={{ ['--p' as any]: pct }} /></i>
                    <em className={fresh == null ? 'old' : ''}>{ok ? 'splnené' : fresh == null ? (gap <= 0 ? 'zopakovať' : fmtGap(gap)) : fmtGap(gap)}</em>
                  </>
                )}
              </span>
              {hasBench && (
                <span role="cell" className="lt-b">
                  {b ? <>{fmtTime(b.eighth)} <small>/</small> {fmtTime(b.bronze)}</> : '–'}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
      <p className="note">
        {isRepre
          ? `Limity: ${limits[0].source} (${age}-ročné). Tím MJ-B je širšia reprezentácia mladších junioriek, Tím MJ-A užšia. O zaradení rozhoduje manažér reprezentácie a Rada SPF.`
          : `Limity: ${limits[0].source}. Kým SPF nezverejní limity na ${champYear}, sú tu limity z roku ${season} pre ${age}-ročné.`}
        {!isRepre && hasBench && ` Top 8 a bronz: slovenské dievčatá ročníka ${by - 1} na M SR ${season} (50 m bazén).`}
      </p>
    </section>
  );
}
