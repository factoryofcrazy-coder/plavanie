import { useEffect, useRef } from 'react';

/**
 * Bazén zhora: voda s pohyblivými kaustikami, čierne čiary na dne a laná medzi dráhami.
 * Ak je nastavená fotka, zobrazí sa fotka v rovnakom ráme.
 */
export default function PoolVisual({ photo, lanes = 6, highlight = 4 }: { photo?: string | null; lanes?: number; highlight?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (photo) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const W = 120, H = 160;
    canvas.width = W;
    canvas.height = H;
    const img = ctx.createImageData(W, H);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    const deep = [5, 46, 60], shallow = [16, 108, 122], light = [196, 246, 246];

    const draw = (time: number) => {
      const t = time * 0.00022;
      const d = img.data;
      let i = 0;
      for (let y = 0; y < H; y++) {
        const ny = y / H;
        for (let x = 0; x < W; x++) {
          const nx = x / W;
          const a = Math.sin(nx * 21 + t * 1.7 + Math.sin(ny * 13 + t));
          const b = Math.sin(ny * 25 - t * 1.3 + Math.sin(nx * 17 - t * 0.8));
          const c = Math.sin((nx * 0.7 + ny) * 19 + t * 1.1);
          const v = (a + b + c) / 3;
          const k = Math.pow(1 - Math.abs(v), 9) * 0.55;
          const g = 0.35 + 0.65 * (1 - Math.abs(nx - 0.55));
          for (let ch = 0; ch < 3; ch++) {
            const base = deep[ch] + (shallow[ch] - deep[ch]) * g;
            d[i + ch] = base + (light[ch] - base) * k;
          }
          d[i + 3] = 255;
          i += 4;
        }
      }
      ctx.putImageData(img, 0, 0);
    };
    const loop = (time: number) => {
      if (visible && !document.hidden) draw(time);
      raf = requestAnimationFrame(loop);
    };
    if (reduce) draw(3000);
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [photo]);

  const w = 100 / lanes;
  return (
    <div className={`pool-visual${photo ? ' has-photo' : ''}`}>
      {photo ? (
        <img src={photo} alt="Kristínka pri plávaní" loading="eager" decoding="async" />
      ) : (
        <>
          <canvas ref={ref} aria-hidden="true" />
          <svg className="pool-lines" viewBox="0 0 100 133" preserveAspectRatio="none" aria-hidden="true">
            {/* čiary na dne */}
            {Array.from({ length: lanes }, (_, i) => {
              const cx = w * i + w / 2;
              return (
                <g key={i} className={i + 1 === highlight ? 'hl' : ''}>
                  <rect x={cx - 0.9} y="9" width="1.8" height="115" />
                  <rect x={cx - 3.2} y="9" width="6.4" height="1.6" />
                  <rect x={cx - 3.2} y="122.4" width="6.4" height="1.6" />
                </g>
              );
            })}
            {/* laná */}
            {Array.from({ length: lanes - 1 }, (_, i) => (
              <line key={i} className="rope-line" x1={w * (i + 1)} x2={w * (i + 1)} y1="0" y2="133" />
            ))}
          </svg>
          <div className="pool-glare" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
