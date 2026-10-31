// Štartové listiny nadchádzajúcich pretekov: Lenex (ENTRIES) alebo PDF zo Splash Meet Manager
import { XMLParser } from 'fast-xml-parser';
import { fold, parseSwimTime, unzipLenex } from './lenex.js';
import { fetchMeetIndex, LIVE_BASE } from './splash.js';

const UA = 'Mozilla/5.0 (compatible; KristinkaPlavanie/1.0; osobna stranka plavkyne)';
const arr = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

export interface Neighbor { lane: number | null; name: string; club: string | null; entry_ms: number | null; year: number | null; me?: boolean }
export interface StartEntry {
  event: number;
  title: string;
  date: string | null;
  time: string | null;
  stroke: string | null;
  distance: number | null;
  entry_ms: number | null;
  heat: number | null;
  heats: number | null;
  lane: number | null;
  neighbors: Neighbor[];
  pdf: string | null;
}
export interface MeetStart { source: 'lenex' | 'pdf' | 'none'; entries: StartEntry[]; startlists: number }

export interface Who { last: string; first: string; year: number }

/** Lenex so štartovkou (Splash nahráva results.lxf aj pred pretekmi) */
function fromLenex(xml: string, who: Who): StartEntry[] | null {
  const p = new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: false, parseTagValue: false,
    isArray: (n) => ['MEET', 'SESSION', 'EVENT', 'HEAT', 'CLUB', 'ATHLETE', 'ENTRY', 'RESULT'].includes(n),
  });
  const meet = arr<any>(p.parse(xml)?.LENEX?.MEETS?.MEET)[0];
  if (!meet) return null;
  const events = new Map<string, any>();
  const heats = new Map<string, { number: number; daytime: string | null; eventid: string }>();
  for (const s of arr<any>(meet.SESSIONS?.SESSION)) {
    for (const ev of arr<any>(s.EVENTS?.EVENT)) {
      const ss = ev.SWIMSTYLE ?? {};
      if (parseInt(ss.relaycount ?? '1', 10) > 1) continue;
      events.set(String(ev.eventid), {
        number: parseInt(ev.number, 10), date: String(s.date ?? '').slice(0, 10) || null,
        time: ev.daytime ?? s.daytime ?? null, stroke: String(ss.stroke ?? '').toUpperCase(), distance: parseInt(ss.distance, 10) || null,
        gender: ev.gender, heats: arr<any>(ev.HEATS?.HEAT).length,
      });
      for (const h of arr<any>(ev.HEATS?.HEAT)) heats.set(String(h.heatid), { number: parseInt(h.number, 10), daytime: h.daytime ?? null, eventid: String(ev.eventid) });
    }
  }
  type Row = { ev: string; heat: string | null; lane: number | null; ms: number | null; name: string; club: string | null; year: number | null; me: boolean };
  const rows: Row[] = [];
  for (const c of arr<any>(meet.CLUBS?.CLUB)) {
    for (const a of arr<any>(c.ATHLETES?.ATHLETE)) {
      const year = a.birthdate ? parseInt(String(a.birthdate).slice(0, 4), 10) : null;
      const me = fold(a.lastname ?? '') === fold(who.last) && fold(a.firstname ?? '') === fold(who.first) && (!year || year === who.year);
      for (const e of arr<any>(a.ENTRIES?.ENTRY)) {
        rows.push({
          ev: String(e.eventid), heat: e.heatid ? String(e.heatid) : null, lane: e.lane ? parseInt(e.lane, 10) : null,
          ms: parseSwimTime(e.entrytime), name: `${a.lastname} ${a.firstname}`, club: c.shortname ?? c.name ?? null, year, me,
        });
      }
    }
  }
  if (!rows.length) return null;
  return rows.filter((r) => r.me && events.has(r.ev)).map((r) => {
    const ev = events.get(r.ev);
    const h = r.heat ? heats.get(r.heat) : null;
    const nb = r.heat ? rows.filter((x) => x.heat === r.heat).sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0)) : [];
    return {
      event: ev.number, title: '', date: ev.date, time: h?.daytime ?? ev.time, stroke: ev.stroke, distance: ev.distance,
      entry_ms: r.ms, heat: h?.number ?? null, heats: ev.heats || null, lane: r.lane,
      neighbors: nb.map((x) => ({ lane: x.lane, name: x.name, club: x.club, entry_ms: x.ms, year: x.year, me: x.me || undefined })),
      pdf: `${LIVE_BASE}/0/StartList_${ev.number}.pdf`,
    } satisfies StartEntry;
  });
}

const TIME_RE = /(\d{1,2}:)?\d{1,2}[.,]\d{2}/;
const toMs = (t: string | undefined) => {
  if (!t) return null;
  const m = t.replace(',', '.').match(/^(?:(\d+):)?(\d{1,2})\.(\d{2})$/);
  return m ? ((m[1] ? +m[1] * 60 : 0) + +m[2]) * 1000 + +m[3] * 10 : null;
};

/** Štartovka z PDF (Splash): riadky "Rozplavba 2 z 4", "4 Hodoňová Kristínka 13 Triatlon Team DK 1:05.40" */
export function fromStartPdfText(lines: string[], who: Who): Omit<StartEntry, 'event' | 'title' | 'pdf' | 'date' | 'time' | 'stroke' | 'distance'> | null {
  const me = (l: string) => fold(l).includes(fold(who.last)) && fold(l).includes(fold(who.first));
  const idx = lines.findIndex(me);
  if (idx < 0) return null;
  const heatRe = /(rozplavba|beh|heat)\s*(\d+)(?:\s*(?:z|of|\/)\s*(\d+))?/i;
  let hs = idx;
  while (hs >= 0 && !heatRe.test(lines[hs])) hs--;
  let he = idx + 1;
  while (he < lines.length && !heatRe.test(lines[he])) he++;
  const hm = hs >= 0 ? lines[hs].match(heatRe) : null;
  const parse = (l: string): Neighbor | null => {
    const m = l.trim().match(/^(\d)\s+(.+)$/);
    if (!m) return null;
    const rest = m[2];
    const times = rest.match(new RegExp(TIME_RE.source, 'g'));
    const ym = rest.match(/\b(19|20)?(\d{2})\b/);
    const nm = rest.match(/^([\p{Lu}][\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]+)+?)(?=\s+\d|\s+\(|$)/u);
    const name = (nm?.[1] ?? rest.split(/\s+\d/)[0]).trim();
    const after = rest.slice(name.length).replace(/^\s*\(?\d{2,4}\)?\s*/, '').replace(new RegExp(`\\s*(${TIME_RE.source}|NT).*$`), '').trim();
    return {
      lane: +m[1], name, club: after || null, entry_ms: toMs(times?.[times.length - 1]),
      year: ym ? (ym[2].length === 2 ? 2000 + +ym[2] : +ym[2]) : null, me: me(l) || undefined,
    };
  };
  const nb = lines.slice(hs + 1, he).map(parse).filter((x): x is Neighbor => !!x && x.name.length > 3);
  const mine = nb.find((x) => x.me) ?? parse(lines[idx]);
  return {
    entry_ms: mine?.entry_ms ?? null, heat: hm ? +hm[2] : null, heats: hm?.[3] ? +hm[3] : null,
    lane: mine?.lane ?? null, neighbors: nb,
  };
}

async function pdfLines(url: string): Promise<string[] | null> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  const out: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc: any = await page.getTextContent();
    // poskladaj riadky podľa Y súradnice
    const byY = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5]);
      const k = [...byY.keys()].find((v) => Math.abs(v - y) <= 2) ?? y;
      if (!byY.has(k)) byY.set(k, []);
      byY.get(k)!.push({ x: it.transform[4], s: it.str });
    }
    for (const y of [...byY.keys()].sort((a, b) => b - a)) out.push(byY.get(y)!.sort((a, b) => a.x - b.x).map((p) => p.s.trim()).join(' '));
  }
  void extractText;
  return out;
}

const STROKE_WORDS: [RegExp, string][] = [[/vo[lľ]n|free/i, 'FREE'], [/znak|back/i, 'BACK'], [/prsia|breast/i, 'BREAST'], [/mot[yý]l|fly|butter/i, 'FLY'], [/poloh|medley|im\b/i, 'MEDLEY']];

export async function meetStartlist(meetId: number, who: Who): Promise<MeetStart> {
  // 1) Lenex
  try {
    const res = await fetch(`${LIVE_BASE}/${meetId}/results.lxf`, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > 50) {
        const e = fromLenex(unzipLenex(buf), who);
        if (e) return { source: 'lenex', startlists: e.length, entries: e.map((x) => ({ ...x, pdf: `${LIVE_BASE}/${meetId}/StartList_${x.event}.pdf` })) };
      }
    }
  } catch { /* skús PDF */ }
  // 2) PDF štartovky
  const idx = await fetchMeetIndex(meetId);
  const evs = (idx?.events ?? []).filter((e) => e.start && !/štafet|stafet|relay|\dx\d/i.test(e.title));
  // iba ženské/dievčenské disciplíny, ak sa to dá z názvu určiť
  const girls = evs.filter((e) => !/\b(muži|chlapci|men|boys|žiaci\b)/i.test(e.title));
  const entries: StartEntry[] = [];
  const list = girls.length ? girls : evs;
  for (let i = 0; i < list.length; i += 6) {
    const part = list.slice(i, i + 6);
    const got = await Promise.all(part.map(async (e) => {
      try {
        const lines = await pdfLines(e.start!);
        const hit = lines && fromStartPdfText(lines, who);
        if (!hit) return null;
        const dm = e.title.match(/\b(50|100|200|400|800|1500)\s?m\b/);
        return {
          event: e.number, title: e.title, date: null, time: e.title.match(/\b\d{1,2}:\d{2}\b/)?.[0] ?? null,
          stroke: STROKE_WORDS.find(([r]) => r.test(e.title))?.[1] ?? null, distance: dm ? +dm[1] : null, pdf: e.start, ...hit,
        } as StartEntry;
      } catch { return null; }
    }));
    entries.push(...got.filter((x): x is StartEntry => !!x));
  }
  return { source: entries.length ? 'pdf' : 'none', startlists: evs.length, entries };
}
