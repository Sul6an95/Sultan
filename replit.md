# Rivox — Esports Match Tracker

A FotMob-inspired mobile-first esports results & scheduling app built with React + Express + PostgreSQL.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **Fonts**: Orbitron (display), Inter (body)
- **Theme**: Dark esports theme, primary purple `#6d28d9`

## Architecture
- `client/src/` — React frontend
  - `pages/` — Matches, News, Leagues, Following, Search
  - `components/layout/` — AppLayout, BottomNav
  - `components/matches/` — MatchCard, MatchDetailModal, FollowingBar
  - `hooks/` — use-matches, use-favorites
- `server/` — Express backend
  - `routes.ts` — API routes + database seeding
  - `storage.ts` — Database storage interface (with date filtering)
- `shared/schema.ts` — Drizzle schema + Zod types + API routes

## Features
1. **Matches Page** — FotMob-style match rows grouped by tournament; 5-day date tabs; game filter chips (All/VAL/CS2/Dota2/LoL/RL/PUBG); live badge with count; match detail bottom sheet with H2H, form, streams
2. **News Page** — 7 real esports articles (tournament results, transfers, sponsorships); category filters; article detail view
3. **Leagues Page** — Search leagues; Follow/Unfollow with localStorage persistence; 14 real esports leagues
4. **Following Page** — Teams grid with team brand colors + next match; Players list; tabs
5. **Search Page** — Real-time search against DB teams/players; filter chips; trending searches

## Database Seeding
On every startup `seedDatabase()` in `routes.ts` checks if match count < 12. If so:
- Clears all tables
- Seeds 6 games, 34 teams, 16 players
- Creates ~31 matches across yesterday/today/tomorrow/+2 days

## Key Design Decisions
- MatchCard: FotMob horizontal row style (logo-name | score | name-logo)
- Date filtering done in `storage.ts` by comparing UTC timestamps
- Team logos: Wikipedia PNGs for major teams, ui-avatars for others
- Following state stored in localStorage (teams: `favorites` key, leagues: `followed_leagues` key)
- Bottom nav: flat minimal tabs, 68px height
