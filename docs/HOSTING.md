# Hosting MEUT (cloud SaaS)

MEUT is designed as a **browser-only** product: you host the app; customers never download an Access runtime or local installer.

## Database

- **Provider:** Postgres via Prisma (`provider = "postgresql"`, `DATABASE_URL` from env).
- **Local:** use `docker compose up -d` (see `docker-compose.yml`) and the URL in `.env.example`. The old SQLite file `prisma/dev.db` may still exist on disk but is **not** used by the current schema.
- **Production:** Railway Postgres (or any managed Postgres). See **`docs/RAILWAY.md`**.

## Auth / env

- `NEXTAUTH_SECRET` — long random string
- `NEXTAUTH_URL` — public site URL
- `AUTH_TRUST_HOST=true` — required behind Railway / proxies
- `DATABASE_URL` — Postgres connection string

## Production sketch

1. Provision **Postgres** and set `DATABASE_URL`.
2. Deploy Next.js (Railway preferred path documented in `docs/RAILWAY.md`; Vercel/Fly also fine).
3. On start, MVP runs `npx prisma db push` then `npm start`. Prefer `prisma migrate deploy` once you commit migrations.
4. Optional: MDB import on a worker that has `mdbtools`, or drop legacy import after cutover.
5. Future: **Stripe** (or similar) maps subscription → `Organization.tier` instead of the Settings demo switcher.

## Security notes

- Never expose raw Prisma / SQL without `organizationId` filters.
- Session must include `organizationId`; detail routes use `findFirst({ where: { id, organizationId } })`.
- Username is globally unique today (simple login); email+org login can come later.
