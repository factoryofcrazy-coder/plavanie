# Kristínka Hodoňová – plávanie

Osobná stránka plavkyne: osobné rekordy, vývoj a predikcie časov, porovnanie s konkurenciou, rebríček ročníka a PDF výsledky z pretekov.

- **Frontend:** React + Vite (Vercel)
- **Dáta:** Supabase (čítanie verejné, zápis iba admin)
- **Zdroj výsledkov:** Lenex súbory (`results.lxf`) zo Splash Meet Manager na live.swimrankings.net, ktoré zverejňuje SPF

## API (Vercel funkcie)
- `POST /api/import` – nahrá preteky (vyžaduje prihlásenie admina)
- `GET /api/sync` – denná automatická synchronizácia slovenských pretekov (Vercel cron, `CRON_SECRET`)
- `GET /api/meet?id=…` – disciplíny pretekov s odkazmi na PDF; `?list=SVK` zoznam pretekov

## Premenné prostredia
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CRON_SECRET`

## Nasadenie
Každý push do `main` sa automaticky nasadí na https://kristinka-plavanie.vercel.app
