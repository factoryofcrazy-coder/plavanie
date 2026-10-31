import { useEffect, useRef } from 'react';

/** Animovaná hladina – svetelné kaustiky ako na dne bazéna */
export default function WaterCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const W = 192, H = 108;
    canvas.width = W;
    canvas.height = H;
    const img = ctx.createImageData(W, H);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    // farby: hlboká voda -> svetlá kaustika
    const deep = [4, 37, 63], mid = [14, 143, 181], light = [190, 242, 250];

    const draw = (time: number) => {
      const t = time * 0.00035;
      const d = img.data;
      let i = 0;
      for (let y = 0; y < H; y++) {
        const ny = y / H;
        for (let x = 0; x < W; x++) {
          const nx = x / W;
          const p1 = Math.sin(nx * 15.3 + t * 1.3 + Math.sin(ny * 10.1 - t));
          const p2 = Math.sin(ny * 17.9 - t * 1.1 + Math.sin(nx * 12.7 + t * 0.7));
          const p3 = Math.sin((nx * 1.3 - ny) * 11.1 + t * 0.9);
          const v = (p1 + p2 + p3) / 3;
          const c = Math.pow(1 - Math.abs(v), 6); // tenké svetelné žilky
          const depth = 0.25 + ny * 0.75;
          const base = [0, 1, 2].map((k) => deep[k] + (mid[k] - deep[k]) * (1 - depth) * 0.9);
          d[i++] = base[0] + (light[0] - base[0]) * c * 0.75;
          d[i++] = base[1] + (light[1] - base[1]) * c * 0.75;
          d[i++] = base[2] + (light[2] - base[2]) * c * 0.75;
          d[i++] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    const loop = (time: number) => {
      if (visible && !document.hidden) draw(time);
      raf = requestAnimationFrame(loop);
    };
    if (reduce) draw(4000);
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
