# MEUT Go-Live (temporary public tunnel)

**Public URL:** https://volumes-receiver-toolbar-activated.trycloudflare.com

This is a **Cloudflare quick tunnel** (`cloudflared tunnel --url http://127.0.0.1:3000`). The trycloudflare.com hostname changes if the tunnel process is restarted. For a stable production URL, deploy to Vercel, Railway, or a named Cloudflare tunnel.

## Runtime (as of go-live)

- Next.js: production (`npm run build && npm run start`) on `0.0.0.0:3000`
- `NEXTAUTH_URL` set to the public HTTPS URL above; `AUTH_TRUST_HOST=true`
- Tunnel: `/workspace/harvestcems/cloudflared` quick tunnel → port 3000

## Logins (password for all: `password`)

### MEUT Demo org (`meut-demo`, PROFESSIONAL)

| Username     | Role       | Notes |
|--------------|------------|-------|
| `supervisor` | SUPERVISOR | Staff dashboard (full access) |
| `tech`       | TECH       | Staff |
| `alex`       | TECH       | Staff |
| `bmet`       | TECH       | From MDB import |
| `tw`         | SUPERVISOR | From MDB import |
| `bg`         | TECH       | From MDB import |
| `customer`   | CUSTOMER   | Portal only; linked to **Coastal Bend Surgery Center** (view-only inventory + work orders) |

### Second tenant (`acme-clinical`, STARTER)

| Username     | Role       | Notes |
|--------------|------------|-------|
| `acme_admin` | SUPERVISOR | Separate org demo |

## Import summary

Source: `/workspace/harvestcems/data/HarvestCEMSdata.mdb`  
Command: `npm run import:mdb -- --mdb ... --org-slug meut-demo --skip-license`  
Import timestamp: 2026-09-18 ~11:10 AM CT

**Importer reported:** 5 hospitals, 28 departments, 3 technicians, 1028 equipment, 354 work orders (plus manufacturers upserted).

**meut-demo DB after import** (includes prior seed rows): ~7 hospitals, ~1002 equipment, ~357 work orders, ~31 departments.

Imported hospitals include Coastal Bend Surgery Center, Corpus Christi Endoscopy Center, Care Regional Medical Center, Five Star Sleep Center, Coastal Medical Clinic (plus seed Demo General / Northside).

## Verified

- Public `/login` returns 200 over HTTPS
- `supervisor` / `password` → session SUPERVISOR, dashboard loads
- `customer` / `password` → session CUSTOMER, `/portal/inventory` loads Coastal Bend data (view-only portal)

## Caveats

- Quick tunnel URL is ephemeral; do not bookmark as permanent.
- Schema is Postgres; local `prisma/dev.db` (SQLite) is leftover only. Production: see `docs/RAILWAY.md`.
- Change `NEXTAUTH_SECRET` before any real production deploy.
- If you restart only Next, keep the same `NEXTAUTH_URL`. If you restart cloudflared, update `.env` `NEXTAUTH_URL` to the new hostname and restart Next so auth cookies/callbacks match.
