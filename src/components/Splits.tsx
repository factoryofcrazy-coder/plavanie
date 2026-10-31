import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import type { Swim } from '../lib/data';
import { fmtDate, fmtGap, fmtTime, type Course, type Stroke } from '../lib/format';

type Sp = { d: number; ms: number }[];
/** Kumulatívne medzičasy -> úseky (posledný úsek dopočíta z cieľového času) */
export function laps(splits: Sp | null, total: number | null, step: number, distance: number) {
  if (!splits?.length || !total) return null;
  const cum = [...splits.filter((s) => s.d % step === 0 && s.d < distance && s.ms < total), { d: distance, ms: total }]
    .sort((a, b) => a.d - b.d);
  const out: { d: number; ms: number }[] = [];
  let prev = { d: 0, ms: 0 };
  for (const c of cum) {
    if (c.d - prev.d !== step) return null; // chýba medzičas
    out.push({ d: c.d, ms: c.ms - prev.ms });
    prev = c;
  }
  return out;
}

interface Rival { swim_ms: number; splits: Sp; race_date: string; athletes: { first_name: string; last_name: string } }

/** Rozbor medzičasov: úseky, rozloženie síl a porovnanie s najrýchlejšou rovesníčkou */
export default function Splits({ list, stroke, distance, course, birthYear }: { list: Swim[]; stroke: Stroke; distance: number; course: Course; birthYear: number }) {
  const step = distance >= 400 ? 100 : 50;
  const withSplits = useMemo(
    () => list.filter((s) => !s.status && s.swim_ms && laps(s.splits, s.swim_ms, step, distance)).sort((a, b) => a.swim_ms! - b.swim_ms!),
    [list, step, distance],
  );
  const best = withSplits[0];
  const [rival, setRival] = useState<Rival | null>(null);

  useEffect(() => {
    setRival(null);
    if (!best) return;
    supabase
      .from('swims')
      .select('swim_ms,splits,race_date,athletes!inner(first_name,last_name,birth_year,gender,nation)')
      .eq('stroke', stroke).eq('distance', distance).eq('course', course)
      .eq('athletes.birth_year', birthYear).eq('athletes.gender', 'F').eq('athletes.nation', 'SVK')
      .is('status', null).not('splits', 'is', null).neq('athlete_id', best.athlete_id)
      .order('swim_ms').limit(1)
      .then(({ data }) => {
        const r = (data ?? [])[0] as unknown as Rival | undefined;
        if (r && r.swim_ms < best.swim_ms! && laps(r.splits, r.swim_ms, step, distance)) setRival(r);
      });
  }, [best?.id, stroke, distance, course, birthYear, step]);

  if (distance < 100 || !best) return null;
  const mine = laps(best.splits, best.swim_ms, step, distance)!;
  const theirs = rival ? laps(rival.splits, rival.swim_ms, step, distance) : null;
  const half = mine.length / 2;
  const h1 = mine.slice(0, Math.floor(half)).reduce((a, b) => a + b.ms, 0);
  const h2 = mine.slice(Math.ceil(half)).reduce((a, b) => a + b.ms, 0);
  const drop = h2 - h1;
  const max = Math.max(...mine.map((l) => l.ms), ...(theirs ?? []).map((l) => l.ms));
  const min = Math.min(...mine.map((l) => l.ms), ...(theirs ?? []).map((l) => l.ms));
  const w = (ms: number) => 35 + ((ms - min) / (max - min || 1)) * 65;

  // priemer rozdielov druhej a prvej polovice vo všetkých pretekoch s medzičasmi
  const drops = withSplits.map((s) => {
    const l = laps(s.splits, s.swim_ms, step, distance)!;
    const h = l.length / 2;
    return l.slice(Math.ceil(h)).reduce((a, b) => a + b.ms, 0) - l.slice(0, Math.floor(h)).reduce((a, b) => a + b.ms, 0);
  });
  const avgDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
  const verdict = mine.length < 2 ? '' : drop < 0 ? 'Negatívny split – druhú polovicu plávala rýchlejšie.' :
    drop / best.swim_ms! < 0.04 ? 'Rovnomerne rozložené sily.' : 'Výrazne rýchlejší začiatok, v druhej polovici stráca.';

  return (
    <section className="block splits-a">
      <h2>Rozbor medzičasov</h2>
      <p className="lede-s">
        Najlepšie preteky s medzičasmi: <b>{fmtTime(best.swim_ms)}</b>, {fmtDate(best.race_date)}. {verdict}
        {withSplits.length > 1 && ` Priemerne v ${withSplits.length} pretekoch: 2. polovica ${fmtGap(Math.round(avgDrop))} oproti 1.`}
      </p>
      <div className="laps" role="table" aria-label="Úseky">
        <div className="lap-row lap-head" role="row">
          <span role="columnheader">Úsek</span>
          <span role="columnheader">Kristínka</span>
          {theirs && <span role="columnheader">{rival!.athletes.first_name} {rival!.athletes.last_name}</span>}
        </div>
        {mine.map((l, i) => (
          <div className="lap-row" role="row" key={l.d}>
            <span role="cell" className="lap-d">{l.d - step}–{l.d} m</span>
            <span role="cell" className="lap-v">
              <motion.i className="lap-bar me" initial={{ width: 0 }} animate={{ width: `${w(l.ms)}%` }} transition={{ duration: 0.8, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
              <b>{fmtTime(l.ms)}</b>
            </span>
            {theirs && (
              <span role="cell" className="lap-v">
                <motion.i className="lap-bar" initial={{ width: 0 }} animate={{ width: `${w(theirs[i]?.ms ?? 0)}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
                <b>{fmtTime(theirs[i]?.ms)}</b>
                {theirs[i] && <small className={l.ms - theirs[i].ms > 0 ? 'neg' : 'pos'}>{fmtGap(l.ms - theirs[i].ms)}</small>}
              </span>
            )}
          </div>
        ))}
      </div>
      {mine.length >= 2 && (
        <p className="note">
          1. polovica {fmtTime(h1)}, 2. polovica {fmtTime(h2)} ({fmtGap(drop)}).
          {theirs && ` Porovnanie s najrýchlejšou slovenskou rovesníčkou (ročník ${birthYear}) s medzičasmi, ${fmtTime(rival!.swim_ms)} z ${fmtDate(rival!.race_date)}. Rozdiel pri jej úseku = o koľko je Kristínka pomalšia (+) alebo rýchlejšia (−).`}
        </p>
      )}
    </section>
  );
}
