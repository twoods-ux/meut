# M.E.U.T. — Medical Equipment User Tracking

Modern web CMMS for biomedical / clinical equipment maintenance.

**Product:** MEUT (display **M.E.U.T.**)  
**Full name:** Medical Equipment User Tracking

> **Heritage:** MEUT modernizes the workflows and data model of the former HarvestCEMS (Access 2000) application. Field names and processes (CM/PM work orders, control numbers, PM schedules, service contracts) follow that product’s operators’ manual and `tbl*` schema. This is a new stack — no Access runtime required.

Logo (blue): `public/meut-logo.png` — primary brand color **#4070D0**.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma + PostgreSQL (local via Docker Compose; production via Railway/managed Postgres)
- next-auth credentials + bcrypt

## Requirements (Windows 11)

1. [Node.js 20 LTS](https://nodejs.org/) (includes npm)
2. Optional (for importing a legacy Access data file): [mdbtools](https://github.com/mdbtools/mdbtools) (`mdb-export`) via WSL, or export CSVs first

## Quick start

```bat
cd path\to\modern
docker compose up -d
copy .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Postgres is required (`DATABASE_URL`). See `docker-compose.yml` and `docs/RAILWAY.md` for cloud deploy.

Open http://localhost:3000

### Demo logins

| Username       | Password   | Role       | Organization / scope              |
|----------------|------------|------------|-----------------------------------|
| `supervisor`   | `password` | SUPERVISOR | MEUT Demo                         |
| `tech`         | `password` | TECH       | MEUT Demo                         |
| `alex`         | `password` | TECH       | MEUT Demo                         |
| `customer`     | `password` | CUSTOMER   | Demo General Hospital (read-only) |
| `acme_admin`   | `password` | SUPERVISOR | Acme Clinical                     |

Customer portal: `/portal` (inventory + work orders for that facility only).

Sign up for a new tenant at `/signup`.

## Import legacy HarvestCEMS data

Supervisors can refresh MEUT from a live Access file without CLI access.

### Settings upload (recommended for Windows users)

1. Close HarvestCEMS so the database is not locked.
2. Copy `C:\Harvest Biomed Data\HarvestCEMSdata.mdb` (or your site path).
3. Sign in to MEUT as a **supervisor** → **License / Settings**.
4. Under **Import Access data**, choose the `.mdb` file and click **Import**.

The server saves the upload under `prisma/imports/` and upserts hospitals, departments, technicians, equipment, contracts, manufacturers, vendors, and work orders. Import **fails before changing data** if the file has more hospitals than your current license tier allows — upgrade the plan first (or switch to Enterprise in the demo tier switcher).

**Warning:** Import upserts from the Access file; HarvestCEMS remains source of truth until cutover.

### mdbtools requirement

Server-side import calls `mdb-export` (mdbtools). On this Linux/dev host it is already available. On Windows:

- Run MEUT where mdbtools is installed (WSL recommended: `sudo apt install mdbtools`), **or**
- Use the CLI from WSL against a copied `.mdb`, **or**
- Point the upload at a MEUT server that already has mdbtools (typical for shared/dev deployments).

### CLI (same shared importer)

```bat
npm run import:mdb -- --mdb "C:\path\to\HarvestCEMSdata.mdb"
```

Default path (this repo): `../data/HarvestCEMSdata.mdb`

Optional: `--skip-license` bypasses the facility-cap check (admin only). Demo users `supervisor` / `tech` remain available (`password`).

## Modules

| Module | Status |
|--------|--------|
| Login / roles / org signup | Done |
| Dashboard | Done |
| Equipment list + detail CRUD | Done |
| Facilities (hospitals + departments) | Done |
| Technicians CRUD + role | Done |
| CM work orders open / list / close | Done |
| PM generate for month / list / close | Done |
| Service contracts + warranty expirations | Done |
| Reports (summary + count by dept) | Partial — printable/Excel stubs |
| MDB import | Done (Settings upload + `npm run import:mdb`) |
| Parts used, PM procedure tasks, risk scoring | Stubbed / not in MVP |
| Printable WO forms | Stubbed |

- **Customer portal** — facility contacts (`CUSTOMER`) view inventory & work orders for their hospital only
## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production |
| `npm run db:push` | Apply Prisma schema to SQLite |
| `npm run db:seed` | Demo data |
| `npm run db:reset` | Wipe DB + reseed |
| `npm run import:mdb` | Import Access MDB via mdbtools |

## Data file

SQLite database: `prisma/dev.db` (created by `db:push`).

## Cloud SaaS model

MEUT is sold as a **hosted, browser-only** product:

- **You host** the Next.js app (and database). Customers only open a URL — **no customer download**, no Access runtime, no local install.
- Each paying customer is one **`Organization`** (tenant). All hospitals, equipment, work orders, users, contracts, and license tier data are scoped by `organizationId`.
- Session JWT includes `organizationId` + role; list/create/detail queries filter by that org so tenants cannot see each other’s data.
- Signup (`/signup`) creates an organization + first supervisor (default **Starter**, optional trial **Professional**).
- Seed includes platform demo org **MEUT Demo** plus **Acme Clinical** for isolation checks.
- Future production path: **Postgres** + Vercel/Railway + Stripe mapping subscriptions → `Organization.tier`. See `docs/HOSTING.md`.

## License tiers (sellable plans)

MEUT is sold by **facility (hospital) capacity** and **active user seats** **per organization**. Limits are defined in `src/lib/license.ts` and stored on `Organization.tier` (seed MEUT Demo: **Professional**).

| Plan | Facilities (hospitals) | Seats (active users) |
|------|------------------------|----------------------|
| **Starter** | Max **5** | Max **2** |
| **Professional** (Pro) | Max **10** | Max **5** |
| **Enterprise** | **Unlimited** | Max **30** |

- Creating a hospital past the facility cap is blocked (API + Facilities UI) with: *“Upgrade your MEUT plan to add more facilities.”*
- Creating or activating a user past the seat cap is blocked (API + Technicians UI) with: *“Upgrade your MEUT plan to add more user seats.”* Seat usage counts **active** users in the org only.
- Supervisors can open **License / Settings** (`/settings`) to view facility + seat usage for **their org**, compare tiers, and **demo-switch** the plan (no payment integration yet).
- MDB import requires the current user’s organization and checks hospital count against **that org’s** tier. Import does **not** enforce seat caps (legacy techs still import; enforce seats when creating/activating in the app).

## License

Internal / as provided by the project owner.
