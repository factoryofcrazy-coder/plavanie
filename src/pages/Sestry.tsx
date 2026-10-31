import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DisciplinePicker, Empty, Loader, type Disc } from '../components/ui';
import { computePBs, fetchSwims, useData, type Athlete, type Swim } from '../lib/data';
import { courseShort, disciplineKey, disciplineLabel, fmtDate, fmtGap, fmtTime } from '../lib/format';
import { supabase } from '../lib/supabase';

/** Vek podľa ročníka (ako v plávaní): rok pretekov − rok narodenia */
const ageOf = (date: string, birthYear: number) => new Date(date).getFullYear() - birthYear;
/** Presnejší vek na os grafu (od 1. 1. roku narodenia) */
const ageExact = (date: string, birthYear: number) => (new Date(date).getTime() - new Date(`${birthYear}-01-01`).getTime()) / (365.25 * 86400_000);

function bestAtAge(swims: Swim[], d: Disc, birth: number, age: number) {
  return swims
    .filter((s) => !s.status && s.swim_ms && s.stroke === d.stroke && s.distance === d.distance && s.course === d.course && ageOf(s.race_date, birth) === age)
    .sort((a, b) => a.swim_ms! - b.swim_ms!)[0] ?? null;
}

export default function Sestry() {
  const { athlete: me, swims: mySwims, pbs: myPbs, loading } = useData();
  const [sister, setSister] = useState<Athlete | null>(null);
  const [sisterSwims, setSisterSwims] = useState<Swim[] | null>(null);
  const [d, setD] = useState<Disc | null>(null);

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from('settings').select('value').eq('key', 'sister_key').maybeSingle();
      if (!st?.value) return setSisterSwims([]);
      const { data: a } = await supabase.from('athletes').select('*').eq('key', st.value).maybeSingle();
      if (!a) return setSisterSwims([]);
      setSister(a as Athlete);
      setSisterSwims(await fetchSwims(a.id));
    })();
  }, []);

  const sisterPbs = useMemo(() => computePBs(sisterSwims ?? []), [sisterSwims]);
  const myBirth = me?.birth_year ?? 2013;
  const sBirth = sister?.birth_year ?? 0;
  const myAge = new Date().getFullYear() - myBirth;

  // disciplíny, ktoré plávali obe
  const common = useMemo(() => {
    const keys = new Set(sisterPbs.map((p) => p.key));
    return myPbs.filter((p) => keys.has(p.key));
  }, [myPbs, sisterPbs]);
  const disc: Disc | null = d ?? (common[0] ? { stroke: common[0].stroke, distance: common[0].distance, course: common[0].course } : null);

  // porovnanie „teraz vs. sestra v rovnakom veku" pre všetky spoločné disciplíny
  const sameAge = useMemo(() => {
    if (!sister) return [];
    return common.map((p) => {
      const dd = { stroke: p.stroke, distance: p.distance, course: p.course };
      return { p, mine: bestAtAge(mySwims, dd, myBirth, myAge), hers: bestAtAge(sisterSwims ?? [], dd, sBirth, myAge) };
    });
  }, [common, mySwims, sisterSwims, sister, myBirth, sBirth, myAge]);
  const withBoth = sameAge.filter((r) => r.mine && r.hers);
  const faster = withBoth.filter((r) => r.mine!.swim_ms! < r.hers!.swim_ms!).length;

  // vek po veku v jednej disciplíne
  const ages = useMemo(() => {
    if (!disc || !sister) return [];
    const all = new Set<number>();
    mySwims.forEach((s) => all.add(ageOf(s.race_date, myBirth)));
    (sisterSwims ?? []).forEach((s) => all.add(ageOf(s.race_date, sBirth)));
    return [...all].filter((a) => a >= 6 && a <= 25).sort((a, b) => a - b)
      .map((age) => ({ age, mine: bestAtAge(mySwims, disc, myBirth, age), hers: bestAtAge(sisterSwims ?? [], disc, sBirth, age) }))
      .filter((r) => r.mine || r.hers);
  }, [disc, mySwims, sisterSwims, sister, myBirth, sBirth]);

  // graf: čas podľa veku
  const chart = useMemo(() => {
    if (!disc || !sister) return [];
    const pick = (list: Swim[], birth: number, key: 'k' | 'n') =>
      list.filter((s) => !s.status && s.swim_ms && s.stroke === disc.stroke && s.distance === disc.distance && s.course === disc.course)
        .map((s) => ({ x: +ageExact(s.race_date, birth).toFixed(3), [key]: s.swim_ms, date: s.race_date }));
    return [...pick(mySwims, myBirth, 'k'), ...pick(sisterSwims ?? [], sBirth, 'n')].sort((a, b) => a.x - b.x);
  }, [disc, mySwims, sisterSwims, sister, myBirth, sBirth]);

  if (loading || sisterSwims === null) return <div className="wrap"><Loader /></div>;

  const sName = sister?.first_name ?? 'Nina';

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Sestry</h1>
        <p className="lede">
          {me?.first_name ?? 'Kristínka'} a {sName} v rovnakom veku. Porovnávame časy podľa ročníka, teda {me?.first_name ?? 'Kristínka'} teraz
          ({myAge} {myAge >= 5 ? 'rokov' : 'roky'}) a {sName} v roku, keď mala tiež {myAge}.
        </p>
      </header>

      {!sister ? (
        <Empty title={`${sName} zatiaľ nemá nahraté výsledky`}>
          <p>Keď sa doplnia Ninine časy (z PDF alebo zo screenshotov zo swimrankings.net, rovnako ako pri Kristínke), objaví sa tu porovnanie.</p>
        </Empty>
      ) : common.length === 0 ? (
        <Empty title="Zatiaľ nemajú spoločnú disciplínu" />
      ) : (
        <>
          <section className="sis-hero">
            <div className="sis-score">
              <span className="sis-big">{faster}<small>/{withBoth.length}</small></span>
              <p>
                V <b>{faster}</b> z {withBoth.length} disciplín je {me!.first_name} v {myAge} rokoch rýchlejšia, než bola {sName} v rovnakom veku.
              </p>
            </div>
            <div className="sis-legend">
              <span className="k">{me!.first_name}, ročník {myBirth}</span>
              <span className="n">{sName}, ročník {sBirth}</span>
            </div>
          </section>

          <div className="table-scroll">
            <table className="cmp sis-table">
              <thead>
                <tr>
                  <th scope="col">Disciplína</th>
                  <th scope="col" className="me">{me!.first_name} ({myAge})</th>
                  <th scope="col">{sName} v {myAge} rokoch</th>
                  <th scope="col" className="hide-s">{sName} osobák</th>
                </tr>
              </thead>
              <tbody>
                {[...sameAge].sort((a, b) => Number(!!(b.mine && b.hers)) - Number(!!(a.mine && a.hers))).map(({ p, mine, hers }) => {
                  const npb = sisterPbs.find((x) => x.key === p.key);
                  const k = disciplineKey(p.stroke, p.distance, p.course);
                  return (
                    <tr key={k} className={disc && disciplineKey(disc.stroke, disc.distance, disc.course) === k ? 'sel' : ''} onClick={() => setD({ stroke: p.stroke, distance: p.distance, course: p.course })}>
                      <th scope="row">{disciplineLabel(p.distance, p.stroke)}, {courseShort[p.course]}</th>
                      <td className="me">{mine ? fmtTime(mine.swim_ms) : <span className="muted small">v {myAge} ešte nie</span>}</td>
                      <td>
                        {hers ? fmtTime(hers.swim_ms) : <span className="muted small">bez času</span>}
                        {mine && hers && mine.swim_ms === hers.swim_ms && <span className="gap">rovnaký čas</span>}
                        {mine && hers && mine.swim_ms !== hers.swim_ms && (
                          <span className={mine.swim_ms! < hers.swim_ms! ? 'gap behind' : 'gap ahead'}>
                            {mine.swim_ms! < hers.swim_ms! ? `${me!.first_name} rýchlejšia o ${fmtGap(hers.swim_ms! - mine.swim_ms!).slice(1)}` : `${sName} bola rýchlejšia o ${fmtGap(mine.swim_ms! - hers.swim_ms!).slice(1)}`}
                          </span>
                        )}
                      </td>
                      <td className="hide-s">{npb ? fmtTime(npb.best.swim_ms) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">Klikni na disciplínu a nižšie uvidíš, ako sa vyvíjali obe, vek po veku.</p>

          {disc && (
            <section className="section">
              <header className="section-head">
                <div>
                  <p className="eyebrow">Vek po veku</p>
                  <h2>{disciplineLabel(disc.distance, disc.stroke)}, {courseShort[disc.course]}</h2>
                </div>
              </header>
              <DisciplinePicker value={disc} onChange={setD} available={new Set(common.map((p) => p.key))} />

              <div className="chart-card">
                <div className="chart-legend">
                  <span className="lg line">{me!.first_name}</span>
                  <span className="lg dash-n">{sName}</span>
                  <span className="lg">os X = vek</span>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chart} margin={{ top: 10, right: 16, bottom: 0, left: 4 }}>
                    <CartesianGrid stroke="rgba(6,27,42,.08)" vertical={false} />
                    <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v) => `${Math.floor(v)} r.`} stroke="#4a5d6b" tickLine={false} fontSize={12} allowDecimals={false} />
                    <YAxis reversed domain={['auto', 'auto']} tickFormatter={(v) => fmtTime(v)} stroke="#4a5d6b" tickLine={false} axisLine={false} width={56} fontSize={12} />
                    <Tooltip
                      contentStyle={{ borderRadius: 2, border: '1px solid rgba(6,27,42,.2)', background: '#fbfaf7' }}
                      labelFormatter={(v) => `vek ${Number(v).toFixed(1).replace('.', ',')}`}
                      formatter={(v: any, n: any) => [fmtTime(v), n === 'k' ? me!.first_name : sName]}
                    />
                    <ReferenceLine x={ageExact(new Date().toISOString(), myBirth)} stroke="#39d5db" strokeDasharray="3 4" />
                    <Line dataKey="k" stroke="#0b858b" strokeWidth={2.5} dot={{ r: 3, fill: '#0b858b' }} connectNulls />
                    <Line dataKey="n" stroke="#061b2a" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: '#061b2a' }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <ol className="age-list">
                {ages.map(({ age, mine, hers }) => (
                  <li key={age} className={age === myAge ? 'now' : ''}>
                    <span className="age">{age}<small> r.</small></span>
                    <span className="who k">{mine ? <><b>{fmtTime(mine.swim_ms)}</b><small>{fmtDate(mine.race_date)}</small></> : <span className="muted">–</span>}</span>
                    <span className="who n">{hers ? <><b>{fmtTime(hers.swim_ms)}</b><small>{fmtDate(hers.race_date)}</small></> : <span className="muted">–</span>}</span>
                    <span className="diff">
                      {mine && hers && (
                        <span className={mine.swim_ms! < hers.swim_ms! ? 'gap behind' : 'gap ahead'}>{fmtGap(mine.swim_ms! - hers.swim_ms!)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="note">Rozdiel je čas {me!.first_name.replace(/a$/, 'y')} mínus čas {sName.replace(/a$/, 'y')} v tom istom veku. Mínus znamená, že {me!.first_name} je rýchlejšia.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
