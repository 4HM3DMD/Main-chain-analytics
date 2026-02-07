# ELA Whale Tracker

## Overview
A full-stack application that tracks the top 100 richest Elastos (ELA) wallets. Takes automated snapshots every 2 hours from the Elastos blockchain API and provides analytics, flow analysis, comparison, and historical tracking. ELA total circulating supply is ~28.22M with the Elastos API reporting totalBalances across all addresses.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + Recharts
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Scheduler**: node-cron for snapshots every 2 hours (12x daily)
- **External API**: https://ela.elastos.io/api/v1/richlist

## Key Pages
- `/` - Dashboard: Live top 100 with stats, concentration metrics, movement alerts
- `/flows` - Flow Analysis: Where is ELA going? Category breakdown, concentration, trends
- `/history` - Calendar view of historical snapshots
- `/compare` - Side-by-side date comparison
- `/address/:addr` - Individual address detail with charts
- `/movers` - Biggest gainers/losers by period
- `/hall-of-fame` - All addresses ever tracked

## Project Structure
```
client/src/
  pages/          - All page components (dashboard, flows, history, compare, etc.)
  components/     - Reusable components (sidebar, stat-card, rank-badge, etc.)
  lib/            - Utilities, theme provider, query client

server/
  db.ts           - Database connection
  storage.ts      - Storage interface with all CRUD operations
  routes.ts       - Express API routes
  services/
    fetcher.ts    - Richlist API fetcher with retry logic
    analyzer.ts   - Snapshot analysis (rank/balance changes)
    scheduler.ts  - Cron job scheduler (every 2 hours)
    seed-labels.ts - Known address labels seeding

shared/
  schema.ts       - Drizzle ORM schema (snapshots, entries, labels, summaries)
```

## API Endpoints
- GET /api/dashboard - Latest snapshot + stats
- GET /api/flows - Flow analysis (concentration, categories, trends, movements)
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
- 2026-02-06: Added Flows page with category breakdown pie charts, concentration analysis, balance trends
- 2026-02-06: Increased snapshot frequency from 3x daily to every 2 hours
- 2026-02-06: Added movement alerts and concentration stat cards to dashboard
- 2026-02-07: Expanded tracking from top 50 to top 100 wallets
- 2026-02-07: Fetcher now returns totalBalances from Elastos API for full supply context
- Dark theme with Inter + JetBrains Mono fonts
- Real-time data from Elastos blockchain API
- ELA API: https://ela.elastos.io/api/v1/richlist?page=1&pageSize=100 (returns richlist[], totalBalances, totalRichlist)
