import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminClient, importMeet } from '../lib/importer.js';
import { listNationMeets } from '../lib/splash.js';

export const config = { maxDuration: 60 };

// Automatická synchronizácia slovenských pretekov (Vercel cron raz denne)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.query.key ?? '');
  if (!secret || given !== secret) return res.status(401).json({ error: 'Neplatný kľúč' });

  const db = await adminClient();
  const listed = await listNationMeets('SVK');
  const { data: known } = await db.from('meets').select('id,date_to,imported_at');
  const knownMap = new Map((known ?? []).map((m: any) => [m.id, m]));
  const today = new Date();
  const recent = (d: string | null) => !d || today.getTime() - new Date(d).getTime() < 4 * 86400_000;

  const todo = listed
    .map((m) => m.id)
    .filter((id) => {
      const k: any = knownMap.get(id);
      return !k || recent(k.date_to); // nové alebo ešte prebiehajúce/čerstvé preteky
    });

  const extra = String(req.query.meets ?? '')
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => n > 999);

  const started = Date.now();
  const results: any[] = [];
  for (const id of [...extra, ...todo]) {
    if (Date.now() - started > 48_000) break;
    try {
      results.push(await importMeet(db, id));
    } catch (e: any) {
      results.push({ meetId: id, ok: false, reason: e?.message ?? String(e) });
    }
  }
  res.status(200).json({ listed: listed.length, tried: results.length, results });
}
