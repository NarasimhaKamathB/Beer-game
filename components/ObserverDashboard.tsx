'use client';
import { Game, ROLES, ROLE_LABELS, ROLE_ICONS, GamePhase } from '../lib/types';
import { getTotalTeamCost } from '../lib/gameLogic';
import { Badge, Card } from './ui';

interface Props { games: Game[] }

const PHASE_COLOR: Record<GamePhase, 'gray' | 'yellow' | 'blue' | 'indigo' | 'green' | 'red'> = {
  lobby:      'gray',
  onboarding: 'yellow',
  ordering:   'blue',
  processing: 'indigo',
  summary:    'yellow',
  ended:      'green',
};

export default function ObserverDashboard({ games }: Props) {
  if (!games.length) {
    return (
      <Card className="p-8 text-center text-gray-400 text-sm">
        No active games. Start from the Admin page.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {games.map(g => <GameCard key={g.id} game={g} />)}
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const { state, config, players } = game;
  const phase       = state?.phase ?? 'lobby';
  const round       = state?.currentRound ?? 0;
  const teamName    = Object.values(players ?? {}).find(p => !p.isBot)?.teamName ?? game.code;
  const totalCost   = round > 0 ? getTotalTeamCost(state.roles) : 0;
  const humanCount  = Object.values(players ?? {}).filter(p => !p.isBot).length;
  const botCount    = Object.values(players ?? {}).filter(p => p.isBot).length;

  return (
    <Card className="p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-800">{teamName}</p>
          <p className="text-xs text-gray-400 font-mono">{game.code}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge color={PHASE_COLOR[phase]}>{phase.toUpperCase()}</Badge>
          <span className="text-xs text-gray-400">
            Round {round}/{config?.totalRounds ?? '—'}
          </span>
        </div>
      </div>

      {/* Player slots */}
      <div className="grid grid-cols-2 gap-1.5">
        {ROLES.map(role => {
          const player = Object.values(players ?? {}).find(p => p.role === role);
          const done   = state?.playersDoneOrdering?.includes(role) ?? false;
          return (
            <div
              key={role}
              className={`rounded-md px-2 py-1.5 text-xs flex items-center gap-1 border ${
                !player        ? 'border-gray-100 bg-gray-50 text-gray-300' :
                player.isBot   ? 'border-gray-200 bg-gray-100 text-gray-500' :
                done           ? 'border-green-200 bg-green-50 text-green-700' :
                                 'border-blue-200 bg-blue-50 text-blue-700'
              }`}
            >
              <span>{ROLE_ICONS[role]}</span>
              <span className="truncate">{player ? player.name : ROLE_LABELS[role]}</span>
              {done && phase === 'ordering' && <span className="ml-auto">✓</span>}
              {player?.isBot && <span className="ml-auto text-gray-400">bot</span>}
            </div>
          );
        })}
      </div>

      {/* Metrics */}
      {round > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
          <span>Team cost: <span className="font-semibold text-gray-700">${totalCost.toFixed(2)}</span></span>
          <span>{humanCount} human{humanCount !== 1 ? 's' : ''}, {botCount} bot{botCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Pause indicator */}
      {state?.paused && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-2 py-1 text-xs text-yellow-700 font-semibold text-center">
          ⏸ Paused
        </div>
      )}
    </Card>
  );
}
