// Parser pre Lenex (.lxf = zip s .lef XML) zo Splash Meet Manager
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';

export type Stroke = 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'MEDLEY';
export type Course = 'SCM' | 'LCM';

export interface ParsedAthlete {
  key: string;
  last_name: string;
  first_name: string;
  gender: 'F' | 'M';
  birth_year: number | null;
  club: string | null;
  nation: string | null;
  license: string | null;
}

export interface ParsedSwim {
  athlete_key: string;
  event_number: number;
  race_date: string;
  course: Course;
  stroke: Stroke;
  distance: number;
  swim_ms: number | null;
  status: string | null;
  points: number | null;
  reaction_ms: number | null;
  splits: { d: number; ms: number }[] | null;
  agegroup: string | null;
  club: string | null;
}

export interface ParsedMeet {
  name: string;
  city: string | null;
  nation: string | null;
  course: Course;
  date_from: string | null;
  date_to: string | null;
  athletes: ParsedAthlete[];
  swims: ParsedSwim[];
}

const arr = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function athleteKey(last: string, first: string, birthYear: number | null, gender: string): string {
  return `${fold(last)}|${fold(first)}|${birthYear ?? ''}|${gender}`;
}

/** "00:01:27.78" -> 87780 ms; "NT" -> null */
export function parseSwimTime(t: unknown): number | null {
  if (typeof t !== 'string') return null;
  const m = t.trim().match(/^(\d+):(\d+):(\d+)\.(\d+)$/);
  if (!m) return null;
  const frac = m[4].padEnd(3, '0').slice(0, 3);
  const ms = (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + +frac;
  return ms > 0 ? ms : null;
}

function parseReaction(r: unknown): number | null {
  if (r == null || r === '') return null;
  const n = parseInt(String(r).replace('+', ''), 10);
  return Number.isFinite(n) ? n * 10 : null; // Lenex: stotiny sekundy
}

function normCourse(c: unknown): Course | null {
  const s = String(c ?? '').toUpperCase();
  if (s === 'LCM') return 'LCM';
  if (s === 'SCM') return 'SCM';
  return null;
}

export function unzipLenex(buf: Uint8Array): string {
  // .lxf je zip; ak to nie je zip, berieme to ako XML
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(buf);
    const name = Object.keys(files).find((n) => /\.(lef|xml)$/i.test(n)) ?? Object.keys(files)[0];
    return strFromU8(files[name]);
  }
  return strFromU8(buf);
}

export function parseLenexXml(xml: string): ParsedMeet {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    parseTagValue: false,
    isArray: (name) =>
      ['MEET', 'SESSION', 'EVENT', 'AGEGROUP', 'RANKING', 'CLUB', 'ATHLETE', 'RESULT', 'SPLIT'].includes(name),
  });
  const doc = parser.parse(xml);
  const meet = arr(doc?.LENEX?.MEETS?.MEET)[0];
  if (!meet) throw new Error('Lenex neobsahuje žiadne preteky');

  const meetCourse = normCourse(meet.course);
  const events = new Map<
    string,
    { number: number; date: string; course: Course; stroke: Stroke; distance: number; relay: boolean }
  >();
  const resultAgegroup = new Map<string, string>();
  const dates: string[] = [];

  for (const session of arr<any>(meet.SESSIONS?.SESSION)) {
    const date = String(session.date ?? meet.startdate ?? '').slice(0, 10);
    if (date) dates.push(date);
    const sCourse = normCourse(session.course) ?? meetCourse ?? 'SCM';
    for (const ev of arr<any>(session.EVENTS?.EVENT)) {
      const ss = ev.SWIMSTYLE ?? {};
      const stroke = String(ss.stroke ?? '').toUpperCase() as Stroke;
      const relay = parseInt(ss.relaycount ?? '1', 10) > 1;
      events.set(String(ev.eventid), {
        number: parseInt(ev.number, 10),
        date,
        course: sCourse,
        stroke,
        distance: parseInt(ss.distance, 10),
        relay,
      });
      for (const ag of arr<any>(ev.AGEGROUPS?.AGEGROUP)) {
        const min = parseInt(ag.agemin ?? '-1', 10), max = parseInt(ag.agemax ?? '-1', 10);
        const label = ag.name || (min > 0 && max > 0 ? (min === max ? `${min} r.` : `${min}–${max} r.`) : min > 0 ? `${min}+ r.` : max > 0 ? `do ${max} r.` : 'Open');
        if (!label) continue;
        for (const r of arr<any>(ag.RANKINGS?.RANKING)) {
          if (r.resultid && !resultAgegroup.has(String(r.resultid))) resultAgegroup.set(String(r.resultid), label);
        }
      }
    }
  }

  const athletes = new Map<string, ParsedAthlete>();
  const swims: ParsedSwim[] = [];
  const validStrokes = new Set(['FREE', 'BACK', 'BREAST', 'FLY', 'MEDLEY']);

  for (const club of arr<any>(meet.CLUBS?.CLUB)) {
    const clubName: string | null = club.name ?? club.shortname ?? null;
    for (const a of arr<any>(club.ATHLETES?.ATHLETE)) {
      const gender = String(a.gender ?? '').toUpperCase();
      if (gender !== 'F' && gender !== 'M') continue;
      const birthYear = a.birthdate ? parseInt(String(a.birthdate).slice(0, 4), 10) || null : null;
      const last = String(a.lastname ?? '').trim();
      const first = String(a.firstname ?? '').trim();
      if (!last) continue;
      const key = athleteKey(last, first, birthYear, gender);
      if (!athletes.has(key)) {
        athletes.set(key, {
          key,
          last_name: last,
          first_name: first,
          gender,
          birth_year: birthYear,
          club: clubName,
          nation: a.nation ?? club.nation ?? null,
          license: a.license ? String(a.license) : null,
        });
      }
      for (const r of arr<any>(a.RESULTS?.RESULT)) {
        const ev = events.get(String(r.eventid));
        if (!ev || ev.relay || !validStrokes.has(ev.stroke) || !ev.distance || ev.distance > 1500) continue; // bez diaľkového plávania
        const status = r.status ? String(r.status).toUpperCase() : null;
        if (status === 'EXH') continue;
        const ms = parseSwimTime(r.swimtime);
        if (!status && !ms) continue;
        const splits = arr<any>(r.SPLITS?.SPLIT)
          .map((s) => ({ d: parseInt(s.distance, 10), ms: parseSwimTime(s.swimtime) ?? 0 }))
          .filter((s) => s.d > 0 && s.ms > 0)
          .sort((x, y) => x.d - y.d);
        swims.push({
          athlete_key: key,
          event_number: ev.number,
          race_date: ev.date,
          course: ev.course,
          stroke: ev.stroke,
          distance: ev.distance,
          swim_ms: status ? null : ms,
          status,
          points: r.points ? parseInt(r.points, 10) || null : null,
          reaction_ms: parseReaction(r.reactiontime),
          splits: splits.length ? splits : null,
          agegroup: resultAgegroup.get(String(r.resultid)) ?? null,
          club: clubName,
        });
      }
    }
  }

  // pri viacerých rozplavbách (prelim/finále) v tej istej disciplíne nechaj všetky – líšia sa číslom disciplíny
  dates.sort();
  return {
    name: String(meet.name ?? 'Preteky'),
    city: meet.city ?? null,
    nation: meet.nation ?? null,
    course: meetCourse ?? (swims[0]?.course ?? 'SCM'),
    date_from: dates[0] ?? (meet.startdate ? String(meet.startdate).slice(0, 10) : null),
    date_to: dates[dates.length - 1] ?? null,
    athletes: [...athletes.values()],
    swims,
  };
}
