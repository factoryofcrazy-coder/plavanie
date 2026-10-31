import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ParsedMeet } from './lenex.js';
import { fetchMeetLenex } from './splash.js';
import { notifyMeet } from './push.js';

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
export const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export function clientForToken(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Overí, že token patrí editorovi */
export async function verifyEditor(token: string): Promise<SupabaseClient | null> {
  const c = clientForToken(token);
  const { data, error } = await c.auth.getUser(token);
  if (error || !data.user?.email) return null;
  const { data: ed } = await c.from('editors').select('email').ilike('email', data.user.email).maybeSingle();
  return ed ? c : null;
}

/** Prihlásenie servera ako admin (pre automatickú synchronizáciu) */
export async function adminClient(): Promise<SupabaseClient> {
  const c = anonClient();
  const { data, error } = await c.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
  });
  if (error || !data.session) throw new Error('Server sa nevedel prihlásiť ako admin: ' + (error?.message ?? ''));
  return clientForToken(data.session.access_token);
}

const chunk = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export async function saveMeet(db: SupabaseClient, meetId: number, meet: ParsedMeet) {
  const { error: me } = await db.from('meets').upsert({
    id: meetId,
    name: meet.name,
    city: meet.city,
    nation: meet.nation,
    course: meet.course,
    date_from: meet.date_from,
    date_to: meet.date_to,
    source: 'splash',
    imported_at: new Date().toISOString(),
  });
  if (me) throw new Error('meets: ' + me.message);

  const ids = new Map<string, number>();
  for (const part of chunk(meet.athletes, 400)) {
    const { data, error } = await db
      .from('athletes')
      .upsert(
        part.map((a) => ({ ...a, updated_at: new Date().toISOString() })),
        { onConflict: 'key' },
      )
      .select('id,key');
    if (error) throw new Error('athletes: ' + error.message);
    for (const r of data ?? []) ids.set(r.key, r.id);
  }

  const rows = meet.swims
    .filter((s) => ids.has(s.athlete_key))
    .map(({ athlete_key, ...s }) => ({ ...s, meet_id: meetId, athlete_id: ids.get(athlete_key)! }));
  // odstráň duplicity (rovnaká disciplína + pretekárka)
  const uniq = new Map<string, (typeof rows)[number]>();
  for (const r of rows) uniq.set(`${r.event_number}|${r.athlete_id}`, r);
  let saved = 0;
  for (const part of chunk([...uniq.values()], 500)) {
    const { error } = await db.from('swims').upsert(part, { onConflict: 'meet_id,event_number,athlete_id' });
    if (error) throw new Error('swims: ' + error.message);
    saved += part.length;
  }
  // historické časy, ktoré sú už v oficiálnych výsledkoch, sa zlúčia
  await db.rpc('dedupe_history');
  return { meet: meet.name, athletes: ids.size, swims: saved };
}

export async function importMeet(db: SupabaseClient, meetId: number) {
  const parsed = await fetchMeetLenex(meetId);
  if (!parsed) return { meetId, ok: false, reason: 'Výsledky (Lenex) pre tieto preteky zatiaľ nie sú zverejnené' };
  if (!parsed.swims.length) return { meetId, ok: false, reason: 'V súbore nie sú žiadne výsledky' };
  const r = await saveMeet(db, meetId, parsed);
  let push: unknown = null;
  try { push = await notifyMeet(db, meetId); } catch (e: any) { push = { error: e?.message }; }
  return { meetId, ok: true, ...r, push };
}
