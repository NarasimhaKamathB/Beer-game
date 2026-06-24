import { Game, ROLES } from '../lib/types';
import { getTotalTeamCost } from '../lib/gameLogic';
import { Badge, Card } from './ui';

interface Props {
  games: Game[];
  myGameId?: string;
}

export default function Leaderboard({ games, myGameId }: Props) {
  const ended = games.filter(g => g.state?.phase === 'ended');
  if (!ended.length) {
    return (
      <Card className="p-6 text-center text-sm text-gray-500">
        Leaderboard will appear when teams finish.
      </Card>
    );
  }

  const rows = ended.map(g => ({
    game:      g,
    teamName:  Object.values(g.players).find(p => !p.isBot)?.teamName ?? g.id,
    totalCost: getTotalTeamCost(g.state.roles),
    ofr:       getOfr(g),
  })).sort((a, b) => a.totalCost - b.totalCost);

  const minCost = rows[0]?.totalCost ?? 0;

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Team</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-600">Total cost</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-600">Fill rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isMe   = row.game.id === myGameId;
            const isWin  = row.totalCost === minCost;
            return (
              <tr key={row.game.id} className={`border-b border-gray-50 ${isMe ? 'bg-blue-50' : isWin ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-3 text-gray-600">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {row.teamName}
                  {isMe && <Badge color="blue" children=" (you)" />}
                </td>
                <td className="text-right px-4 py-3 font-semibold text-gray-800">
                  ${row.totalCost.toFixed(2)}
                </td>
                <td className="text-right px-4 py-3 text-gray-600">
                  {row.ofr.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function getOfr(g: Game): number {
  let shipped = 0, demanded = 0;
  for (const role of ROLES) {
    const rs = g.state.roles[role];
    const sh = (rs?.shippedHistory ?? []) as number[];
    const dm = (rs?.demandHistory  ?? []) as number[];
    shipped  += sh.reduce((a, b) => a + b, 0);
    demanded += dm.reduce((a, b) => a + b, 0);
  }
  return demanded > 0 ? Math.min(100, (100 * shipped) / demanded) : 100;
}
