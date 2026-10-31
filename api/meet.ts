import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchMeetIndex, listNationMeets } from '../lib/splash.js';

// Verejné: disciplíny pretekov s PDF odkazmi, alebo zoznam slovenských pretekov (?list=SVK)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.query.list) {
      const meets = await listNationMeets(String(req.query.list).toUpperCase().slice(0, 3));
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
      return res.status(200).json({ meets });
    }
    const id = parseInt(String(req.query.id ?? ''), 10);
    if (!id) return res.status(400).json({ error: 'Chýba číslo pretekov' });
    const index = await fetchMeetIndex(id);
    if (!index) return res.status(404).json({ error: 'Preteky sa nenašli' });
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.status(200).json(index);
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? 'Chyba pri čítaní live.swimrankings.net' });
  }
}
