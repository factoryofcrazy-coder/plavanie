import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchMeetLenex } from '../lib/splash.js';
import { fold } from '../lib/lenex.js';

// Diagnostika: rozparsuje Lenex bez zápisu (chránené kľúčom)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.CRON_SECRET || req.query.key !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Neplatný kľúč' });
  const id = parseInt(String(req.query.id ?? ''), 10);
  const p = await fetchMeetLenex(id);
  if (!p) return res.status(404).json({ error: 'Lenex nenájdený' });
  const q = fold(String(req.query.q ?? 'hodonova'));
  res.status(200).json({
    name: p.name, city: p.city, course: p.course, from: p.date_from, to: p.date_to,
    athletes: p.athletes.length, swims: p.swims.length,
    match: p.swims.filter((s) => s.athlete_key.includes(q)).slice(0, 30),
  });
}
