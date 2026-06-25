// ─── Roles ────────────────────────────────────────────────────────────────────

export type Role = 'retailer' | 'wholesaler' | 'distributor' | 'manufacturer';
export const ROLES: Role[] = ['manufacturer', 'distributor', 'wholesaler', 'retailer'];

export type GamePhase =
  | 'lobby'        // waiting for all players to join
  | 'onboarding'   // game started, players reading welcome
  | 'ordering'     // players placing orders
  | 'processing'   // server computing round (brief transitional)
  | 'summary'      // showing round summary
  | 'ended';       // all rounds complete

// ─── Per-role state ───────────────────────────────────────────────────────────

export interface RoleState {
  inventory: number;           // closing inventory after this round
  backlog: number;             // unfilled demand carried forward
  incomingOrder: number;       // demand received from downstream this round
  outgoingOrder: number;       // order placed upstream (player/bot input)
  incomingShipment: number;    // goods received from upstream this round
  outgoingShipment: number;    // goods shipped to downstream this round
  roundCost: number;
  totalCost: number;
  orderPlaced: boolean;
  shipmentPipeline: number[];  // [0] arrives next round; manufacturer has 2 slots
  // History (one entry per completed round):
  orderHistory: number[];
  inventoryHistory: number[];
  backlogHistory: number[];
  costHistory: number[];
  receivedHistory: number[];
  shippedHistory: number[];
  demandHistory: number[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface GameConfig {
  totalRounds: number;
  holdingCostPerUnit: number;
  backlogCostPerUnit: number;
  /** Facilitator-specified demand per round (length must equal totalRounds).
   *  Starting inventory and pipeline seeds are derived from demandSchedule[0]. */
  demandSchedule: number[];
  /** Seconds players have to submit an order; bot fills any missing on expiry. */
  orderTimerSeconds: number;
  /** Seconds round summary is shown before auto-advancing to next round. */
  summaryTimerSeconds: number;
  /** If false, summary only advances on a manual click — risks halt if no-one clicks. */
  autoAdvanceSummary: boolean;
}

// Classic beer game: 4 units/week for first 4 weeks, then 8 units/week.
// Starting inventory = 3 × demandSchedule[0] = 12.
export const DEFAULT_CONFIG: GameConfig = {
  totalRounds: 13,
  holdingCostPerUnit: 0.5,
  backlogCostPerUnit: 1.0,
  demandSchedule: [4, 4, 4, 4, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  orderTimerSeconds: 30,
  summaryTimerSeconds: 10,
  autoAdvanceSummary: true,
};

// ─── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  isAdmin: boolean;
  isBot: boolean;
  joinedAt: number;
  teamName: string;
  teamNumber: number;
}

// ─── Game-wide state ──────────────────────────────────────────────────────────

export interface GameState {
  phase: GamePhase;
  currentRound: number;
  roles: Record<Role, RoleState>;
  /** Roles that have placed their order this round. */
  playersDoneOrdering: string[];
  /** Unix ms when the ordering phase started — clients derive timer from this. */
  roundStartedAt: number | null;
  /** Unix ms when the summary phase started — clients derive summary timer. */
  summaryStartedAt: number | null;
  /** True when facilitator has paused all timers. */
  paused: boolean;
  /** Unix ms when pause began — used to compute elapsed frozen time. */
  pausedAt: number | null;
  /** Total ms already paused before the current pause (accumulates across pause/resume). */
  totalPausedMs: number;
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export interface Game {
  id: string;
  code: string;
  hostId: string;
  config: GameConfig;
  players: Record<string, Player>;
  state: GameState;
  createdAt: number;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface SessionSettings {
  registrationOpen: boolean;
  gameConfig: GameConfig | null;
  eventName: string;
  /** Password required to access /admin. Default: 'beergame2026'. Stored in session_settings. */
  adminPassword: string;
  /** When true, any player in the lobby can start their own game without admin action. */
  allowSelfStart: boolean;
}

// ─── Labels & metadata ───────────────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  retailer:     'Retailer',
  wholesaler:   'Wholesaler',
  distributor:  'Distributor',
  manufacturer: 'Manufacturer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  retailer:     'Sells directly to end customers.',
  wholesaler:   'Supplies stock to retailers.',
  distributor:  'Links manufacturer to wholesaler.',
  manufacturer: 'Produces the product from raw materials.',
};

export const ROLE_TAGS: Record<Role, string> = {
  retailer:     'End consumer sales',
  wholesaler:   'Regional supply',
  distributor:  'Bulk distribution',
  manufacturer: 'Raw → Finished goods',
};

export const ROLE_ICONS: Record<Role, string> = {
  retailer:     '🛍️',
  wholesaler:   '🏪',
  distributor:  '📦',
  manufacturer: '🏭',
};

export const ROLE_COLORS: Record<Role, string> = {
  retailer:     '#3b82f6',
  wholesaler:   '#10b981',
  distributor:  '#f59e0b',
  manufacturer: '#ef4444',
};

export const UPSTREAM_ROLE: Partial<Record<Role, Role>> = {
  retailer:    'wholesaler',
  wholesaler:  'distributor',
  distributor: 'manufacturer',
};

export const DOWNSTREAM_ROLE: Partial<Record<Role, Role>> = {
  wholesaler:  'retailer',
  distributor: 'wholesaler',
  manufacturer: 'distributor',
};

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_ROLE_STATE: RoleState = {
  inventory: 0,
  backlog: 0,
  incomingOrder: 0,
  outgoingOrder: 0,
  incomingShipment: 0,
  outgoingShipment: 0,
  roundCost: 0,
  totalCost: 0,
  orderPlaced: false,
  shipmentPipeline: [],
  orderHistory: [],
  inventoryHistory: [],
  backlogHistory: [],
  costHistory: [],
  receivedHistory: [],
  shippedHistory: [],
  demandHistory: [],
};
