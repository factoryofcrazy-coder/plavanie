import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminClient, verifyEditor } from '../lib/importer.js';
import { sendAll } from '../lib/push.js';

// DELETE {endpoint}: odhlásenie upozornení · POST {test:true}: skúšobné upozornenie (iba admin)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    if (req.method === 'DELETE') {
      if (typeof body.endpoint !== 'string') return res.status(400).json({ error: 'Chýba endpoint' });
      const db = await adminClient();
      await db.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'POST' && body.test) {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const db = token && (await verifyEditor(token));
      if (!db) return res.status(401).json({ error: 'Iba pre správcu' });
      return res.status(200).json(await sendAll(db, { title: 'Skúška upozornení', body: 'Takto príde správa po pretekoch, keď pribudnú výsledky.', url: '/', tag: 'test' }));
    }
    res.status(405).json({ error: 'Nepodporovaná metóda' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Chyba' });
  }
}
