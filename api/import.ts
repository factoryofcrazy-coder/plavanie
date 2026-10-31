import type { VercelRequest, VercelResponse } from '@vercel/node';
import { importMeet, verifyEditor } from '../lib/importer.js';

export const config = { maxDuration: 60 };

export function parseMeetIds(input: unknown): number[] {
  const raw = Array.isArray(input) ? input.join(' ') : String(input ?? '');
  const ids = new Set<number>();
  for (const m of raw.matchAll(/(?:swimrankings\.net\/)?(\d{4,6})/g)) ids.add(+m[1]);
  return [...ids];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Použi POST' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const db = token ? await verifyEditor(token) : null;
  if (!db) return res.status(401).json({ error: 'Na import sa treba prihlásiť ako admin' });

  const ids = parseMeetIds(req.body?.meets);
  if (!ids.length) return res.status(400).json({ error: 'Zadaj odkaz alebo číslo pretekov z live.swimrankings.net' });

  const started = Date.now();
  const results = [];
  for (const id of ids.slice(0, 15)) {
    if (Date.now() - started > 50_000) {
      results.push({ meetId: id, ok: false, reason: 'Nestihlo sa – spusti import znova' });
      continue;
    }
    try {
      results.push(await importMeet(db, id));
    } catch (e: any) {
      results.push({ meetId: id, ok: false, reason: e?.message ?? String(e) });
    }
  }
  res.status(200).json({ results });
}
