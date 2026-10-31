// Čítanie dát z live.swimrankings.net (Splash Meet Manager – výsledky SPF)
import { parseLenexXml, unzipLenex, type ParsedMeet } from './lenex.js';

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
  status: 'live' | 'upcoming' | 'finished';
  name: string;
  date: string | null;
  city: string | null;
  nation: string | null;
}

const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** "Upcoming 7 Nov 2026 7 Nov 25m Názov 🇸🇰 Mesto SVK · 25m …" -> polia */
export function parseListedText(raw: string) {
  const text = raw.replace(/^[^>]*>\s*/, '').trim();
  const status: ListedMeet['status'] = /^live/i.test(text) ? 'live' : /^upcoming/i.test(text) ? 'upcoming' : 'finished';
  const body = text.replace(/^(upcoming|live|finished)\s+/i, '');
  const dm = body.match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+([A-Za-z]{3})\s+(\d{4})/);
  let date: string | null = null;
  if (dm) {
    const mo = MON[dm[3].toLowerCase()];
    date = dm[2] ? `${dm[1]}.–${dm[2]}. ${mo}. ${dm[4]}` : `${dm[1]}. ${mo}. ${dm[4]}`;
  }
  const rest = body.match(/\b(25|50)\s?m\s+(.+)$/);
  const pool = rest?.[1] ?? null;
  let name = rest?.[2] ?? body;
  let city: string | null = null, nation: string | null = null;
  const flag = name.match(/\s*[\u{1F1E6}-\u{1F1FF}]{2}\s*(.+?)\s+([A-Z]{3})\b/u);
  if (flag) {
    city = flag[1].trim();
    nation = flag[2];
    name = name.slice(0, flag.index).trim();
  } else {
    const alt = name.match(/^(.*?)\s+([A-Z]{2}\s+)?([^·]+?)\s+([A-Z]{3})\s+·/);
    if (alt) { name = alt[1]; city = alt[3]; nation = alt[4]; }
  }
  return { status, date, pool, name: name.replace(/\s+·.*$/, '').trim(), city, nation };
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
    if (!out.has(id)) out.set(id, { id, text, ...parseListedText(row.split(/<\/tr>/i)[0].replace(/^[^>]*>/, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ')) });
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

/** Termínová listina SPF (swimapp.sk): ID pretekov z live.swimrankings.net s názvom */
export async function listSwimappMeets(url = 'https://www.swimapp.sk/tl/'): Promise<{ id: number; name: string }[]> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'sk' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`swimapp.sk vrátil ${res.status}`);
  const html = await res.text();
  const out = new Map<number, { id: number; name: string }>();
  // bloky podujatí začínajú nadpisom <h2>
  const blocks = html.split(/<h2[\s>]/i);
  for (const b of blocks) {
    const ids = [...b.matchAll(/live\.swimrankings\.net\/(\d{4,6})/gi)].map((m) => +m[1]);
    if (!ids.length) continue;
    const name = stripTags(b.split(/<\/h2>/i)[0]).slice(0, 160);
    for (const id of ids) if (!out.has(id)) out.set(id, { id, name });
  }
  return [...out.values()];
}
