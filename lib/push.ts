// Web Push upozornenia: nové výsledky a osobné rekordy po pretekoch
import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const STROKE: Record<string, string> = { FREE: 'VS', BACK: 'Z', BREAST: 'P', FLY: 'M', MEDLEY: 'PP' };
const fmt = (ms: number) => {
  const cs = Math.round(ms / 10), m = Math.floor(cs / 6000), s = Math.floor((cs % 6000) / 100), c = String(cs % 100).padStart(2, '0');
  return m ? `${m}:${String(s).padStart(2, '0')}.${c}` : `${s}.${c}`;
};

async function setup(db: SupabaseClient) {
  const [{ data: pub }, { data: priv }] = await Promise.all([
    db.from('settings').select('value').eq('key', 'vapid_public').maybeSingle(),
    db.from('secrets').select('value').eq('key', 'vapid_private').maybeSingle(),
  ]);
  const pk = process.env.VAPID_PUBLIC || pub?.value, sk = process.env.VAPID_PRIVATE || priv?.value;
  if (!pk || !sk) return false;
  webpush.setVapidDetails('mailto:admin@kristinka-plavanie.sk', pk, sk);
  return true;
}

export async function sendAll(db: SupabaseClient, payload: { title: string; body: string; url: string; tag?: string }) {
  if (!(await setup(db))) return { sent: 0, reason: 'chýbajú VAPID kľúče' };
  const { data: subs } = await db.from('push_subscriptions').select('endpoint,sub');
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s: any) => {
    try {
      await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 86400, urgency: 'normal' });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }));
  return { sent, total: subs?.length ?? 0 };
}

/** Po nahratí pretekov: ak pribudli Kristínkine štarty, pošli upozornenie (raz za každý nový výsledok) */
export async function notifyMeet(db: SupabaseClient, meetId: number) {
  const { data: st } = await db.from('settings').select('value').eq('key', 'main_athlete_key').maybeSingle();
  const { data: a } = await db.from('athletes').select('id').eq('key', st?.value ?? '').maybeSingle();
  if (!a) return null;
  const { data: mine } = await db.from('swims').select('id,stroke,distance,course,swim_ms,status,race_date,meets(name)').eq('athlete_id', a.id).eq('meet_id', meetId);
  if (!mine?.length) return null;
  const { data: prev } = await db.from('notified').select('swims').eq('meet_id', meetId).maybeSingle();
  if ((prev?.swims ?? 0) >= mine.length) return null;
  await db.from('notified').upsert({ meet_id: meetId, swims: mine.length, sent_at: new Date().toISOString() });

  const first = mine.map((s: any) => s.race_date).sort()[0];
  const { data: older } = await db.from('swims').select('stroke,distance,course,swim_ms').eq('athlete_id', a.id).lt('race_date', first).is('status', null).not('swim_ms', 'is', null);
  const bestBefore = new Map<string, number>();
  for (const s of older ?? []) {
    const k = `${s.stroke}${s.distance}${s.course}`;
    if (!bestBefore.has(k) || s.swim_ms! < bestBefore.get(k)!) bestBefore.set(k, s.swim_ms!);
  }
  const valid = mine.filter((s: any) => !s.status && s.swim_ms);
  const pbs = valid.filter((s: any) => { const b = bestBefore.get(`${s.stroke}${s.distance}${s.course}`); return b == null || s.swim_ms < b; });
  const line = (s: any) => {
    const b = bestBefore.get(`${s.stroke}${s.distance}${s.course}`);
    return `${s.distance} ${STROKE[s.stroke]} ${fmt(s.swim_ms)}${b && s.swim_ms < b ? ` (−${((b - s.swim_ms) / 1000).toFixed(2).replace('.', ',')})` : ''}`;
  };
  const name = (mine[0] as any).meets?.name ?? 'Preteky';
  const n = pbs.length;
  const title = n ? `${n === 1 ? 'Nový osobák' : `${n} ${n <= 4 ? 'osobáky' : 'osobákov'}`}! 🏊‍♀️` : 'Nové výsledky Kristínky';
  const body = `${name}: ${(n ? pbs : valid).slice(0, 4).map(line).join(' · ')}`;
  return sendAll(db, { title, body, url: '/preteky', tag: `meet-${meetId}` });
}
