# Beer Game — Design Document

> **Status:** Pre-development design artifact. No code written yet.
> **Target repo:** https://github.com/NarasimhaKamathB/Beer-game (public)
> **Git email:** narasimha.kamath@gmail.com
> **Local code:** `C:\Users\narasimha.kamath\Documents\git\o9.Involve\beergame\`
> **Hosting:** Vercel (frontend + API routes) + Supabase (DB + Realtime)
> **Reference:** `beergame-archive/` (Expo/Firebase version, Involve 2026)
> **Sibling project:** `cakegame/` (Next.js 15 + Supabase + Tailwind — same stack to use here)

---

## 1. Overview

The Beer Game is a multiplayer supply chain simulation used in workshops and classrooms to demonstrate the **Bullwhip Effect** — how small demand fluctuations amplify into large order swings upstream. Four players each take one role in a supply chain (Retailer → Wholesaler → Distributor → Manufacturer), place weekly replenishment orders, and compete as a team to minimize total supply chain cost over N rounds.

Key simplifications vs. the archive's cake game sibling:
- **Only two cost types:** holding cost (excess inventory) + backlog cost (unfilled demand)
- **No product expiry** (no FIFO shelf-life tracking)
- **No lost-sales cost** (unmet demand becomes backlog, carried forward)

### Core Design Principle: The Game Always Runs to Completion

> **This directly fixes a known problem from the cake game, where an inactive player's browser could halt the entire game for their team.**

Once the admin starts a game, it runs autonomously to completion regardless of player activity. No round ever waits indefinitely for human input. Every timer that expires triggers automatic progression. The only deliberate halt is an explicit admin **pause**. This means:

- If all players are active and fast → game completes faster than the configured time budget.
- If some or all players go inactive → bot orders and auto-advance take over seamlessly.
- A game with `totalRounds = 13`, `orderTimerSeconds = 30`, `summaryTimerSeconds = 10` takes at most **13 × (30 + 10) = ~8.7 minutes** end-to-end, with or without any player input.

---

## 2. Game Rules

### 2.1 Roles & Supply Chain Structure

```
UPSTREAM ←————————————————————————————→ DOWNSTREAM

[Manufacturer] → [Distributor] → [Wholesaler] → [Retailer] → [Customer]

Orders flow:      ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
Goods flow:       →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
```

| Role | Supplies to | Orders from | Lead time |
|------|-------------|-------------|-----------|
| Retailer | End Customer | Wholesaler | 1 week |
| Wholesaler | Retailer | Distributor | 1 week |
| Distributor | Wholesaler | Manufacturer | 1 week |
| Manufacturer | Distributor | (own production) | 2 weeks |

### 2.2 Round Sequence (per week)

Each week, the following happens in order (all computed server-side atomically):

1. **Receive shipments** — each role receives goods that were in transit (front of their shipment pipeline)
2. **Receive demand** — Retailer gets random customer demand; upstream roles receive the order placed by their downstream partner last week
3. **Ship goods** — each role ships `min(inventory + received, demand + backlog)`. Any shortfall becomes new backlog.
4. **Update inventory** — `closing inventory = opening + received − shipped`
5. **Calculate costs** — `round cost = (closing inventory × holdingCost) + (backlog × backlogCost)`
6. **Advance pipelines** — each role's pipeline shifts; Manufacturer's 2-slot pipeline advances; this round's order enters slot [1]
7. **Players place orders** — each player decides how many units to order upstream (or produce, for Manufacturer)

### 2.3 Shipment Pipelines

- **Retailer / Wholesaler / Distributor:** 1-slot pipeline. What they order this week arrives next week.
- **Manufacturer:** 2-slot pipeline. What they "produce" this week arrives in 2 weeks.
- **Pipeline pre-seeding:** At game start, pipelines are seeded with the midpoint of the demand range so the chain doesn't starve on week 1.

### 2.4 Cost Formula

```
round_cost  = (closing_inventory × holding_cost_per_unit)
            + (backlog           × backlog_cost_per_unit)

total_cost += round_cost   (cumulative across all rounds)

team_cost   = sum of total_cost across all 4 roles
```

There is **no lost-sales cost** and **no expiry cost**.

### 2.5 Winning Condition

The team with the **lowest total team cost** at the end of all rounds wins. Cross-team leaderboard visible in admin and (optionally) projector view.

---

## 3. Default Game Configuration

All values are configurable by the admin before starting a game session.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `totalRounds` | 13 | Number of weeks to play |
| `holdingCostPerUnit` | $0.50 | Cost per unit of closing inventory per week |
| `backlogCostPerUnit` | $1.00 | Cost per unit of unmet demand per week |
| `startingInventory` | 12 | Each role's opening inventory at week 1 |
| `customerDemandMin` | 4 | Minimum random customer demand per week |
| `customerDemandMax` | 8 | Maximum random customer demand per week |
| `leadTime` | 1 | Weeks for goods to travel between roles (manufacturer uses 2) |
| `orderTimerSeconds` | 30 | Seconds players have to place their order; bot submits on expiry |
| `summaryTimerSeconds` | 10 | Seconds the round summary is displayed; auto-advances to next round on expiry |
| `autoAdvanceSummary` | `true` | If false, summary only advances on manual "Next Round" click (not recommended — risks game halt) |

**Demand mode:** Random uniform between `customerDemandMin` and `customerDemandMax` each week. (Facilitator can create a shock by editing `customerDemandMin` and `customerDemandMax` mid-game if desired — or configure a scripted step in a future enhancement.)

---

## 4. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 (App Router) | Same as cake game; Vercel-native |
| Styling | Tailwind CSS | Same as cake game |
| Database | Supabase (PostgreSQL + JSONB) | Same as cake game; Realtime subscriptions for live sync |
| Realtime | Supabase Realtime | Push round-state updates to all players instantly |
| Auth | None (email auto-assign, no passwords for players) | Same pattern as archive + cake game |
| Hosting | Vercel | Auto-deploy from GitHub |
| Repo | GitHub — NarasimhaKamathB/Beergame (public) | New public repo |
| Language | TypeScript | Throughout |

---

## 5. Project Structure

```
beergame/
├── app/
│   ├── page.tsx                        # Landing / login (email → auto-assign)
│   ├── assigned/page.tsx               # Role assignment reveal + lobby wait
│   ├── lobby/[gameId]/page.tsx         # Pre-game lobby (waiting for all 4 players)
│   ├── game/[gameId]/page.tsx          # Main player game UI (order, summary, timer)
│   ├── results/[gameId]/page.tsx       # End-of-game results + analytics
│   ├── admin/
│   │   ├── page.tsx                    # Admin dashboard (all teams, leaderboard, config)
│   │   └── game/[gameId]/page.tsx      # Per-game detail + controls
│   └── observer/page.tsx              # Read-only projector/observer view (all teams live)
├── components/
│   ├── RolePanel.tsx                   # Per-player round UI (inventory, demand, cost, order input)
│   ├── WeeklySummary.tsx               # Post-round modal (material flow + cost breakdown)
│   ├── GameResults.tsx                 # Final analytics dashboard
│   ├── Analytics.tsx                   # Inline charts (inventory, orders, costs over time)
│   ├── OrderTimer.tsx                  # Countdown bar for ordering phase; auto-submits bot order on expiry
│   ├── SummaryTimer.tsx               # Countdown bar for summary phase; auto-advances to next round on expiry
│   ├── LeaderBoard.tsx                 # Live cross-team cost ranking
│   ├── ObserverDashboard.tsx           # Multi-team live view for projector
│   └── ui/                            # Button, Card, Badge, Input primitives (Tailwind)
├── lib/
│   ├── types.ts                        # All TypeScript types + DEFAULT_CONFIG
│   ├── gameLogic.ts                    # Pure, deterministic round processing
│   └── supabase.ts                     # DB calls + Realtime helpers + autoAssignPlayer RPC
├── supabase/
│   ├── schema.sql                      # Full DB schema (run once on new project)
│   ├── assign_player_atomic.sql        # Atomic sign-in RPC (prevents race conditions)
│   └── rls_policies.sql               # Row-level security policies
└── public/
    └── (static assets)
```

---

## 6. Database Schema

### 6.1 Tables

#### `session_settings` (single row per deployment)
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
registration_open   boolean DEFAULT true
event_name          text DEFAULT 'Beer Game'
config              jsonb  -- GameConfig (overrides defaults for this event)
created_at          timestamptz DEFAULT now()
```

#### `games`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
code        text UNIQUE NOT NULL          -- 6-char join code (shown in admin)
host_id     text                          -- admin identifier
config      jsonb NOT NULL               -- GameConfig snapshot for this game
players     jsonb NOT NULL DEFAULT '{}'  -- Record<playerId, Player>
state       jsonb NOT NULL               -- GameState (phase, currentRound, roles, playersDoneOrdering)
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()
```

All game state lives in JSONB (same pattern as cake game). This keeps updates atomic and avoids complex relational joins for real-time state.

### 6.2 Key TypeScript Types

```typescript
type Role = 'retailer' | 'wholesaler' | 'distributor' | 'manufacturer';

type GamePhase =
  | 'lobby'        // waiting for all 4 players
  | 'onboarding'   // game started, players reading rules
  | 'ordering'     // players placing orders this round
  | 'processing'   // server computing round results
  | 'summary'      // showing round summary before next order
  | 'ended';       // all rounds complete

interface RoleState {
  inventory: number;           // closing inventory after this round
  backlog: number;             // unfilled demand carried forward
  incomingOrder: number;       // demand received from downstream
  outgoingOrder: number;       // order placed to upstream (player input)
  incomingShipment: number;    // goods received from upstream
  outgoingShipment: number;    // goods shipped to downstream
  roundCost: number;
  totalCost: number;
  orderPlaced: boolean;
  shipmentPipeline: number[];  // goods in transit; [0] arrives next round
  // History arrays (one entry per completed round):
  orderHistory: number[];
  inventoryHistory: number[];
  backlogHistory: number[];
  costHistory: number[];
  receivedHistory: number[];
  shippedHistory: number[];
  demandHistory: number[];
}

interface GameConfig {
  totalRounds: number;
  holdingCostPerUnit: number;
  backlogCostPerUnit: number;
  startingInventory: number;
  customerDemandMin: number;
  customerDemandMax: number;
  leadTime: number;              // weeks (manufacturer always uses leadTime + 1)
  orderTimerSeconds: number;     // seconds players have to place an order; default 30
  summaryTimerSeconds: number;   // seconds the round summary is shown before auto-advancing; default 10
  autoAdvanceSummary: boolean;   // if true, summary auto-dismisses after summaryTimerSeconds; default true
  // Note: autoSubmitOrder is always true — this is a core design guarantee, not optional
}

interface Player {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  isAdmin: boolean;
  joinedAt: number;
  teamName?: string;
  teamNumber?: number;
}

interface GameState {
  phase: GamePhase;
  currentRound: number;
  roles: Record<Role, RoleState>;
  playersDoneOrdering: string[];  // role names that have submitted this round
  paused: boolean;                // facilitator pause — freezes all timers
  roundStartedAt: number | null;  // Unix ms when ordering phase began (for timer sync on reconnect)
  summaryStartedAt: number | null;// Unix ms when summary phase began (for summary countdown sync)
}

interface Game {
  id: string;
  code: string;
  hostId: string;
  config: GameConfig;
  players: Record<string, Player>;
  state: GameState;
  createdAt: number;
}
```

### 6.3 Supabase RPC: `assign_player_atomic`

Same pattern as cake game — a Postgres function that atomically:
1. Looks up a pre-registered email in `games.players`
2. Creates the player record if found
3. Returns `{ playerId, gameId, role, teamName, teamNumber }`
4. Throws if email not found or registration is closed

---

## 7. Game Logic (Pure Functions — `lib/gameLogic.ts`)

### `processRound(state, config, orders) → GameState`

The core pure function. Called server-side (in a Next.js API route or Supabase Edge Function) when all 4 players have submitted orders.

**Algorithm:**

```
1. Generate customerDemand = random(config.customerDemandMin, config.customerDemandMax)

2. For each role:
   received[role] = shipmentPipeline[role][0]   // front of queue

3. incomingOrders:
   retailer     ← customerDemand
   wholesaler   ← orders.retailer
   distributor  ← orders.wholesaler
   manufacturer ← orders.distributor

4. For each role:
   available      = inventory + received
   effectiveDemand = incomingOrder + backlog
   outgoingShipment = min(available, effectiveDemand)
   inventory      = available − outgoingShipment
   backlog        = max(0, effectiveDemand − available)
   roundCost      = inventory × holdingCost + backlog × backlogCost
   totalCost     += roundCost
   append to all history arrays

5. Advance pipelines:
   retailer.pipeline    = [wholesaler.outgoingShipment]
   wholesaler.pipeline  = [distributor.outgoingShipment]
   distributor.pipeline = [manufacturer.outgoingShipment]
   manufacturer.pipeline = [pipeline[1], orders.manufacturer]

6. currentRound++
   phase = currentRound >= totalRounds ? 'ended' : 'summary'
```

### `createInitialGameState(config) → GameState`

Seeds all roles with `startingInventory` and pre-fills pipelines with `round((min+max)/2)` to prevent week-1 starvation.

### `getOptimalOrder(roleState) → number` (hint only, shown to player)

Simple heuristic: `max(0, incomingOrder + backlog − inventory + safetyStock)` where `safetyStock = 4`. Shown as a suggested order — players can override.

---

## 8. Concurrency & Race Condition Handling

### 8.1 Player Login / Team Assignment Race Condition

**Problem:** Multiple players can hit "Join" at the same instant. Without a lock, two players could both be assigned the same team slot or the same role.

**Solution: `assign_player_atomic` Postgres RPC**

All assignment logic runs inside a single Postgres transaction with `FOR UPDATE` row locking on the `games` table. No two concurrent calls can read-then-write the same game row simultaneously.

**Team-fill algorithm (enforced inside the RPC):**

1. Load all existing games sorted by `team_number` ascending.
2. Find the **first game with a vacant role slot** — i.e., fewer than 4 players assigned.
3. Within that game, assign the player to the **first unfilled role** in the fixed order: `manufacturer → distributor → wholesaler → retailer`.
4. Only when all 4 roles in a game are filled does the next incoming player start filling the **next team**.
5. If no game with a vacant slot exists, either:
   - Create a new game row (if registration is open and admin has pre-created team rows), or
   - Return an error ("no available slots").

This guarantees:
- One player per role per team (no double-booking).
- Teams fill completely before the next team opens.
- Concurrent logins from 4 players simultaneously each land in a different role of the same team.

```sql
-- Pseudocode of the RPC logic
BEGIN;
SELECT id FROM games WHERE jsonb_array_length(players) < 4 ORDER BY team_number LIMIT 1 FOR UPDATE;
-- assign role = first of [manufacturer, distributor, wholesaler, retailer] not yet in players
-- write player into games.players
-- return assignment
COMMIT;
```

### 8.2 Order Submission Race Condition

**Problem:** All 4 players (or bots) submit orders independently; the last submission must trigger `processRound` exactly once.

**Solution:**

1. Each player's submission writes `{ orderPlaced: true, outgoingOrder: N }` to their role in `games.state.roles` and appends their role to `playersDoneOrdering`.
2. If `playersDoneOrdering` now contains all 4 roles, that client also atomically sets `phase = 'processing'`.
3. Only the client that successfully transitions to `phase = 'processing'` (Supabase optimistic write — first writer wins) calls `processRound` and writes the new full state.
4. All other clients see `phase === 'processing'` on their Realtime update and skip — they wait for the completed state to be pushed.

This prevents double-processing without a server-side queue.

---

## 9. Screens & User Flows

### 9.1 Player Flow

```
Landing page (/)
  └─ Enter email → autoAssignPlayer RPC
       ├─ Error: email not found / registration closed → error message
       └─ Success → /assigned?gameId=X&playerId=Y&role=Z
            └─ Role reveal card (shows all 4 roles, player's role highlighted)
                 └─ "Continue to Lobby" button → /lobby/[gameId]

/lobby/[gameId]  (pre-game waiting room)
  ├─ Team roster card — 4 role slots with player names (filled) or "— waiting" (empty)
  ├─ VIDEO PLACEHOLDER — full-width card with "▶ Tutorial Coming Soon" message +
  │    thumbnail area. Component: <TutorialVideoPlaceholder />.
  │    When video is ready, swap for <TutorialModal /> following the pattern in
  │    cakegame/components/TutorialModal.tsx + cakegame/public/tutorial.html.
  │    (62s animated tutorial, 6 slides, scale-to-fit for any screen size.)
  └─ "Waiting for admin to start the game..." status badge
       └─ Admin clicks "Start All Games" → all lobbies transition → /game/[gameId]

/game/[gameId]  (main gameplay loop)
  ├─ Phase: ordering
  │    ├─ RolePanel: inventory, backlog, demand, received, shipped, cost, order input
  │    ├─ OrderTimer: countdown bar (configurable seconds, default 30s)
  │    ├─ BEFORE submit: order input field + "Submit Order" button
  │    └─ AFTER submit: "✓ Order submitted (X units) — waiting for others" banner
  │         ├─ Shows how many of 4 roles have submitted (e.g., "2 / 4 submitted")
  │         ├─ Order input and button are disabled/hidden once submitted
  │         └─ Timer continues counting down (bot fills any unsubmitted roles on expiry)
  ├─ Phase: summary (after all 4 orders collected)
  │    └─ WeeklySummary modal: material flow + cost breakdown for this role
  │         ├─ Countdown bar: "Next round in Xs" (config.summaryTimerSeconds, default 10s)
  │         ├─ "Next Round →" button: any player can click to advance early
  │         └─ At T=0: auto-advances to ordering phase (no click required)
  └─ Phase: ended → /results/[gameId]

/results/[gameId]
  └─ Full analytics dashboard (see Section 10)
```

### 9.2 Admin Flow

```
Landing page (/)
  └─ "Admin Login" button → password modal → /admin

/admin  (dashboard)
  ├─ Session config panel (edit GameConfig, event name, registration toggle)
  ├─ Stats row: teams, players, full teams, incomplete count
  ├─ "Start All Games" button (sends all lobby games to onboarding)
  ├─ Tabs:
  │    ├─ Incomplete Teams — teams missing roles, with "Add Player Manually" action
  │    ├─ All Teams — team cards with phase badge, round, cost, reset buttons
  │    └─ Leaderboard — live ranking by team total cost
  └─ Per-team card → /admin/game/[gameId]
       ├─ All 4 roles' current state
       ├─ Pause / Resume round timer toggle
       ├─ Force advance round (override all orders)
       ├─ Reset values (keep players, reset game state)
       └─ Remove all players (full reset)
```

### 9.3 Observer / Projector Flow

```
/observer  (read-only, no auth)
  └─ Live view of all active games:
       ├─ Leaderboard (ranked by team cost, updates live)
       ├─ Per-team supply chain visualization:
       │    └─ Each role's current inventory (bar), backlog, last order, cost
       └─ Current round / total rounds progress
```

---

## 10. Bot Players (Incomplete Teams)

If a team does not have all 4 human players at game start (or a player disconnects), **bot players** fill the missing roles automatically.

### 10.1 When Bots Are Used

- Admin can start a game even if some roles in a team are unfilled (via "Start All Games").
- Any role without a human player is automatically marked as a **bot** for that game.
- Bots are also used when the order timer expires and a human hasn't submitted — the bot submits on their behalf.

### 10.2 Bot Order Strategy

Bots use the same heuristic as the archive's `getOptimalOrder`:

```
botOrder = max(0, incomingOrder + backlog − inventory + safetyStock)
where safetyStock = 4
```

This is intentionally simple (not optimal) — it still produces the Bullwhip Effect and teaches the lesson. Bot orders are submitted programmatically at timer expiry on the client whose timer fires first (same race-condition guard applies — only one client processes the round).

### 10.3 Bot Player Record

A bot player is stored in `games.players` with `isBot: true`:

```typescript
interface Player {
  id: string;
  name: string;        // e.g. "Bot (Wholesaler)"
  email: string;       // e.g. "bot-wholesaler@beergame.internal"
  role: Role | null;
  isAdmin: boolean;
  isBot: boolean;      // NEW — true for auto-filled roles
  joinedAt: number;
  teamName?: string;
  teamNumber?: number;
}
```

Bot players are visually indicated in the admin panel (e.g., "🤖 Bot (Wholesaler)") and in the team roster shown in the lobby.

### 10.4 Admin Controls for Bots

- Admin can manually replace a bot with a real player at any time via "Add Player Manually" in the admin panel — same as the archive's flow.
- If a real player joins after a bot has been playing, the bot is removed and the human takes over from the current game state (no round replay).

---

## 11. Order Submission UX

### 11.1 States of the Order Input

The order input area in `RolePanel` cycles through three visual states each round:

| State | Trigger | UI |
|-------|---------|-----|
| **Idle / waiting** | Round hasn't started yet | "Waiting for the round to begin..." grey box |
| **Active / ordering** | `phase === 'ordering'` and player hasn't submitted | Order input field + "Submit Order" button + countdown timer bar |
| **Submitted / waiting for others** | Player has submitted their order | "✓ Order submitted (X units) — waiting for others" green banner + submission count badge |

### 11.2 "Waiting for Others" Banner

After a player submits:
- The order input and submit button are replaced by a confirmation banner.
- The banner shows: `✓ Order submitted (X units) — waiting for others to submit (Y / 4)`
- The submission count `Y` updates live via Realtime as teammates submit.
- The timer continues counting down — when it reaches zero, any unsubmitted roles are auto-filled by bot logic and the round processes.
- If all 4 submit before the timer expires, the round processes immediately.

### 11.3 Timer Behaviour

- Timer starts when `phase` transitions to `ordering` (Realtime event).
- Displayed as a progress bar that drains from full → empty over `config.orderTimerSeconds`.
- At 10 seconds remaining: bar turns red, label changes to "⚠ Auto-submitting in Xs".
- At 0 seconds: any role that hasn't submitted gets a bot order applied automatically.
- If `GameState.paused === true`: timer freezes on all clients; bar shows "⏸ Paused by facilitator".
- Timer state (seconds remaining) is kept in React component state only — not persisted in DB. On reconnect, the client re-derives remaining time from the round's start timestamp (store `roundStartedAt: number` in `GameState`).

### 11.4 `roundStartedAt` in GameState

To allow reconnecting clients to sync their timer:

```typescript
interface GameState {
  // ... existing fields ...
  paused: boolean;
  roundStartedAt: number | null;  // Unix ms timestamp when ordering phase began
}
```

Client calculates: `secondsElapsed = (Date.now() − roundStartedAt) / 1000`  
Then: `secondsRemaining = max(0, config.orderTimerSeconds − secondsElapsed)`

Same pattern for summary: `summarySecondsRemaining = max(0, config.summaryTimerSeconds − (Date.now() − summaryStartedAt) / 1000)`

---

## 11A. Autonomous Game Progression

> **This is the most important operational guarantee of the game. Read carefully before implementing.**

### Problem Being Solved

In the cake game, an inactive player's browser could stall the entire game for their team indefinitely, because:
- The round waited for all players to click "Submit" (no hard timeout)
- The round summary waited for someone to click "Next Round" (no auto-advance)

This meant a facilitator had to manually intervene if any player went idle. The Beer Game eliminates this entirely.

### Guarantee

**Once the admin clicks "Start All Games", every game will run to completion on its own, taking at most `totalRounds × (orderTimerSeconds + summaryTimerSeconds)` seconds, with no human intervention required.**

### Full Round Lifecycle (Autonomous)

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase: ordering                                                 │
│  Duration: up to config.orderTimerSeconds (default 30s)         │
│                                                                  │
│  • Players see order input + countdown bar                       │
│  • Each player who submits → "✓ Submitted, waiting for others"  │
│  • If ALL 4 submit early → immediately advance (don't wait)     │
│  • At T=0: bot submits heuristic order for any missing roles    │
│  • Phase transitions to 'processing' → then 'summary'           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase: summary                                                  │
│  Duration: config.summaryTimerSeconds (default 10s)             │
│                                                                  │
│  • Players see WeeklySummary (material flow + cost breakdown)   │
│  • Countdown shown: "Next round in Xs"                          │
│  • Player can click "Next Round →" to advance early             │
│  • If admin paused: countdown freezes, shows "⏸ Paused"        │
│  • At T=0 (or on click): phase transitions to 'ordering'        │
│  • If this was the last round: transitions to 'ended'           │
└──────────────────────────┬──────────────────────────────────────┘
                           │  (repeat for totalRounds)
                           ▼
                      Phase: ended
                      → redirect to /results/[gameId]
```

### Who Triggers the Transition: Summary → Ordering

Exactly one client triggers `phase = 'ordering'` when the summary timer expires. To prevent multiple clients firing simultaneously (same race condition as order submission):

1. When summary phase begins, write `summaryStartedAt` timestamp to DB.
2. Each client independently runs a local countdown derived from `summaryStartedAt`.
3. The **first client whose countdown reaches zero** attempts to write `phase = 'ordering'` with an optimistic update that only succeeds if `phase` is still `'summary'`.
4. Only one write wins; all others are no-ops.
5. All clients receive the Realtime update and transition to ordering.

> This is identical to how `processRound` is triggered: the first client to complete the transition wins, all others follow via Realtime.

### Pausing Suspends, Not Cancels

When admin pauses:
- `GameState.paused = true` is written to DB.
- All clients freeze their local countdown (store elapsed time at pause moment).
- Timer bar shows "⏸ Paused by facilitator".
- When admin resumes (`paused = false`), clients resume from the stored elapsed time — the timer does not reset.
- `summaryStartedAt` and `roundStartedAt` are NOT updated on pause/resume. Instead, clients track `totalPausedMs` locally and subtract it: `elapsed = (Date.now() − startedAt) − totalPausedMs`.

### Background-Tab / Reconnect Safety

If a player's browser goes to the background (phone locks, tab switches):
- JavaScript `setInterval` timers may slow or pause in background tabs.
- **This must not block progression** — other clients' timers continue running.
- The first of the 4 clients whose timer fires will trigger the transition.
- On reconnect/foreground, the client re-derives elapsed time from `roundStartedAt` / `summaryStartedAt` and either immediately fires the transition (if time has passed) or resumes the countdown from the correct remaining time.

This is the key fix over the cake game: **no single client is the designated "timer owner"**. Any of the 4 (or even bot logic on the server) can fire the transition.

### Maximum Game Duration

With default config:
```
max duration = totalRounds × (orderTimerSeconds + summaryTimerSeconds)
             = 13 × (30 + 10)
             = 520 seconds
             ≈ 8 minutes 40 seconds
```

This is the hard ceiling. In practice games will complete faster when players are active.

---

## 12. Analytics & Results Screen (`/results/[gameId]`)

### KPI Cards (top row)
- Total Supply Chain Cost (`$X,XXX.XX`)
- Order Fulfillment Rate (`XX.X%`) — shipped / demanded across all roles
- Bullwhip Effect Ratio — `stdDev(manufacturer orders) / stdDev(customer demand)`
- Inventory Turnover — total shipped / average inventory across roles

### Charts
1. **Bullwhip Effect Analysis** (line chart) — customer demand + all 4 roles' order histories overlaid. Visually shows amplification upstream.
2. **Role Performance Radar** — 4 axes (one per role), 3 metrics each: Order Fulfillment, Stock Management, Cost Efficiency.
3. **Weekly Analysis** (line chart) — total inventory, total backlog, cumulative cost over time.

### Weekly Performance Table
- Tab selector: Week 1 … Week N
- Columns per role: Opening Stock, Receipts, Demand, Shipment, Backlog, Closing Stock, Orders, Cost

### Detailed Statistics Table
- Per role: Total Cost, Avg Inventory, Avg Backlog, Order Variance, Fulfillment Rate, Stock-Out %

### Bullwhip Insight Box
Educational callout explaining the Bullwhip Effect observed in this game run.

---

## 13. Admin Game Configuration (Editable Fields)

The admin config panel in `/admin` allows editing these before starting games:

| Field | UI Element | Notes |
|-------|-----------|-------|
| Event name | Text input | Shown on landing page hero |
| Total rounds | Number input | Min 5, max 52 |
| Holding cost / unit | Number input | Decimal allowed |
| Backlog cost / unit | Number input | Decimal allowed |
| Starting inventory | Number input | Applied to all roles |
| Customer demand min | Number input | Must be ≤ max |
| Customer demand max | Number input | Must be ≥ min |
| Order timer (seconds) | Number input | Min 10, max 300; 30 default. Bot submits on expiry — always enforced. |
| Summary display (seconds) | Number input | Min 5, max 120; 10 default. Auto-advances to next ordering phase. |
| Auto-advance summary | Toggle | Default on. Turning off risks game halting if no one clicks "Next Round". |
| Registration open | Toggle | Blocks new players from joining if off |

Config changes apply to games not yet started. Running games keep their snapshot.

---

## 14. Pause / Resume Mechanic

- Admin can pause **all timers** (order timer and summary timer) for all teams simultaneously — e.g., to explain a concept mid-game, or to wait for slow teams to catch up.
- `GameState.paused = true` is written to Supabase; all player clients read this flag and freeze both `OrderTimer` and `SummaryTimer` countdowns.
- Pause is the **only mechanism that can halt autonomous progression**. Without an explicit pause, the game always continues.
- Resuming writes `paused = false`; clients resume from the elapsed time stored at pause, NOT from the full timer value (timer does not reset on resume).
- Elapsed time tracking: clients record `pausedAt = Date.now()` when `paused` becomes true, and add `(resumedAt − pausedAt)` to a cumulative `totalPausedMs` which is subtracted when computing remaining time.
- Per-team pause is also available from `/admin/game/[gameId]` for individual team control (e.g., if one team has a technical issue).
- The admin config toggle "Auto-advance summary" (`autoAdvanceSummary`) can be set to `false` before the session if the facilitator wants to manually control when each round begins — but this should be used carefully as it re-introduces the risk of game halt if the facilitator is distracted.

---

## 15. Realtime Strategy

Uses the same Supabase Realtime channel subscription pattern as the cake game:

```typescript
supabase
  .channel(`game:${gameId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'games',
    filter: `id=eq.${gameId}`,
  }, (payload) => {
    setGame(payload.new as Game);
  })
  .subscribe();
```

- One channel per game. Players subscribe on mount, unsubscribe on unmount.
- Observer page subscribes to all active games (or polls every 5s as fallback for projector stability).
- Admin dashboard subscribes to all games.

---

## 16. Player Registration Model

Same as the archive and cake game:

1. **Admin pre-registers** player emails via the admin panel (or bulk-import CSV). Each email is assigned a team number and role ahead of the session.
2. Players visit the game URL and enter their **email address**.
3. The `assign_player_atomic` RPC looks up the email, creates a player record in the appropriate game, and returns the assignment.
4. Player is redirected to their role assignment screen, then lobby, then game.

No passwords for players. Admin password is a single shared secret stored as a Vercel environment variable (`NEXT_PUBLIC_ADMIN_PASSWORD` — same pattern as cake game).

---

## 17. Key Differences from Archive (beergame-archive)

| Aspect | Archive (Expo/Firebase) | New (Next.js/Supabase) |
|--------|------------------------|------------------------|
| Framework | React Native / Expo | Next.js 15 (App Router) |
| Styling | StyleSheet (RN) | Tailwind CSS |
| Database | Firebase Realtime DB | Supabase PostgreSQL + Realtime |
| Deployment | Firebase Hosting | Vercel |
| State | Firebase RTDB object tree | Supabase JSONB column |
| Timer default | 60 seconds | 30 seconds (configurable) |
| Pause/resume | Not supported | Supported (global + per-team) |
| Observer view | Not supported | Supported (/observer route) |
| Config editing | Hardcoded defaults | Admin UI editable |
| Game name | "The Fruit Beer Game" | "Beer Game" (event name configurable) |
| Cost model | Holding + Backlog | Holding + Backlog (same, no expiry/lost-sales) |
| Lead time | 1 week (2 for manufacturer) | Same |
| Bot players | None | Auto-fills incomplete teams; also used on timer expiry |
| Team fill order | Pre-assigned by email | Atomic RPC: fill team 1 completely before opening team 2 |
| Post-submit UX | "Waiting for others" text only | Banner with live "Y / 4 submitted" count |
| Lobby | Role reveal only | Role reveal + tutorial video placeholder |
| Timer sync on reconnect | N/A | `roundStartedAt` timestamp in GameState |
| Repo | Azure DevOps | GitHub (NarasimhaKamathB/Beer-game) |

---

## 18. Deployment Checklist

### Supabase Setup
- [ ] Create new Supabase project (e.g., "Beergame", Mumbai region)
- [ ] Run `supabase/schema.sql`
- [ ] Run `supabase/assign_player_atomic.sql`
- [ ] Run `supabase/rls_policies.sql`
- [ ] Enable Realtime for `games` table
- [ ] Copy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Vercel Setup
- [ ] Create new Vercel project, connect to `NarasimhaKamathB/Beer-game` repo
- [ ] Add environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_ADMIN_PASSWORD` (e.g. `beergame2026`)
- [ ] Enable auto-deploy on push to `main`

### GitHub Setup
- [ ] Create public repo `NarasimhaKamathB/Beer-game`
- [ ] Set git email to `narasimha.kamath@gmail.com` (same as cake game)
- [ ] Local working directory: `C:\Users\narasimha.kamath\Documents\git\o9.Involve\beergame\`
- [ ] Push from PowerShell only (bash git commands fail on this setup — same constraint as cake game)

---

## 19. Out of Scope (Intentional Simplifications)

- **No product expiry / FIFO shelf-life** (unlike cake game)
- **No lost-sales cost** (unmet demand → backlog only)
- **No in-game chat**
- **No player authentication** (email lookup only)
- **No CSV export** (can be added later, same as cake game pending list)
- **No mobile-native app** (web app only — but fully mobile-responsive, see Section 21)
- **No scripted/step demand pattern** (random range for now; can add later)

---

## 21. Mobile Responsiveness

The game must be fully playable on a phone. Players at a live event will primarily use their personal phones (not laptops). All screens must look and work well at 375px–430px viewport widths (iPhone SE → iPhone Pro Max range).

### 21.1 Approach

Use **Tailwind CSS responsive prefixes** (`sm:`, `md:`, `lg:`) throughout — same approach as the cake game. No separate mobile components; one component tree that adapts via breakpoints.

### 21.2 Viewport Setup

`app/layout.tsx` must include the viewport meta tag:
```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```
This is Next.js default but must be verified.

### 21.3 Screen-by-Screen Mobile Behaviour

| Screen | Desktop | Mobile (< sm: 640px) |
|--------|---------|----------------------|
| Landing `/` | Two-column hero + supply chain cards | Single column; supply chain cards scroll horizontally |
| Assigned `/assigned` | Role grid 2×2 | Role grid 2×2 (cards shrink to full width on very small screens) |
| Lobby `/lobby/[gameId]` | Side-by-side roster + video placeholder | Stacked; video placeholder full-width below roster |
| Game `/game/[gameId]` | Max-width centered card (560px) | Full-width card, comfortable tap targets (≥ 44px) |
| Order input | Side-by-side input + button | Stacked or full-width row; button height ≥ 48px |
| WeeklySummary modal | Two-column (material flow \| cost breakdown) | Single column, scroll within modal |
| Admin `/admin` | Grid of team cards (2 per row) | Single-column list; stat row wraps |
| Results `/results/[gameId]` | Side-by-side charts | Charts full-width, stacked; tables scroll horizontally |
| Observer `/observer` | Multi-column team grid | Single column, scrollable |

### 21.4 Tutorial Video Placeholder — Mobile

The `<TutorialVideoPlaceholder />` component and the eventual `<TutorialModal />` must follow the cake game pattern for scale-to-fit:

- Tutorial HTML uses a `scaleToFit()` JS function that applies a CSS `transform: scale()` to fit the 1280×720 content into any screen.
- Overlay elements (`#overlay`, `#progress`) must use `position: absolute` (not `position: fixed`) inside the scaled container — same bug that was fixed in the cake game.
- The modal wrapper in `TutorialModal.tsx` should be full-screen on mobile (no padding/border-radius on small screens).

### 21.5 Timer Bar on Mobile

- The `OrderTimer` bar must be wide enough to read on small screens.
- The urgency text ("⚠ Auto-submitting in Xs") must be legible at `text-sm` or larger.
- The timer bar sits above the order input, full-width.

### 21.6 Admin Panel on Mobile

The admin panel is facilitator-only and typically used on a laptop/tablet, but should remain functional on a phone for emergencies:
- Stats row: wraps to 2×2 grid on mobile.
- Team cards: single column.
- Tables (leaderboard): scroll horizontally inside a scrollable container.

### 21.7 Known Cake Game Mobile Patterns to Reuse

- `scaleToFit()` in tutorial HTML (see `cakegame/public/tutorial.html`)
- `position: absolute` for overlays inside CSS-transformed containers
- `sm:` responsive classes on header, hero, card grids
- Compact header on mobile: `sm:block hidden` for verbose labels

---

## 20. Reference Files

| File | Purpose |
|------|---------|
| `beergame-archive/lib/types.ts` | Original type definitions (basis for new types) |
| `beergame-archive/lib/gameLogic.ts` | Original round processing logic (port to Next.js) |
| `beergame-archive/components/RolePanel.tsx` | Original player UI (adapt to Tailwind) |
| `beergame-archive/components/GameResults.tsx` | Original results/analytics (adapt to Tailwind + SVG) |
| `beergame-archive/components/WeeklySummary.tsx` | Original round summary modal |
| `beergame-archive/app/admin.tsx` | Original admin dashboard |
| `cakegame/lib/supabase.ts` | Supabase patterns to reuse (autoAssign RPC, Realtime) |
| `cakegame/supabase/schema.sql` | Schema reference for JSONB game state pattern |
| `cakegame/lib/types.ts` | Cake game types (for structural reference) |
