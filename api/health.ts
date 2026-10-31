import type { VercelRequest, VercelResponse } from '@vercel/node';

// Jednoduchá kontrola stavu: dostupnosť zdroja výsledkov
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  let source: number | string = 'nedostupné';
  try {
    const r = await fetch('https://live.swimrankings.net/?nation=SVK', { method: 'HEAD' });
    source = r.status;
  } catch {}
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, source, time: new Date().toISOString() });
}
