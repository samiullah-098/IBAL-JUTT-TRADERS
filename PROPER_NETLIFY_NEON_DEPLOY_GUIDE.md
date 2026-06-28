# Iqbal Jutt Trader — Proper Stable Demo Deployment

This package is prepared for a stable legal demo without Cloudflare Tunnel.

## Required setup

Frontend + backend API will both deploy on Netlify:

- React frontend: Netlify static build
- Backend API: Netlify Functions at `/api/...`
- Database: Neon PostgreSQL

## 1. Create Neon database

1. Open Neon and create a free PostgreSQL project.
2. Copy the pooled connection string.
3. It must look like:
   `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`

## 2. Deploy to Netlify

Upload this project to GitHub, then create a Netlify site from GitHub.

Netlify build settings:

- Build command: `npm run build`
- Publish directory: `frontend/dist`
- Functions directory: `netlify/functions`

These are already configured in `netlify.toml`.

## 3. Add Netlify environment variable

In Netlify → Site settings → Environment variables, add:

`DATABASE_URL = your Neon PostgreSQL connection string`

Optional:

`NODE_ENV = production`

## 4. Deploy

Trigger deploy. During build it will run:

- backend install
- Prisma generate
- Prisma db push
- frontend build

## 5. Test

Open:

`https://YOUR-SITE.netlify.app/api/health`

Expected:

`{"status":"ok","message":"Yarn POS Backend is running"}`

Then open frontend and login:

- Username: admin
- Password: admin
- PIN: 1234

## Notes

- Cloudflare Tunnel is no longer needed.
- Client entries will save in Neon database.
- If you reset database from Settings, take a backup first.
- Free Neon has limits, but it is suitable for demo.
