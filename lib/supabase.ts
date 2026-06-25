import { createClient } from '@supabase/supabase-js';
import {
  Game, GameConfig, GameState, Player, Role, SessionSettings,
  DEFAULT_CONFIG, ROLES, ROLE_LABELS,
} from './types';
import {
  generateGameCode, createInitialGameState, getBotOrder,
} from './gameLogic';

// ─── Client ───────────────────────────────────────────────────────────────────

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnon);

// ─── Row mapper ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToGame(row: any): Game {
  return {
    id:         row.id,
    code:       row.code,
    hostId:     row.host_id,
    config:     row.config,
    state:      row.state,
    players:    row.players ?? {},
    createdAt:  row.created_at,
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getGame(gameId: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from('games').select('*').eq('id', gameId).single();
  if (error || !data) return null;
  return rowToGame(data);
}

export async function getAllGames(): Promise<Game[]> {
  const { data, error } = await supabase.from('games').select('*').order('created_at');
  if (error || !data) return [];
  return data.map(rowToGame);
}

// ─── Write ────────────────────────────────────────────────────────────────────

/** Shallow-merge partial state into the existing state JSONB column. */
export async function updateGameState(gameId: string, patch: Partial<GameState>): Promise<void> {
  const current = await getGame(gameId);
  if (!current) return;
  const merged = { ...current.state, ...patch };
  const { error } = await supabase.from('games').update({ state: merged }).eq('id', gameId);
  if (error) throw new Error(error.message);
}

/** Replace the entire state column. */
export async function updateFullGameState(gameId: string, state: GameState): Promise<void> {
  const { error } = await supabase.from('games').update({ state }).eq('id', gameId);
  if (error) throw new Error(error.message);
}

// ─── Real-time ────────────────────────────────────────────────────────────────

export function subscribeToGame(gameId: string, cb: (g: Game | null) => void): () => void {
  const ch = supabase.channel(`game-${gameId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
      payload => cb(payload.new ? rowToGame(payload.new) : null),
    ).subscribe();
  return () => { supabase.removeChannel(ch); };
}

export function subscribeToAllGames(cb: (games: Game[]) => void): () => void {
  const ch = supabase.channel('all-games')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games' },
      async () => cb(await getAllGames()),
    ).subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ─── Session settings ─────────────────────────────────────────────────────────

export async function getSessionSettings(): Promise<SessionSettings> {
  const { data } = await supabase.from('session_settings').select('*').eq('id', 1).single();
  if (!data) return { registrationOpen: true, gameConfig: null, eventName: 'Beer Game', adminPassword: 'beergame2026', allowSelfStart: true };
  return {
    registrationOpen: data.registration_open,
    gameConfig:       data.game_config      ?? null,
    eventName:        data.event_name       ?? 'Beer Game',
    adminPassword:    data.admin_password   ?? 'beergame2026',
    allowSelfStart:   data.allow_self_start ?? true,
  };
}

export async function updateSessionSettings(s: Partial<SessionSettings>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (s.registrationOpen !== undefined) patch.registration_open = s.registrationOpen;
  if (s.gameConfig        !== undefined) patch.game_config       = s.gameConfig;
  if (s.eventName         !== undefined) patch.event_name        = s.eventName;
  if (s.adminPassword     !== undefined) patch.admin_password    = s.adminPassword;
  if (s.allowSelfStart    !== undefined) patch.allow_self_start  = s.allowSelfStart;
  await supabase.from('session_settings').upsert({ id: 1, ...patch });
}

export function subscribeToSessionSettings(cb: (s: SessionSettings) => void): () => void {
  const ch = supabase.channel('session-settings')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'session_settings', filter: 'id=eq.1' },
      payload => {
        if (payload.new) {
          const r = payload.new as Record<string, unknown>;
          cb({
            registrationOpen: r.registration_open as boolean,
            gameConfig:       (r.game_config as GameConfig | null) ?? null,
            eventName:        (r.event_name  as string) ?? 'Beer Game',
          });
        }
      },
    ).subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ─── Player auto-assignment ───────────────────────────────────────────────────

function formatName(email: string): string {
  return email.split('@')[0]
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Atomically assign a player to a game slot.
 * Delegates to a Postgres RPC for concurrent-safe slot claiming.
 * Falls back to creating a new team if no open lobby game exists.
 */
export async function autoAssignPlayer(email: string): Promise<{
  playerId: string; gameId: string; role: Role; teamName: string; teamNumber: number;
}> {
  const trimmed = email.trim().toLowerCase();
  const name    = formatName(trimmed);

  const { data, error } = await supabase.rpc('assign_player_atomic', {
    p_email: trimmed,
    p_name:  name,
  });
  if (error) throw new Error(error.message);

  type RpcResult = {
    needsCreate?: boolean;
    playerId:     string;
    gameId?:      string;
    role?:        Role;
    teamName:     string;
    teamNumber:   number;
  };
  const result = data as RpcResult;

  if (!result.needsCreate) {
    return {
      playerId:   result.playerId,
      gameId:     result.gameId!,
      role:       result.role!,
      teamName:   result.teamName,
      teamNumber: result.teamNumber,
    };
  }

  // Brief jitter then retry — catches the case where another client just created a team
  await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
  const { data: d2, error: e2 } = await supabase.rpc('assign_player_atomic', {
    p_email: trimmed, p_name: name,
  });
  if (!e2 && d2 && !(d2 as RpcResult).needsCreate) {
    const r2 = d2 as RpcResult;
    return { playerId: r2.playerId, gameId: r2.gameId!, role: r2.role!, teamName: r2.teamName, teamNumber: r2.teamNumber };
  }

  // Still need a new team — create it client-side
  const session = await getSessionSettings();
  const cfg = session.gameConfig ?? DEFAULT_CONFIG;
  return createNewTeamGame(trimmed, result.teamName, result.teamNumber, cfg);
}

async function createNewTeamGame(
  email: string,
  teamName: string,
  teamNumber: number,
  config: GameConfig,
): Promise<{ playerId: string; gameId: string; role: Role; teamName: string; teamNumber: number }> {
  const gameId   = 'team_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const code     = generateGameCode();
  const playerId = email.replace(/[^a-z0-9]/g, '_');
  const role: Role = 'manufacturer';

  // Demand schedule is set by the facilitator in session settings; use as-is.
  const fullConfig: GameConfig = config;

  const player: Player = {
    id: playerId, name: formatName(email), email, role,
    isAdmin: false, isBot: false, joinedAt: Date.now(), teamName, teamNumber,
  };

  const game: Game = {
    id: gameId, code, hostId: playerId,
    config: fullConfig,
    players: { [playerId]: player },
    state: createInitialGameState(fullConfig),
    createdAt: Date.now(),
  };

  const { error } = await supabase.from('games').insert({
    id: game.id, code: game.code, host_id: game.hostId,
    config: game.config, state: game.state, players: game.players,
    created_at: game.createdAt,
  });
  if (error) throw new Error(error.message);
  return { playerId, gameId, role, teamName, teamNumber };
}

// ─── Bot management ───────────────────────────────────────────────────────────

export async function autoFillBotPlayers(gameId: string): Promise<void> {
  const game = await getGame(gameId);
  if (!game) return;

  const usedRoles = new Set(
    Object.values(game.players)
      .filter(p => !p.isBot)
      .map(p => p.role)
      .filter(Boolean) as Role[],
  );
  const missing = ROLES.filter(r => !usedRoles.has(r));
  if (!missing.length) return;

  const firstHuman = Object.values(game.players).find(p => !p.isBot);
  const newPlayers = { ...game.players };

  for (const role of missing) {
    const botId = `bot_${role}`;
    newPlayers[botId] = {
      id: botId,
      name: `Bot (${ROLE_LABELS[role]})`,
      email: `bot_${role}@system`,
      role, isAdmin: false, isBot: true,
      joinedAt: Date.now(),
      teamName:   firstHuman?.teamName   ?? '',
      teamNumber: firstHuman?.teamNumber ?? 1,
    };
  }

  const { error } = await supabase.from('games').update({ players: newPlayers }).eq('id', gameId);
  if (error) throw new Error(error.message);
}

// ─── Admin actions ────────────────────────────────────────────────────────────

export async function startAllGames(): Promise<void> {
  const games = await getAllGames();
  const pending = games.filter(g => ['lobby', 'onboarding'].includes(g.state?.phase));
  await Promise.all(pending.map(g => startSingleGame(g.id)));
}

/** Start one specific game (fill bots, set phase → ordering). */
export async function startSingleGame(gameId: string): Promise<void> {
  const game = await getGame(gameId);
  if (!game || !['lobby', 'onboarding'].includes(game.state?.phase)) return;
  await autoFillBotPlayers(gameId);
  await updateGameState(gameId, {
    phase:            'ordering',
    roundStartedAt:   Date.now(),
    summaryStartedAt: null,
  });
}

export async function pauseGame(gameId: string): Promise<void> {
  const game = await getGame(gameId);
  if (!game || game.state.paused) return;
  await updateGameState(gameId, { paused: true, pausedAt: Date.now() });
}

export async function resumeGame(gameId: string): Promise<void> {
  const game = await getGame(gameId);
  if (!game || !game.state.paused) return;
  const pausedMs = game.state.pausedAt ? Date.now() - game.state.pausedAt : 0;
  await updateGameState(gameId, {
    paused: false,
    pausedAt: null,
    totalPausedMs: (game.state.totalPausedMs || 0) + pausedMs,
  });
}

export async function addPlayerToTeam(
  gameId: string, email: string, role: Role, teamName: string, teamNumber: number,
): Promise<void> {
  const game = await getGame(gameId);
  if (!game) throw new Error('Game not found');

  const playerId = email.replace(/[^a-z0-9]/g, '_');
  // Remove any bot occupying this role
  const players: Record<string, Player> = {};
  for (const [pid, p] of Object.entries(game.players)) {
    if (p.role === role && p.isBot) continue; // remove bot
    if (pid === playerId) continue;           // remove stale entry for same email
    players[pid] = p;
  }
  players[playerId] = {
    id: playerId, name: formatName(email), email: email.toLowerCase().trim(),
    role, isAdmin: false, isBot: false, joinedAt: Date.now(), teamName, teamNumber,
  };

  const { error } = await supabase.from('games').update({ players }).eq('id', gameId);
  if (error) throw new Error(error.message);
}

export async function resetGameValues(gameId: string): Promise<void> {
  const game = await getGame(gameId);
  if (!game) return;
  const fresh = createInitialGameState(game.config);
  fresh.phase = 'ordering';
  fresh.roundStartedAt = Date.now();
  await updateFullGameState(gameId, fresh);
}

export async function resetGameFull(gameId: string): Promise<void> {
  const game = await getGame(gameId);
  if (!game) return;
  const fresh = createInitialGameState(game.config);
  const { error } = await supabase
    .from('games').update({ state: fresh, players: {} }).eq('id', gameId);
  if (error) throw new Error(error.message);
}

export async function deleteAllGames(): Promise<void> {
  await supabase.from('games').delete().neq('id', '');
}

// ─── Order submission (client-side round trigger) ─────────────────────────────

/**
 * Submit an order for a role. If this is the last order needed, atomically
 * transition to 'processing' and then compute + write the new round state.
 *
 * Concurrency guard: only the client that successfully writes phase='processing'
 * (while it was still 'ordering') actually calls processRound. All others see
 * 'processing' or 'summary' via Realtime and do nothing.
 */
export async function submitOrder(
  game: Game,
  role: Role,
  amount: number,
  { processRound }: { processRound: (state: GameState, config: GameConfig, orders: Record<Role, number>) => GameState },
): Promise<void> {
  if (game.state.phase !== 'ordering') return;
  if (game.state.roles[role]?.orderPlaced) return; // already submitted

  const updatedRoles = {
    ...game.state.roles,
    [role]: { ...game.state.roles[role], orderPlaced: true, outgoingOrder: amount },
  };
  const newDone = [...(game.state.playersDoneOrdering ?? []), role];
  const allDone = ROLES.every(r => newDone.includes(r));

  if (allDone) {
    // Attempt to be the "processing trigger" — write phase='processing' atomically
    const processingState: GameState = {
      ...game.state,
      roles: updatedRoles,
      playersDoneOrdering: newDone,
      phase: 'processing',
    };
    await updateFullGameState(game.id, processingState);

    // Gather all orders and run the pure round processor
    const orders = {
      retailer:     updatedRoles.retailer.outgoingOrder,
      wholesaler:   updatedRoles.wholesaler.outgoingOrder,
      distributor:  updatedRoles.distributor.outgoingOrder,
      manufacturer: updatedRoles.manufacturer.outgoingOrder,
    } as Record<Role, number>;

    const newState = processRound(processingState, game.config, orders);
    if (newState.phase === 'summary') {
      newState.summaryStartedAt = Date.now();
    }
    await updateFullGameState(game.id, newState);
  } else {
    // Just record this order; others still pending
    await updateGameState(game.id, {
      roles: updatedRoles,
      playersDoneOrdering: newDone,
    });
  }
}

/**
 * Called when the order timer expires on any client.
 * Fills missing orders with bot heuristic, then triggers round processing
 * if no other client already did (guard: check phase is still 'ordering').
 */
export async function submitBotOrdersAndProcess(
  gameId: string,
  processRoundFn: (state: GameState, config: GameConfig, orders: Record<Role, number>) => GameState,
): Promise<void> {
  // Re-fetch fresh state to avoid stale reads
  const game = await getGame(gameId);
  if (!game || game.state.phase !== 'ordering') return; // another client already processed

  const roles = { ...game.state.roles };
  const done  = new Set(game.state.playersDoneOrdering ?? []);

  // Fill any role that hasn't ordered yet with bot heuristic
  for (const role of ROLES) {
    if (!done.has(role)) {
      roles[role] = { ...roles[role], orderPlaced: true, outgoingOrder: getBotOrder(roles[role]) };
      done.add(role);
    }
  }

  const processingState: GameState = {
    ...game.state,
    roles,
    playersDoneOrdering: [...done],
    phase: 'processing',
  };
  await updateFullGameState(gameId, processingState);

  const orders = {
    retailer:     roles.retailer.outgoingOrder,
    wholesaler:   roles.wholesaler.outgoingOrder,
    distributor:  roles.distributor.outgoingOrder,
    manufacturer: roles.manufacturer.outgoingOrder,
  } as Record<Role, number>;

  const newState = processRoundFn(processingState, game.config, orders);
  if (newState.phase === 'summary') {
    newState.summaryStartedAt = Date.now();
  }
  await updateFullGameState(gameId, newState);
}

/**
 * Advance from summary → ordering (summary timer expired or manual "Next Round" click).
 * Guard: only proceeds if phase is still 'summary'.
 */
export async function advanceToNextRound(gameId: string): Promise<void> {
  const game = await getGame(gameId);
  if (!game || game.state.phase !== 'summary') return;
  const now = Date.now();
  await updateGameState(gameId, {
    phase: 'ordering',
    roundStartedAt:   now,
    summaryStartedAt: null,
    paused:           false,
    pausedAt:         null,
    totalPausedMs:    0,
  });
}
