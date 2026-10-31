import { useEffect, useRef, useState } from 'react';
import { fmtGap, fmtTime } from '../lib/format';

export interface Lane {
  id: string | number;
  name: string;
  sub?: string | null;
  ms: number;
  highlight?: boolean;
}

/**
 * Preteky v dráhach: časy sa prehrajú ako virtuálny súboj.
 * Najrýchlejší dopláva za ~4 s, ostatní proporčne podľa času.
 */
export default function LaneRace({ lanes, distance, pool = 25, title }: { lanes: Lane[]; distance: number; pool?: number; title?: string }) {
  const [p, setP] = useState(0); // 0..1 čas pretekov v pomere k najpomalšiemu
  const [run, setRun] = useState(0);
  const raf = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const fastest = Math.min(...lanes.map((l) => l.ms));
  const slowest = Math.max(...lanes.map((l) => l.ms));
  const ref = lanes.find((l) => l.highlight);

  useEffect(() => {
    if (!lanes.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return setP(1);
    let start = 0;
    const DUR = 4200 * (slowest / fastest);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const tick = (t: number) => {
        if (!start) start = t;
        const k = Math.min(1, (t - start) / DUR);
        setP(k);
        if (k < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    if (box.current) io.observe(box.current);
    return () => {
      cancelAnimationFrame(raf.current);
      io.disconnect();
    };
  }, [run, lanes.length, fastest, slowest]);

  if (!lanes.length) return null;
  const elapsed = p * slowest; // virtuálny uplynutý čas v ms
  const lengths = Math.max(1, Math.round(distance / pool));

  return (
    <div className="race" ref={box}>
      <div className="race-head">
        {title && <h3>{title}</h3>}
        <button className="btn ghost small" onClick={() => { setP(0); setRun((r) => r + 1); }}>
          Prehrať znova
        </button>
      </div>
      <div className="pool" style={{ ['--lengths' as any]: lengths }}>
        {lanes.map((l, i) => {
          const prog = Math.min(1, elapsed / l.ms);
          const done = prog >= 1;
          return (
            <div key={l.id} className={`lane${l.highlight ? ' me' : ''}${done ? ' done' : ''}`}>
              <div className="lane-no">{i + 1}</div>
              <div className="lane-water">
                <div className="lane-marks" />
                <div className="swimmer" style={{ left: `calc(${prog * 100}% - ${prog * 1.6}rem)` }}>
                  <span className="wake" style={{ opacity: done ? 0 : 1 }} />
                  <span className="dot" />
                </div>
              </div>
              <div className="lane-info">
                <span className="lane-name">{l.name}</span>
                {l.sub && <span className="lane-sub">{l.sub}</span>}
              </div>
              <div className="lane-time">
                {done ? fmtTime(l.ms) : fmtTime(Math.min(elapsed, l.ms))}
                {done && ref && !l.highlight && (
                  <span className={l.ms < ref.ms ? 'gap ahead' : 'gap behind'}>{fmtGap(l.ms - ref.ms)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
