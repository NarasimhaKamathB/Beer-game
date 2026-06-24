'use client';
import { Role, GameState, GameConfig, ROLES, ROLE_LABELS, ROLE_ICONS } from '../lib/types';
import { Card, Badge } from './ui';
import SummaryTimer from './SummaryTimer';

interface Props {
  state: GameState;
  config: GameConfig;
  myRole: Role;
  onAdvance: () => void;
}

export default function WeeklySummary({ state, config, myRole, onAdvance }: Props) {
  const round   = state.currentRound;
  const demand  = config.demandSchedule?.[round - 1] ?? '—';
  const rs      = state.roles[myRole];
  const teamCost = ROLES.reduce((s, r) => s + (state.roles[r]?.totalCost ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Round {round} Summary</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Customer demand this round:{' '}
            <span className="font-semibold text-gray-700">{demand} units</span>
          </p>
        </div>
        <Badge color={round >= config.totalRounds ? 'green' : 'blue'}>
          {round >= config.totalRounds ? '🏁 Final round' : `${config.totalRounds - round} rounds left`}
        </Badge>
      </div>

      {/* Summary timer */}
      {state.phase === 'summary' && (
        <SummaryTimer
          summaryStartedAt={state.summaryStartedAt}
          totalPausedMs={state.totalPausedMs}
          pausedAt={state.pausedAt}
          paused={state.paused}
          durationSeconds={config.summaryTimerSeconds}
          autoAdvance={config.autoAdvanceSummary}
          onAdvance={onAdvance}
        />
      )}

      {/* My role — full breakdown */}
      <Card className="p-5">
        <p className="text-xs font-semibold text-blue-600 uppercase mb-3">
          {ROLE_ICONS[myRole]} {ROLE_LABELS[myRole]} — your results this round
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatBox label={myRole === 'manufacturer' ? 'Produced (ordered)' : 'Ordered'} value={rs.outgoingOrder}    />
          <StatBox label={myRole === 'manufacturer' ? 'Production ready'   : 'Received'} value={rs.incomingShipment} />
          <StatBox label={myRole === 'manufacturer' ? 'Shipped to distr.'  : 'Shipped'}  value={rs.outgoingShipment} />
          <StatBox label="Closing inventory" value={rs.inventory}        color={rs.inventory < 4 ? 'yellow' : 'green'} />
          <StatBox label="Backlog"           value={rs.backlog}          color={rs.backlog > 0 ? 'red' : 'gray'} />
          <StatBox label="Round cost"        value={`$${rs.roundCost.toFixed(2)}`} color="blue" />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
          <span>
            Your total cost so far:{' '}
            <span className="font-bold text-gray-900">${rs.totalCost.toFixed(2)}</span>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Team total:{' '}
            <span className="font-bold text-gray-900">${teamCost.toFixed(2)}</span>
          </span>
        </div>
      </Card>
    </div>
  );
}

function StatBox({
  label, value, color = 'gray',
}: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    gray:   'bg-gray-50   border-gray-100  text-gray-800',
    green:  'bg-green-50  border-green-100 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-800',
    red:    'bg-red-50    border-red-100   text-red-800',
    blue:   'bg-blue-50   border-blue-100  text-blue-800',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color] ?? colors.gray}`}>
      <p className="text-xs font-medium opacity-60 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
