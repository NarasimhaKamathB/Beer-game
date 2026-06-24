# Beer Game — Project Status

**Last updated:** June 2026  
**Repo:** https://github.com/NarasimhaKamathB/Beer-game  
**Local path:** `C:\Users\narasimha.kamath\Documents\git\o9.Involve\beergame\`  
**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Realtime)  
**Supabase project:** Separate from Cake Game — create a new project at supabase.com  

---

## What is this?

A multiplayer Beer Distribution Game simulation for classroom/workshop use. 4 players per team play roles in a supply chain (Manufacturer → Distributor → Wholesaler → Retailer). Each week they place orders; costs accrue from holding inventory or running into backlog. The goal is to minimise total team cost while experiencing the Bullwhip Effect first-hand.

---

## Current Status: ✅ Working locally

- Dev server: `cd beergame && npm run dev` → http://localhost:3000
- All screens implemented and rendering correctly
- Supabase schema + RPC deployed to a dedicated Beer Game Supabase project
- Tutorial animation complete (`/tutorial.html`)
- **Not yet pushed to GitHub or Vercel** — that is the next step from this session

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
2. In **SQL Editor → New query**, run `supabase/schema.sql`.
3. Run `supabase/assign_player_atomic.sql`.
4. Copy your project URL and anon key into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

5. In Supabase **Database → Replication**, confirm `games` and `session_settings` are enabled under `supabase_realtime`.

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
- Observer projector view with live updates
- Analytics: SVG charts per role (orders, inventory, backlog)
- Leaderboard: ranks all ended games by total cost
- Tutorial animation with pause/play
- Mobile-responsive layouts
- Stale session handling (cleared localStorage → clean login)

### 🔜 Next steps
- Add tutorial button to results page
- Push to GitHub: https://github.com/NarasimhaKamathB/Beer-game
- Deploy to Vercel (connect repo, add env vars)
- Add RLS policies before making public/production
- Consider moving `processRound` to a Supabase Edge Function to eliminate any client-side race window

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

1. Push to GitHub (next step below).
2. Import the repo in Vercel. Set root directory to `beergame`.
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. No build command changes needed — Next.js auto-detected.
