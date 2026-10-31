// Čítanie dát z live.swimrankings.net (Splash Meet Manager – výsledky SPF)
import { parseLenexXml, unzipLenex, type ParsedMeet } from './lenex';

export const LIVE_BASE = 'https://live.swimrankings.net';
const UA = 'Mozilla/5.0 (compatible; KristinkaPlavanie/1.0; osobna stranka plavkyne)';

async function get(url: string): Promise<Response> {
  return fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'sk,en;q=0.8' }, redirect: 'follow' });
}

export async function fetchMeetLenex(meetId: number): Promise<ParsedMeet | null> {
  const res = await get(`${LIVE_BASE}/${meetId}/results.lxf`);
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length < 50) return null;
  return parseLenexXml(unzipLenex(buf));
}

const stripTags = (s: string) =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();

export interface ListedMeet {
  id: number;
  text: string;
  pool: string | null;
}

/** Zoznam slovenských pretekov z live.swimrankings.net (posledné týždne + nadchádzajúce) */
export async function listNationMeets(nation = 'SVK'): Promise<ListedMeet[]> {
  const res = await get(`${LIVE_BASE}/?nation=${nation}`);
  if (!res.ok) throw new Error(`live.swimrankings.net vrátil ${res.status}`);
  const html = await res.text();
  const out = new Map<number, ListedMeet>();
  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const m = row.match(/href="(?:https?:\/\/live\.swimrankings\.net)?\/?(\d{4,6})\/"/i);
    if (!m) continue;
    const id = +m[1];
    const text = stripTags(row.split(/<\/tr>/i)[0]);
    const pool = text.match(/\b(25|50)\s?m\b/)?.[1] ?? null;
    if (!out.has(id)) out.set(id, { id, text, pool });
  }
  return [...out.values()];
}

export interface MeetEventLink {
  number: number;
  title: string;
  start: string | null;
  result: string | null;
}

/** Disciplíny pretekov s odkazmi na štartové listiny a výsledky (PDF) */
export async function fetchMeetIndex(meetId: number) {
  const res = await get(`${LIVE_BASE}/${meetId}/`);
  if (!res.ok) return null;
  const html = await res.text();
  const title = stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const events = new Map<number, MeetEventLink>();
  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const body = row.split(/<\/tr>/i)[0];
    const s = body.match(/StartList_(\d+)\.pdf/i);
    const r = body.match(/ResultList_(\d+)\.pdf/i);
    const n = s ? +s[1] : r ? +r[1] : null;
    if (n == null) continue;
    const prev = events.get(n);
    const text = stripTags(body);
    events.set(n, {
      number: n,
      title: prev?.title && prev.title.length > text.length ? prev.title : text,
      start: s ? `${LIVE_BASE}/${meetId}/StartList_${n}.pdf` : prev?.start ?? null,
      result: r ? `${LIVE_BASE}/${meetId}/ResultList_${n}.pdf` : prev?.result ?? null,
    });
  }
  const files = ['Medals.pdf', 'MedalsByClub.pdf', 'ProgressionSummary.pdf', 'EntryStatistics.pdf'].filter((f) =>
    html.includes(f),
  );
  return {
    id: meetId,
    title,
    url: `${LIVE_BASE}/${meetId}/`,
    hasLenex: html.includes('results.lxf'),
    files: files.map((f) => ({ name: f, url: `${LIVE_BASE}/${meetId}/${f}` })),
    events: [...events.values()].sort((a, b) => a.number - b.number),
  };
}
