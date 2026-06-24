import { Game, ROLES, ROLE_LABELS, ROLE_ICONS } from '../lib/types';
import { getTotalTeamCost, getOrderFulfillmentRate, getBullwhipRatio } from '../lib/gameLogic';
import { Card, Badge } from './ui';

interface Props {
  game: Game;
  myRole?: string;
}

export default function GameResults({ game, myRole }: Props) {
  const { state, config } = game;
  const totalCost = getTotalTeamCost(state.roles);
  const ofrPct    = getOrderFulfillmentRate(state.roles).toFixed(1);
  const bullwhip  = getBullwhipRatio(state.roles).toFixed(2);
  const maxCost   = Math.max(...ROLES.map(r => state.roles[r]?.totalCost ?? 0), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total team cost"
          value={`$${totalCost.toFixed(2)}`}
          sub={`${config.totalRounds} rounds`}
          icon="💰"
          color="yellow"
        />
        <KpiCard
          label="Order fulfillment rate"
          value={`${ofrPct}%`}
          sub="% of demand shipped"
          icon="📦"
          color={Number(ofrPct) >= 95 ? 'green' : Number(ofrPct) >= 80 ? 'yellow' : 'red'}
        />
        <KpiCard
          label="Bullwhip ratio"
          value={bullwhip}
          sub="Mfg variance / demand variance"
          icon="📈"
          color={Number(bullwhip) <= 1.5 ? 'green' : Number(bullwhip) <= 3 ? 'yellow' : 'red'}
        />
      </div>

      {/* Per-role breakdown */}
      <Card className="p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Cost by role</h3>
        <div className="flex flex-col gap-3">
          {ROLES.map(role => {
            const rs   = state.roles[role];
            const cost = rs?.totalCost ?? 0;
            const pct  = (cost / maxCost) * 100;
            const isMe = role === myRole;
            return (
              <div key={role}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${isMe ? 'text-blue-700' : 'text-gray-700'}`}>
                    {ROLE_ICONS[role]} {ROLE_LABELS[role]}
                    {isMe && <Badge color="blue" children=" (you)" />}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">${cost.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isMe ? 'bg-blue-400' : 'bg-amber-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Config reminder */}
      <Card className="p-4 text-sm text-gray-600">
        <span className="font-semibold text-gray-700">Game parameters: </span>
        Holding cost ${config.holdingCostPerUnit}/unit,
        backlog cost ${config.backlogCostPerUnit}/unit,
        demand schedule: {config.demandSchedule.join(', ')},
        starting inventory {3 * (config.demandSchedule[0] ?? 4)}
      </Card>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: string; color: string;
}) {
  const colors: Record<string, string> = {
    yellow: 'bg-yellow-50 border-yellow-200',
    green:  'bg-green-50  border-green-200',
    red:    'bg-red-50    border-red-200',
    blue:   'bg-blue-50   border-blue-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.yellow}`}>
      <div className="flex items-start gap-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </div>
      </div>
    </div>
  );
}
