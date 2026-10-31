import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listNationMeets } from '../lib/splash.js';
import { meetStartlist, type Who } from '../lib/entries.js';

export const config = { maxDuration: 60 };

const WHO: Who = { last: 'Hodoňová', first: 'Kristínka', year: 2013 };

// Verejné: najbližšie preteky a jej štarty zo štartových listín (cache na CDN)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.query.meet) {
      // test na konkrétnych pretekoch
      return res.json(await meetStartlist(parseInt(String(req.query.meet), 10), WHO, !!req.query.pdf));
    }
    const listed = (await listNationMeets('SVK')).filter((m) => m.status !== 'finished').slice(0, 6);
    const meets = await Promise.all(
      listed.map(async (m) => {
        try {
          return { ...m, ...(await meetStartlist(m.id, WHO)) };
        } catch (e: any) {
          return { ...m, source: 'none', startlists: 0, entries: [], error: e?.message };
        }
      }),
    );
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=7200');
    res.status(200).json({ updated: new Date().toISOString(), meets });
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? 'Chyba' });
  }
}
