export type Stroke = 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'MEDLEY';
export type Course = 'SCM' | 'LCM';

export const STROKES: Stroke[] = ['FREE', 'BACK', 'BREAST', 'FLY', 'MEDLEY'];

export const strokeName: Record<Stroke, string> = {
  FREE: 'voľný spôsob',
  BACK: 'znak',
  BREAST: 'prsia',
  FLY: 'motýlik',
  MEDLEY: 'polohové preteky',
};
export const strokeShort: Record<Stroke, string> = {
  FREE: 'VS',
  BACK: 'Z',
  BREAST: 'P',
  FLY: 'M',
  MEDLEY: 'PP',
};
export const courseName: Record<Course, string> = { SCM: '25 m bazén', LCM: '50 m bazén' };
export const courseShort: Record<Course, string> = { SCM: '25 m', LCM: '50 m' };

// ciele majú v databáze slovenské kódy
export const goalStroke: Record<Stroke, string> = {
  FREE: 'volny', BACK: 'znak', BREAST: 'prsia', FLY: 'motylik', MEDLEY: 'polohove',
};
export const goalStrokeBack: Record<string, Stroke> = Object.fromEntries(
  Object.entries(goalStroke).map(([k, v]) => [v, k as Stroke]),
) as Record<string, Stroke>;

export const DISTANCES: Record<Stroke, number[]> = {
  FREE: [50, 100, 200, 400, 800, 1500],
  BACK: [50, 100, 200],
  BREAST: [50, 100, 200],
  FLY: [50, 100, 200],
  MEDLEY: [100, 200, 400],
};

export const disciplineLabel = (d: number, s: Stroke) => `${d} m ${strokeName[s]}`;
export const disciplineKey = (s: Stroke, d: number, c: Course) => `${s}-${d}-${c}`;
export const parseDisciplineKey = (k: string) => {
  const [s, d, c] = k.split('-');
  return { stroke: s as Stroke, distance: +d, course: c as Course };
};

/** 87780 -> "1:27.78" */
export function fmtTime(ms: number | null | undefined): string {
  if (ms == null) return '–';
  const cs = Math.round(ms / 10);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  const cc = String(c).padStart(2, '0');
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}.${cc}` : `${s}.${cc}`;
}

/** Rozdiel v sekundách so znamienkom: "+1,23 s" */
export function fmtGap(ms: number): string {
  const s = Math.abs(ms) / 1000;
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '±';
  return `${sign}${s.toFixed(2).replace('.', ',')} s`;
}

/** "1:27.78" / "87.78" / "1:27,78" -> ms */
export function parseTimeInput(v: string): number | null {
  const t = v.trim().replace(',', '.');
  const m = t.match(/^(?:(\d+):)?(\d{1,2}(?:\.\d{1,2})?)$/);
  if (!m) return null;
  const ms = Math.round(((m[1] ? +m[1] * 60 : 0) + parseFloat(m[2])) * 1000);
  return ms > 0 ? ms : null;
}

const dateFmt = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' });
const dateLong = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtDate = (d: string | null | undefined) => (d ? dateFmt.format(new Date(d)) : '–');
export const fmtDateLong = (d: string | Date) => dateLong.format(typeof d === 'string' ? new Date(d) : d);

/** Plavecká sezóna SPF: 1. 9. – 31. 8. */
export function seasonOf(date = new Date()) {
  const y = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return { from: `${y}-09-01`, to: `${y + 1}-08-31`, label: `${y}/${String(y + 1).slice(2)}` };
}

export const LIVE = 'https://live.swimrankings.net';
export const resultPdf = (meetId: number | null, ev: number | null) =>
  meetId && ev && meetId > 999 ? `${LIVE}/${meetId}/ResultList_${ev}.pdf` : null;

export const plural = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n >= 2 && n <= 4 ? few : many;
