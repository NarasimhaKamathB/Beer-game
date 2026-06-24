'use client';
import { Game, ROLES, ROLE_LABELS, ROLE_COLORS, ROLE_ICONS } from '../lib/types';

interface Props { game: Game }

export default function Analytics({ game }: Props) {
  const { state } = game;

  const maxRounds = game.config.totalRounds;
  const rounds    = Array.from({ length: state.currentRound }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-6">
      <MiniChart
        title="Orders placed per round"
        rounds={rounds}
        maxRounds={maxRounds}
        series={ROLES.map(r => ({
          label:  ROLE_LABELS[r],
          icon:   ROLE_ICONS[r],
          color:  ROLE_COLORS[r],
          values: (state.roles[r]?.orderHistory ?? []) as number[],
        }))}
      />
      <MiniChart
        title="Inventory levels"
        rounds={rounds}
        maxRounds={maxRounds}
        series={ROLES.map(r => ({
          label:  ROLE_LABELS[r],
          icon:   ROLE_ICONS[r],
          color:  ROLE_COLORS[r],
          values: (state.roles[r]?.inventoryHistory ?? []) as number[],
        }))}
      />
      <MiniChart
        title="Backlog"
        rounds={rounds}
        maxRounds={maxRounds}
        series={ROLES.map(r => ({
          label:  ROLE_LABELS[r],
          icon:   ROLE_ICONS[r],
          color:  ROLE_COLORS[r],
          values: (state.roles[r]?.backlogHistory ?? []) as number[],
        }))}
      />
    </div>
  );
}

interface Series { label: string; icon: string; color: string; values: number[] }
interface ChartProps {
  title: string;
  rounds: number[];
  maxRounds: number;
  series: Series[];
}

function MiniChart({ title, rounds, series }: ChartProps) {
  if (!rounds.length) return null;

  const allVals = series.flatMap(s => s.values).filter(v => typeof v === 'number');
  const maxVal  = Math.max(...allVals, 1);
  const H = 120; // chart height in px
  const W_PAD = 4; // % left/right

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>

      {/* SVG line chart */}
      <div className="relative" style={{ height: H }}>
        <svg className="w-full h-full" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
          {series.map(s => {
            if (!s.values.length) return null;
            const points = s.values.map((v, i) => {
              const x = W_PAD + (i / Math.max(s.values.length - 1, 1)) * (100 - W_PAD * 2);
              const y = H - (v / maxVal) * (H - 8) - 4;
              return `${x},${y}`;
            }).join(' ');
            return (
              <polyline
                key={s.label}
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {/* Zero line */}
          <line x1={W_PAD} y1={H - 4} x2={100 - W_PAD} y2={H - 4}
            stroke="#e5e7eb" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2">
        {series.map(s => (
          <div key={s.label} className="flex items-center gap-1 text-xs text-gray-600">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.icon} {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
