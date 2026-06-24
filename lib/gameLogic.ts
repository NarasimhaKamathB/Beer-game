import {
  Role, RoleState, GameState, GameConfig, DEFAULT_ROLE_STATE, ROLES,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Coerce Supabase JSONB arrays (may deserialise as objects) to real arrays. */
function toArr<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object') return Object.values(v) as T[];
  return [];
}

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialGameState(config: GameConfig): GameState {
  // Steady-state seed: first week's demand value.
  // Pipelines (information upstream + material downstream) are pre-loaded with this value.
  // Starting inventory = 3 × seed so the supply chain opens in equilibrium.
  const seed             = config.demandSchedule[0] ?? 4;
  const startingInventory = 3 * seed;
  const roles = {} as Record<Role, RoleState>;

  for (const role of ROLES) {
    roles[role] = {
      ...DEFAULT_ROLE_STATE,
      inventory:        startingInventory,
      incomingOrder:    seed,   // steady-state: each node already sees first-week demand
      incomingShipment: seed,   // steady-state: pipeline already flowing
      shipmentPipeline: role === 'manufacturer' ? [seed, seed] : [seed],
    };
  }

  return {
    phase: 'lobby',
    currentRound: 0,
    roles,
    playersDoneOrdering: [],
    roundStartedAt: null,
    summaryStartedAt: null,
    paused: false,
    pausedAt: null,
    totalPausedMs: 0,
  };
}

// ─── Bot order heuristic ──────────────────────────────────────────────────────

/**
 * Bot order heuristic — intentionally noisy to preserve the Bullwhip effect.
 * Orders `incomingOrder × rand(0,1)` rounded to nearest integer, minimum 1 when
 * there is any demand (never stays at zero if demand > 0).
 */
export function getBotOrder(rs: RoleState): number {
  if (rs.incomingOrder <= 0) return 0;
  return Math.max(1, Math.round(rs.incomingOrder * Math.random()));
}

// ─── Core round processor ─────────────────────────────────────────────────────

/**
 * Pure, deterministic round processor.
 * Uses `config.demandSchedule` (pre-generated at game creation) so all clients
 * compute the identical result — no divergence from independent random() calls.
 */
export function processRound(
  state: GameState,
  config: GameConfig,
  orders: Record<Role, number>,
): GameState {
  const newRound = state.currentRound + 1;
  const newRoles = { ...state.roles };

  // Pull demand from the pre-generated schedule (1-indexed rounds → 0-indexed array)
  const scheduleIdx = Math.min(newRound - 1, config.demandSchedule.length - 1);
  const customerDemand = config.demandSchedule[scheduleIdx] ?? 4;

  // Helper: safely read pipeline from JSONB-deserialised state
  const pipe = (role: Role): number[] => toArr<number>(state.roles[role]?.shipmentPipeline);

  // ── Step 1: What each role receives this round (front of pipeline) ────────
  const received: Record<Role, number> = {
    retailer:     pipe('retailer')[0]     ?? 0,
    wholesaler:   pipe('wholesaler')[0]   ?? 0,
    distributor:  pipe('distributor')[0]  ?? 0,
    manufacturer: pipe('manufacturer')[0] ?? 0,
  };

  // ── Step 2: Incoming demand per role ─────────────────────────────────────
  const incomingOrders: Record<Role, number> = {
    retailer:     customerDemand,
    wholesaler:   orders.retailer,
    distributor:  orders.wholesaler,
    manufacturer: orders.distributor,
  };

  // ── Step 3: Process inventory, shipping, backlog, costs ──────────────────
  for (const role of ROLES) {
    const rs: RoleState = {
      ...newRoles[role],
      // Coerce numeric fields that may come back as strings from JSONB
      inventory:  Number(newRoles[role]?.inventory)  || 0,
      backlog:    Number(newRoles[role]?.backlog)    || 0,
      totalCost:  Number(newRoles[role]?.totalCost)  || 0,
    };

    rs.incomingShipment = received[role];
    rs.incomingOrder    = incomingOrders[role];

    const available       = rs.inventory + received[role];
    const effectiveDemand = incomingOrders[role] + rs.backlog;

    rs.outgoingShipment = Math.min(available, effectiveDemand);
    rs.inventory        = available - rs.outgoingShipment;         // closing inventory
    rs.backlog          = Math.max(0, effectiveDemand - available); // unfilled → backlog

    rs.outgoingOrder = orders[role];
    rs.roundCost     = rs.inventory * config.holdingCostPerUnit
                     + rs.backlog   * config.backlogCostPerUnit;
    rs.totalCost    += rs.roundCost;
    rs.orderPlaced   = false;

    // Append to history arrays (guard against JSONB deserialization as object)
    rs.orderHistory     = [...toArr<number>(rs.orderHistory),     orders[role]];
    rs.inventoryHistory = [...toArr<number>(rs.inventoryHistory), rs.inventory];
    rs.backlogHistory   = [...toArr<number>(rs.backlogHistory),   rs.backlog];
    rs.costHistory      = [...toArr<number>(rs.costHistory),      rs.roundCost];
    rs.receivedHistory  = [...toArr<number>(rs.receivedHistory),  rs.incomingShipment];
    rs.shippedHistory   = [...toArr<number>(rs.shippedHistory),   rs.outgoingShipment];
    rs.demandHistory    = [...toArr<number>(rs.demandHistory),    rs.incomingOrder];

    newRoles[role] = rs;
  }

  // ── Step 4: Advance shipment pipelines ───────────────────────────────────
  // retailer ← wholesaler ships this round (1-week delay)
  newRoles.retailer    = { ...newRoles.retailer,    shipmentPipeline: [newRoles.wholesaler.outgoingShipment]   };
  newRoles.wholesaler  = { ...newRoles.wholesaler,  shipmentPipeline: [newRoles.distributor.outgoingShipment]  };
  newRoles.distributor = { ...newRoles.distributor, shipmentPipeline: [newRoles.manufacturer.outgoingShipment] };
  // manufacturer: 2-slot pipeline
  //   [0] = last round's production order (arrives next round)
  //   [1] = this round's order (arrives in 2 rounds)
  newRoles.manufacturer = {
    ...newRoles.manufacturer,
    shipmentPipeline: [
      pipe('manufacturer')[1] ?? 0,
      orders.manufacturer,
    ],
  };

  const isEnded = newRound >= config.totalRounds;

  return {
    ...state,
    currentRound: newRound,
    roles: newRoles,
    phase: isEnded ? 'ended' : 'summary',
    playersDoneOrdering: [],
    // Clear ordering timestamp; summaryStartedAt is set by the caller
    roundStartedAt:    null,
    summaryStartedAt:  null,
    paused:            false,
    pausedAt:          null,
    totalPausedMs:     0,
  };
}

// ─── Aggregates ───────────────────────────────────────────────────────────────

export function getTotalTeamCost(roles: Record<Role, RoleState>): number {
  return ROLES.reduce((sum, role) => sum + (Number(roles[role]?.totalCost) || 0), 0);
}

export function getOrderFulfillmentRate(roles: Record<Role, RoleState>): number {
  let shipped = 0, demanded = 0;
  for (const role of ROLES) {
    shipped  += toArr<number>(roles[role]?.shippedHistory).reduce((a, b) => a + b, 0);
    demanded += toArr<number>(roles[role]?.demandHistory).reduce((a, b) => a + b, 0);
  }
  return demanded > 0 ? Math.min(100, (100 * shipped) / demanded) : 100;
}

export function getBullwhipRatio(roles: Record<Role, RoleState>): number {
  const custDemand = toArr<number>(roles.retailer?.demandHistory);
  const mfgOrders  = toArr<number>(roles.manufacturer?.orderHistory);
  if (custDemand.length < 2 || mfgOrders.length < 2) return 0;
  const custStd = stdDev(custDemand);
  return custStd === 0 ? 0 : stdDev(mfgOrders) / custStd;
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(v => (v - m) ** 2)));
}
