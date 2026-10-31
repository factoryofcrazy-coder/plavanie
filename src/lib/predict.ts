// Predikcia času: vážená regresia na log(čas) s útlmom zlepšovania
export interface Point {
  date: Date;
  ms: number;
}
export interface Forecast {
  ok: boolean;
  reason?: string;
  slopePerYear: number; // relatívna zmena za rok (napr. -0.04 = o 4 % rýchlejšie)
  at: (d: Date) => { ms: number; lo: number; hi: number };
  n: number;
}

const YEAR = 365.25 * 86400_000;
const DAMP = 0.6; // ako rýchlo sa zlepšovanie spomaľuje (1/rok)

export function forecast(points: Point[], now = new Date()): Forecast {
  const fail = (reason: string): Forecast => ({ ok: false, reason, slopePerYear: 0, at: () => ({ ms: NaN, lo: NaN, hi: NaN }), n: points.length });
  const cutoff = now.getTime() - 3 * YEAR;
  const pts = points.filter((p) => p.date.getTime() >= cutoff && p.ms > 0);
  if (pts.length < 3) return fail('Na predikciu treba aspoň 3 výsledky z posledných 3 rokov');
  const t0 = pts[pts.length - 1].date.getTime();
  const xs = pts.map((p) => (p.date.getTime() - t0) / YEAR); // <= 0
  const ys = pts.map((p) => Math.log(p.ms));
  const ws = xs.map((x) => Math.exp(x / 1.2)); // novšie výsledky majú väčšiu váhu
  const W = ws.reduce((a, b) => a + b, 0);
  const xm = xs.reduce((a, x, i) => a + ws[i] * x, 0) / W;
  const ym = ys.reduce((a, y, i) => a + ws[i] * y, 0) / W;
  let sxx = 0, sxy = 0;
  xs.forEach((x, i) => { sxx += ws[i] * (x - xm) ** 2; sxy += ws[i] * (x - xm) * (ys[i] - ym); });
  if (sxx < 1e-6) return fail('Výsledky sú z príliš krátkeho obdobia');
  let b = sxy / sxx;
  b = Math.max(Math.min(b, 0.05), -0.25); // rozumné hranice
  const a = ym - b * xm;
  const resid = ys.map((y, i) => y - (a + b * xs[i]));
  const s2 = resid.reduce((acc, r, i) => acc + ws[i] * r * r, 0) / Math.max(W * (pts.length - 2) / pts.length, 1e-9);
  const s = Math.sqrt(Math.max(s2, 0.0001 ** 2));
  const nEff = W ** 2 / ws.reduce((acc, w) => acc + w * w, 0);

  return {
    ok: true,
    n: pts.length,
    slopePerYear: Math.exp(b) - 1,
    at: (d: Date) => {
      const h = (d.getTime() - t0) / YEAR;
      // po poslednom výsledku sa trend postupne tlmí
      const hx = h <= 0 ? h : (1 - Math.exp(-DAMP * h)) / DAMP;
      const y = a + b * hx;
      const se = s * Math.sqrt(1 + 1 / nEff + (hx - xm) ** 2 / sxx) * (1 + Math.max(h, 0) * 0.35);
      return { ms: Math.exp(y), lo: Math.exp(y - 1.28 * se), hi: Math.exp(y + 1.28 * se) };
    },
  };
}

/** Kedy predikcia dosiahne cieľ (do 3 rokov), inak null */
export function reachDate(f: Forecast, targetMs: number, from = new Date()): Date | null {
  if (!f.ok) return null;
  for (let d = 0; d <= 3 * 365; d += 7) {
    const date = new Date(from.getTime() + d * 86400_000);
    if (f.at(date).ms <= targetMs) return date;
  }
  return null;
}
