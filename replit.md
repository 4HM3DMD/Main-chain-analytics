# ELA Whale Tracker

## Overview
A full-stack application that tracks the top 50 richest Elastos (ELA) wallets. Takes automated snapshots 3x daily (00:00, 08:00, 16:00 UTC) from the Elastos blockchain API and provides analytics, comparison, and historical tracking.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Recharts
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Scheduler**: node-cron for automated 3x daily snapshots
- **External API**: https://ela.elastos.io/api/v1/richlist

## Key Pages
- `/` - Dashboard: Live top 50 with stats, rank changes, balance changes
- `/history` - Calendar view of historical snapshots
- `/compare` - Side-by-side date comparison
- `/address/:addr` - Individual address detail with charts
- `/movers` - Biggest gainers/losers by period
- `/hall-of-fame` - All addresses ever tracked

## Project Structure
```
client/src/
  pages/          - All page components (dashboard, history, compare, etc.)
  components/     - Reusable components (sidebar, stat-card, rank-badge, etc.)
  lib/            - Utilities, theme provider, query client

server/
  db.ts           - Database connection
  storage.ts      - Storage interface with all CRUD operations
  routes.ts       - Express API routes
  services/
    fetcher.ts    - Richlist API fetcher with retry logic
    analyzer.ts   - Snapshot analysis (rank/balance changes)
    scheduler.ts  - Cron job scheduler
    seed-labels.ts - Known address labels seeding

shared/
  schema.ts       - Drizzle ORM schema (snapshots, entries, labels, summaries)
```

## API Endpoints
- GET /api/dashboard - Latest snapshot + stats
- GET /api/snapshots - Paginated snapshot list
- GET /api/snapshots/:id - Snapshot detail
- GET /api/compare?from=&to= - Compare two dates
- GET /api/address/:address - Address history
- GET /api/movers?period= - Biggest movers
- GET /api/hall-of-fame - All tracked addresses
- POST /api/snapshots/trigger - Manual snapshot
- GET /api/health - Server health

## Recent Changes
- 2026-02-06: Initial build with full frontend (6 pages) and backend
- Dark theme with Inter + JetBrains Mono fonts
- Real-time data from Elastos blockchain API
