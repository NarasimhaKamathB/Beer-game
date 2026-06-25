# Beer Game — Project Status

**Last updated:** 24 June 2026  
**Repo:** https://github.com/NarasimhaKamathB/Beer-game  
**Vercel:** https://beer-game.vercel.app (or check Vercel dashboard for exact URL)  
**Local path:** `C:\Users\narasimha.kamath\Documents\git\o9.Involve\beergame\`  
**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Realtime)  
**Supabase project:** Separate from Cake Game — create a new project at supabase.com  

---

## What is this?

A multiplayer Beer Distribution Game simulation for classroom/workshop use. 4 players per team play roles in a supply chain (Manufacturer → Distributor → Wholesaler → Retailer). Each week they place orders; costs accrue from holding inventory or running into backlog. The goal is to minimise total team cost while experiencing the Bullwhip Effect first-hand.

---

## Current Status: ✅ Live on Vercel

- Dev server: `npm run dev` → http://localhost:3000
- All screens implemented and rendering correctly
- Supabase schema + RPC deployed to a dedicated Beer Game Supabase project
- Tutorial animation complete and wired into lobby (`/tutorial.html` via `TutorialModal.tsx`)
- Stale session handling — home page verifies game existence before redirecting
- **Pushed to GitHub:** https://github.com/NarasimhaKamathB/Beer-game
- **Deployed to Vercel** with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars set

---

## File Structure

```
beergame/
├── app/
│   ├── page.tsx                     # Login / email entry (auto-assigns player)
│   ├── lobby/[gameId]/page.tsx      # Waiting room + tutorial button
│   ├── game/[gameId]/page.tsx       # Main game screen (ordering phase + summary)
│   ├── results/[gameId]/page.tsx    # Post-game results tabs
│   ├── admin/
│   │   ├── page.tsx                 # Admin dashboard (create games, config, start)
│   │   └── game/[gameId]/page.tsx   # Per-game admin controls
│   └── observer/page.tsx            # Projector-friendly live view
├── components/
│   ├── RolePanel.tsx                # Order input + stats for a player's role
│   ├── OrderTimer.tsx               # Countdown bar; turns green after submission
│   ├── WeeklySummary.tsx            # Round summary (own role only)
│   ├── SummaryTimer.tsx             # Auto-advance countdown after summary
│   ├── GameResults.tsx              # KPI cards + cost-by-role breakdown
│   ├── Analytics.tsx                # SVG charts: orders/inventory/backlog per role
│   ├── Leaderboard.tsx              # Cross-team ranking by total cost
│   ├── ObserverDashboard.tsx        # Grid of GameCards for observer view
│   ├── TutorialModal.tsx            # Fullscreen iframe modal wrapping tutorial.html
│   ├── TutorialVideoPlaceholder.tsx # Legacy placeholder (kept, not used)
│   └── ui/index.tsx                 # Shared primitives: Button, Card, Badge, Input, Spinner
├── lib/
│   ├── types.ts                     # All TypeScript interfaces + constants
│   ├── gameLogic.ts                 # Pure functions: createInitialGameState, processRound, getBotOrder
│   └── supabase.ts                  # All DB calls, Realtime subscriptions, admin actions
├── public/
│   └── tutorial.html                # Self-contained animated tutorial (~62s, 6 slides)
├── supabase/
│   ├── schema.sql                   # Run first: creates games + session_settings tables
│   └── assign_player_atomic.sql     # Run second: creates the concurrent-safe login RPC
├── .env.local                       # NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
├── .env.local.example               # Template (safe to commit)
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Supabase Setup (run once per new project)

1. Create a **new Supabase project** (separate from Cake Game — same table names would clash).
2. In **SQL Editor → New query**, run each file in this order:

| Order | File | Purpose |
|---|---|---|
| 1 | `supabase/schema.sql` | Creates `games` + `session_settings` tables, enables Realtime |
| 2 | `supabase/assign_player_atomic.sql` | Concurrent-safe player login RPC |
| 3 | `supabase/add_admin_password_self_start.sql` | Adds `admin_password` + `allow_self_start` columns |
| 4 | `supabase/cleanup_ended_games_trigger.sql` | Auto-deletes oldest ended games when count > 25 |

3. Copy your project URL and anon key into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

4. In Supabase **Database → Replication**, confirm `games` and `session_settings` are enabled under `supabase_realtime`.

---

## Key Design Decisions

### Steady-state start
`seed = demandSchedule[0]` (default: 4). All roles start with:
- `inventory = 3 × seed` (default: 12)
- `incomingOrder = seed`, `incomingShipment = seed`
- `shipmentPipeline = [seed]` (manufacturer: `[seed, seed]` for its 2-slot pipeline)

### Demand schedule
Facilitator enters a comma-separated list in admin (e.g. `4,4,4,4,8,8,8,8,8,8,8,8,8`). Stored in `config.demandSchedule`. All clients use the same pre-stored schedule — no client-side random generation, no divergence.

### Autonomous progression (no halting)
- `roundStartedAt` / `summaryStartedAt` timestamps stored in DB.
- Any client whose timer fires first calls `submitBotOrdersAndProcess` or `advanceToNextRound`.
- "First writer wins" guard: these functions re-fetch fresh state and abort if phase already advanced.
- Pause/resume: `pausedAt` + `totalPausedMs` accumulate across cycles; all timers subtract this offset.

### Concurrent login safety
`assign_player_atomic` Postgres RPC acquires a `FOR UPDATE` row lock on `session_settings`, serialising all concurrent logins. Teams fill completely (Manufacturer → Distributor → Wholesaler → Retailer) before the next team opens.

### Bot heuristic
```typescript
getBotOrder(rs) = rs.incomingOrder <= 0 ? 0 : Math.max(1, Math.round(rs.incomingOrder * Math.random()))
```
Intentionally noisy to preserve the Bullwhip Effect. Never returns 0 when demand > 0.

### Lead times
- Retailer / Wholesaler / Distributor: 1-week pipeline (`shipmentPipeline[0]` arrives next round).
- Manufacturer: 2-week production pipeline (`[0]` arrives next, `[1]` arrives in 2 rounds).

### Order validation
- Min: 0, Max: 100,000 (clamped on submit, yellow warning shown if exceeded).
- Manufacturer labels: "Production order" and "Production ready" instead of order/shipment language.

### Session stale-handling
`app/page.tsx` calls `getGame()` before redirecting from localStorage. Stale/deleted game → clears all `beergame_*` localStorage keys and stays on the login screen. Lobby page also clears on "game not found" and shows a friendly "Session expired" screen.

---

## GameConfig Interface

```typescript
interface GameConfig {
  totalRounds: number;            // default: 13
  holdingCostPerUnit: number;     // default: 0.5  ($0.50/unit/week)
  backlogCostPerUnit: number;     // default: 1.0  ($1.00/unit/week, 2× holding)
  demandSchedule: number[];       // facilitator-specified; length === totalRounds
  orderTimerSeconds: number;      // default: 30
  summaryTimerSeconds: number;    // default: 10
  autoAdvanceSummary: boolean;    // default: true
}
```

Default demand schedule: `[4, 4, 4, 4, 8, 8, 8, 8, 8, 8, 8, 8, 8]` (classic step change at week 5).

---

## GameState Interface

```typescript
interface GameState {
  phase: 'lobby' | 'onboarding' | 'ordering' | 'processing' | 'summary' | 'ended';
  currentRound: number;
  roles: Record<Role, RoleState>;
  playersDoneOrdering: string[];   // roles that submitted this round
  roundStartedAt: number | null;   // Unix ms — ordering timer origin
  summaryStartedAt: number | null; // Unix ms — summary timer origin
  paused: boolean;
  pausedAt: number | null;
  totalPausedMs: number;           // accumulated pause duration this round
}
```

---

## Screens & Routes

| Route | Who sees it | Purpose |
|---|---|---|
| `/` | Players | Email login → auto-assign role + team |
| `/lobby/[gameId]` | Players | Waiting room, role card, team slots, tutorial |
| `/game/[gameId]` | Players | Main game: order input, stats, summary |
| `/results/[gameId]` | Players | Post-game: Results / Analytics / Leaderboard tabs |
| `/admin` | Facilitator | Create games, config editor, start per-game, observer link |
| `/admin/game/[gameId]` | Facilitator | Pause/resume, skip summary, fill bots, reset, per-role roster |
| `/observer` | Projector | Dark live view: all teams, phases, costs, leaderboard |

---

## Tutorial (`/tutorial.html`)

Self-contained animated HTML (~62 seconds, 6 slides). Amber/beer colour palette. Opened via `TutorialModal.tsx` (fullscreen iframe). Features:
- Click overlay to start
- ⏸ Pause / ▶ Resume button
- `scaleToFit()` — scales 1280×720 canvas to any screen/mobile size
- Slide 1: Supply chain (4 roles pop in)
- Slide 2: Lead times (2-week manufacturer, 1-week others)
- Slide 3: Order flow upstream (orders ripple ← with delays)
- Slide 4: Bullwhip Effect (bar chart shows demand 4→8 amplifying upstream)
- Slide 5: Costs ($0.50 holding, $1.00 backlog, team total)
- Slide 6: Title card — "🍺 THE BEER GAME"

Tutorial is shown in:
- **Lobby page** — button launches the modal while waiting for game to start
- **Results page** — TODO: add button here too (next session)

---

## LocalStorage Keys (player browser)

| Key | Value |
|---|---|
| `beergame_player_id` | Sanitised email used as player ID |
| `beergame_game_id` | Supabase game row ID (e.g. `team_abc123`) |
| `beergame_role` | `manufacturer` / `distributor` / `wholesaler` / `retailer` |
| `beergame_team_name` | e.g. `Alpha Team` |
| `beergame_team_number` | Integer |
| `beergame_email` | Raw email |

All keys cleared on stale session detection or "Play again" from results screen.

---

## Known Working / Not Yet Done

### ✅ Working
- Full game loop: login → lobby → ordering → summary → … → results
- Autonomous timer progression (game never halts even if players go idle)
- Bot players fill any empty role on game start
- Admin: per-game ▶ Start, pause/resume, skip summary, fill bots, reset
- Admin: password gate (default `beergame2026`, stored in Supabase, changeable from admin UI); cached in `sessionStorage` for the browser session; "Lock" button to re-lock
- Admin: per-game 🗑 delete button with confirmation dialog
- Admin: `allowSelfStart` toggle — enables/disables player self-start from lobby
- Lobby: self-start card — "▶ Start game now" button when `allowSelfStart=true`; shows bot-fill progress messages and 💡 tooltip about 4 players / bots
- Observer projector view with live updates
- Analytics: SVG charts per role (orders, inventory, backlog)
- Leaderboard: ranks all ended games by total cost
- Tutorial animation (~62s, 6 slides) with pause/play, wired into lobby
- Mobile-responsive layouts
- Stale session handling (home page verifies game, clears localStorage if deleted)
- Postgres trigger `trg_cleanup_ended_games`: auto-deletes oldest ended game when count exceeds 25 (FIFO, active games never touched)
- TypeScript strict-mode clean (Vercel build passes)
- GitHub repo: https://github.com/NarasimhaKamathB/Beer-game
- Deployed to Vercel — auto-deploys on every push to `main`

### 🔜 Next steps (start here next session)
- Add tutorial button/modal to the results page
- End-to-end test with 4 human players across full 13 rounds
- Verify Bullwhip Effect is visible in Analytics charts after a real game
- Add RLS policies before making the Supabase project public/production
- Consider moving `processRound` to a Supabase Edge Function to eliminate the client-side race window
- Custom domain on Vercel (optional)

---

## Day Log — 25 June 2026

Changes made this session (in order):

| # | Change | Files |
|---|---|---|
| 1 | SQL migration — adds `admin_password` and `allow_self_start` columns to `session_settings` | `supabase/add_admin_password_self_start.sql` |
| 2 | `SessionSettings` type — added `adminPassword: string` and `allowSelfStart: boolean` | `lib/types.ts` |
| 3 | Supabase client — reads/writes both new fields | `lib/supabase.ts` |
| 4 | Admin password gate — `/admin` shows a lock screen; correct password unlocks and caches auth in `sessionStorage` for the browser session; "Lock" button re-locks | `app/admin/page.tsx` |
| 5 | Admin: allow self-start toggle — checkbox in Event Settings; updates Supabase immediately | `app/admin/page.tsx` |
| 6 | Admin: change password field — lets facilitator update the admin password from within admin (after logging in) | `app/admin/page.tsx` |
| 7 | Lobby: self-start card — when `allowSelfStart=true`, shows "▶ Start game now" button with bot-fill progress messages and a 💡 tooltip about 4 players / bots | `app/lobby/[gameId]/page.tsx` |
| 8 | Lobby: messaging — header changes to "Ready to play?" vs "Waiting for game to start" based on self-start setting; empty-slot count shown dynamically | `app/lobby/[gameId]/page.tsx` |

**Supabase migration required:** Run `supabase/add_admin_password_self_start.sql` in the Supabase SQL editor before deploying.

---

## Day Log — 25 June 2026 (continued)

| # | Change | Files |
|---|---|---|
| 9 | `deleteGame(gameId)` — new Supabase function to delete a single game | `lib/supabase.ts` |
| 10 | Per-game 🗑 delete button in admin Games list — confirm dialog before deleting | `app/admin/page.tsx` |
| 11 | Postgres trigger `trg_cleanup_ended_games` — fires on every game UPDATE; if phase just became 'ended' and total ended games > 25, deletes oldest ended game(s) until 25 remain. Active/lobby games never touched. | `supabase/cleanup_ended_games_trigger.sql` |
| 12 | Build fix — `subscribeToSessionSettings` callback missing `adminPassword` + `allowSelfStart` fields | `lib/supabase.ts` |

**Additional Supabase step required:** Run `supabase/cleanup_ended_games_trigger.sql` in Supabase SQL Editor to install the auto-cleanup trigger.

---

## Running Locally

```powershell
cd C:\Users\narasimha.kamath\Documents\git\o9.Involve\beergame
npm install        # first time only
npm run dev        # → http://localhost:3000
```

Admin: http://localhost:3000/admin  
Observer: http://localhost:3000/observer

---

## Deploying to Vercel

Already live. For a fresh deployment (e.g. new Vercel account):

1. Import https://github.com/NarasimhaKamathB/Beer-game in Vercel.
2. Root directory: `/` (repo root is already the Next.js app).
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Auto-deploys on every push to `main` thereafter.

---

## Day Log — 24 June 2026

Changes made this session (in order):

| # | Change | Files |
|---|---|---|
| 1 | Tutorial animation — 6-slide animated HTML (~62s), amber beer theme, pause/play, scaleToFit mobile | `public/tutorial.html` |
| 2 | TutorialModal component — fullscreen iframe wrapper with "Got it ✓" close + Escape key | `components/TutorialModal.tsx` |
| 3 | Wired tutorial into lobby — dark amber clickable banner replaces old placeholder | `app/lobby/[gameId]/page.tsx` |
| 4 | Stale session fix — home page calls `getGame()` before redirecting; clears localStorage if game deleted/ended | `app/page.tsx` |
| 5 | Lobby "game not found" — clears localStorage automatically, shows friendly "Session expired" screen | `app/lobby/[gameId]/page.tsx` |
| 6 | Smart redirect on home — routes to `/game/[id]` if ordering/summary, `/results/[id]` if ended | `app/page.tsx` |
| 7 | Wrote STATUS.md — full project context document for future sessions | `STATUS.md` |
| 8 | GitHub push — deleted old repo, recreated clean, pushed local code to `main` | git |
| 9 | Vercel deployment — connected GitHub repo, added env vars, deployed | Vercel |
| 10 | TypeScript build fix — `cfg as unknown as Record<string, unknown>` to satisfy strict mode | `app/admin/page.tsx` |
