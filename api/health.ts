import type { VercelRequest, VercelResponse } from '@vercel/node';

// Diagnostika: overí, či sa server dostane na live.swimrankings.net a do Supabase
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const out: Record<string, unknown> = { node: process.version };
  const probe = async (name: string, url: string) => {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KristinkaPlavanie/1.0)' } });
      const body = await r.arrayBuffer();
      out[name] = { status: r.status, bytes: body.byteLength, type: r.headers.get('content-type') };
    } catch (e: any) {
      out[name] = { error: String(e?.message ?? e), cause: String(e?.cause?.code ?? e?.cause ?? '') };
    }
  };
  const probeUrl = String(req.query.probe ?? '');
  if (req.query.key === process.env.CRON_SECRET && /^https:\/\/(www\.)?swimmsvk\.sk\//.test(probeUrl)) {
    const r = await fetch(probeUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await r.text();
    const hits = new Set<string>();
    for (const m of html.matchAll(/[^"'\s<>]*(swimrankings|athleteId|iframe|widget)[^"'\s<>]*/gi)) hits.add(m[0].slice(0, 300));
    out.probe = { status: r.status, len: html.length, hits: [...hits].slice(0, 40) };
    return res.status(200).json(out);
  }
  await probe('live_index', 'https://live.swimrankings.net/?nation=SVK');
  await probe('meet_lxf', 'https://live.swimrankings.net/49857/results.lxf');
  try {
    const m = await import('../lib/splash.js');
    const idx = await m.fetchMeetIndex(49857);
    out.meet_index = idx ? { title: idx.title, events: idx.events.length, first: idx.events[0] } : null;
    if (req.query.key === process.env.CRON_SECRET) {
      const p = await m.fetchMeetLenex(49857);
      out.lenex = p ? { name: p.name, swims: p.swims.length, athletes: p.athletes.length, her: p.swims.filter((s) => s.athlete_key.startsWith('hodonova')) } : null;
    }
  } catch (e: any) {
    out.lib_error = String(e?.stack ?? e).slice(0, 800);
  }
  res.status(200).json(out);
}
