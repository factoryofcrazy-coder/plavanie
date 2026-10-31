import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LaneRace from '../components/LaneRace';
import { DisciplinePicker, Empty, Loader, type Disc } from '../components/ui';
import { useData } from '../lib/data';
import { courseShort, disciplineKey, disciplineLabel, fmtDate, fmtGap, fmtTime, parseDisciplineKey, resultPdf, seasonOf } from '../lib/format';
import { supabase } from '../lib/supabase';

interface Row {
  rank: number;
  athlete_id: number;
  athlete_key: string;
  name: string;
  club: string | null;
  birth_year: number | null;
  best_ms: number;
  points: number | null;
  race_date: string;
  meet_id: number | null;
  meet_name: string | null;
  event_number: number | null;
}

export default function Rebricek() {
  const { athlete: me, pbs, loading } = useData();
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const cur = seasonOf(now);
  const prev = seasonOf(new Date(now.getFullYear() - 1, now.getMonth(), 1));
  const periods = [
    { id: 'sezona', label: `Sezóna ${cur.label}`, from: cur.from, to: cur.to },
    { id: 'minula', label: `Sezóna ${prev.label}`, from: prev.from, to: prev.to },
    { id: '12m', label: 'Posledných 12 mesiacov', from: new Date(now.getTime() - 365 * 86400_000).toISOString().slice(0, 10), to: null },
    { id: 'vsetko', label: 'Celkovo', from: null, to: null },
  ];
  const by = me?.birth_year ?? 2013;
  const groups = [
    { id: 'rocnik', label: `Ročník ${by}`, from: by, to: by },
    { id: 'dva', label: `Ročníky ${by - 1} a ${by}`, from: by - 1, to: by },
    { id: 'mladsie', label: `Ročníky ${by} a ${by + 1}`, from: by, to: by + 1 },
    { id: 'vsetky', label: 'Všetky ročníky', from: null, to: null },
  ];

  const fallback = useMemo(() => {
    const top = [...pbs].sort((a, b) => b.count - a.count)[0];
    return (top ? { stroke: top.stroke, distance: top.distance, course: top.course } : { stroke: 'FREE', distance: 50, course: 'SCM' }) as Disc;
  }, [pbs]);
  const d: Disc = params.get('d') ? parseDisciplineKey(params.get('d')!) : fallback;
  const period = periods.find((p) => p.id === params.get('o')) ?? periods[2];
  const group = groups.find((g) => g.id === params.get('r')) ?? groups[0];
  const onlySvk = params.get('n') !== 'vsetci';
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    n.set(k, v);
    setParams(n, { replace: true });
  };

  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    setRows(null);
    supabase
      .rpc('leaderboard2', {
        p_stroke: d.stroke, p_distance: d.distance, p_course: d.course, p_gender: me?.gender ?? 'F',
        p_birth_from: group.from, p_birth_to: group.to, p_from: period.from, p_to: period.to, p_nation: onlySvk ? 'SVK' : null,
      })
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [d.stroke, d.distance, d.course, group.id, period.id, me?.gender, onlySvk]);

  const mine = rows?.find((r) => r.athlete_id === me?.id);
  const raceLanes = useMemo(() => {
    if (!rows?.length) return [];
    const idx = mine ? rows.indexOf(mine) : -1;
    const pick = new Set<number>([0, 1, 2]);
    if (idx >= 0) [idx - 2, idx - 1, idx, idx + 1, idx + 2].forEach((i) => i >= 0 && i < rows.length && pick.add(i));
    return [...pick].sort((a, b) => a - b).slice(0, 8).map((i) => rows[i]);
  }, [rows, mine]);

  if (loading) return <div className="wrap"><Loader /></div>;

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Rebríček</h1>
        <p className="lede">Najlepšie časy plavkýň v disciplíne z pretekov SPF nahratých na túto stránku (od marca 2026). Kristínkine staršie časy sú doplnené zo swimrankings.net.</p>
      </header>

      <DisciplinePicker value={d} onChange={(x) => set('d', disciplineKey(x.stroke, x.distance, x.course))} />
      <div className="filters">
        <label>
          <span>Obdobie</span>
          <select value={period.id} onChange={(e) => set('o', e.target.value)}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label>
          <span>Kategória</span>
          <select value={group.id} onChange={(e) => set('r', e.target.value)}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </label>
        <label>
          <span>Plavkyne</span>
          <select value={onlySvk ? 'svk' : 'vsetci'} onChange={(e) => set('n', e.target.value)}>
            <option value="svk">Iba zo Slovenska</option>
            <option value="vsetci">Aj zahraničné</option>
          </select>
        </label>
      </div>

      {!rows ? (
        <Loader />
      ) : rows.length === 0 ? (
        <Empty title="V tomto výbere zatiaľ nie sú výsledky">
          <p>Skús dlhšie obdobie alebo iný ročník.</p>
        </Empty>
      ) : (
        <>
          <section className="rank-hero">
            {mine ? (
              <>
                <span className="rank-big">{mine.rank}.</span>
                <div>
                  <p className="rank-line">
                    {me!.first_name} je <b>{mine.rank}.</b> z {rows.length} v disciplíne {disciplineLabel(d.distance, d.stroke)} ({courseShort[d.course]} bazén).
                  </p>
                  <p className="muted">
                    {mine.rank > 1 ? `Na prvé miesto chýba ${fmtGap(mine.best_ms - rows[0].best_ms).slice(1)}.` : 'Je najrýchlejšia!'}
                    {mine.rank > 1 && (() => {
                      const ahead = rows[rows.indexOf(mine) - 1];
                      return ` Na ${ahead.rank}. miesto chýba ${fmtGap(mine.best_ms - ahead.best_ms).slice(1)}.`;
                    })()}
                  </p>
                </div>
              </>
            ) : (
              <p className="rank-line">{me ? `${me.first_name} v tomto výbere zatiaľ nemá čas.` : ''}</p>
            )}
          </section>

          <LaneRace
            key={`${disciplineKey(d.stroke, d.distance, d.course)}-${period.id}-${group.id}-${onlySvk}`}
            title="Virtuálne finále"
            distance={d.distance}
            pool={d.course === 'LCM' ? 50 : 25}
            lanes={raceLanes.map((r) => ({ id: r.athlete_id, name: `${r.rank}. ${r.name}`, sub: r.club, ms: r.best_ms, highlight: r.athlete_id === me?.id }))}
          />

          <div className="table-scroll">
            <table className="board">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Plavkyňa</th>
                  <th scope="col" className="hide-s">Ročník</th>
                  <th scope="col">Čas</th>
                  {mine && <th scope="col">Rozdiel</th>}
                  <th scope="col" className="hide-s">Body</th>
                  <th scope="col" className="hide-s">Preteky</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pdf = resultPdf(r.meet_id, r.event_number);
                  const isMe = r.athlete_id === me?.id;
                  return (
                    <tr key={r.athlete_id} className={isMe ? 'me' : ''}>
                      <td className="rk">{r.rank}</td>
                      <td>
                        <Link to={isMe ? '/' : `/konkurencia?s=${r.athlete_id}`} className="nm">{r.name}</Link>
                        <span className="cl">{r.club}</span>
                      </td>
                      <td className="hide-s">{r.birth_year}</td>
                      <td className="tm">{fmtTime(r.best_ms)}</td>
                      {mine && <td>{isMe ? '' : <span className={r.best_ms < mine.best_ms ? 'gap ahead' : 'gap behind'}>{fmtGap(r.best_ms - mine.best_ms)}</span>}</td>}
                      <td className="hide-s">{r.points ?? ''}</td>
                      <td className="hide-s mt">
                        {pdf ? <a href={pdf} target="_blank" rel="noreferrer">{r.meet_name}</a> : r.meet_name}
                        <span className="cl">{fmtDate(r.race_date)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
