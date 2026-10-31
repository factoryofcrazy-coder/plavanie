import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DISTANCES, STROKES, courseShort, strokeName, type Course, type Stroke } from '../lib/format';

export function CountUp({ value, format = (n: number) => String(Math.round(n)), duration = 1200 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(value);
    let raf = 0, start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const k = Math.min(1, (t - start) / duration);
      setV(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(v)}</>;
}

export function LaneRope() {
  return <div className="rope" aria-hidden="true" />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 120 40" aria-hidden="true"><path d="M0 20 Q15 8 30 20 T60 20 T90 20 T120 20" /></svg>
      <h3>{title}</h3>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function Loader() {
  return <div className="loader" role="status" aria-label="Načítavam"><span /><span /><span /></div>;
}

export interface Disc {
  stroke: Stroke;
  distance: number;
  course: Course;
}

/** Výber disciplíny: spôsob, vzdialenosť, bazén */
export function DisciplinePicker({ value, onChange, available }: { value: Disc; onChange: (d: Disc) => void; available?: Set<string> }) {
  const has = (s: Stroke, d: number, c: Course) => !available || available.has(`${s}-${d}-${c}`);
  return (
    <div className="picker">
      <div className="seg" role="radiogroup" aria-label="Bazén">
        {(['SCM', 'LCM'] as Course[]).map((c) => (
          <button key={c} role="radio" aria-checked={value.course === c} className={value.course === c ? 'on' : ''} onClick={() => onChange({ ...value, course: c })}>
            {courseShort[c]}
          </button>
        ))}
      </div>
      <div className="seg" role="radiogroup" aria-label="Spôsob">
        {STROKES.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={value.stroke === s}
            className={value.stroke === s ? 'on' : ''}
            onClick={() => {
              const ds = DISTANCES[s];
              onChange({ ...value, stroke: s, distance: ds.includes(value.distance) ? value.distance : ds[0] });
            }}
          >
            {strokeName[s]}
          </button>
        ))}
      </div>
      <div className="seg" role="radiogroup" aria-label="Vzdialenosť">
        {DISTANCES[value.stroke].map((d) => (
          <button
            key={d}
            role="radio"
            aria-checked={value.distance === d}
            className={`${value.distance === d ? 'on' : ''}${has(value.stroke, d, value.course) ? '' : ' faint'}`}
            onClick={() => onChange({ ...value, distance: d })}
          >
            {d} m
          </button>
        ))}
      </div>
    </div>
  );
}

export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setInView(true), io.disconnect()), { threshold: 0.2 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return [ref, inView] as const;
}
