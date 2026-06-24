'use client';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getGame, subscribeToGame, pauseGame, resumeGame, advanceToNextRound,
  resetGameValues, resetGameFull, autoFillBotPlayers, getAllGames,
} from '../../../../lib/supabase';
import { Game, ROLES, ROLE_LABELS, ROLE_ICONS } from '../../../../lib/types';
import { getTotalTeamCost } from '../../../../lib/gameLogic';
import { Button, Card, Badge, Spinner } from '../../../../components/ui';
import Analytics from '../../../../components/Analytics';
import GameResults from '../../../../components/GameResults';

export default function AdminGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router     = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [msg, setMsg]         = useState('');

  useEffect(() => {
    getGame(gameId).then(g => { setGame(g); setLoading(false); });
    return subscribeToGame(gameId, g => setGame(g));
  }, [gameId]);

  async function act(fn: () => Promise<void>, successMsg: string) {
    setWorking(true);
    setMsg('');
    try { await fn(); setMsg(successMsg); }
    catch (e) { setMsg('Error: ' + String(e)); }
    finally { setWorking(false); }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner className="w-8 h-8 text-amber-400" /></div>;
  }
  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Game not found. <button onClick={() => router.push('/admin')} className="ml-2 underline text-blue-500">Back</button>
      </div>
    );
  }

  const { state, config, players } = game;
  const teamName = Object.values(players ?? {}).find(p => !p.isBot)?.teamName ?? game.code;

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/admin')} className="text-gray-400 hover:text-gray-700">←</button>
        <span className="text-xl">🍺</span>
        <div>
          <h1 className="text-base font-bold text-gray-900">{teamName}</h1>
          <p className="text-xs text-gray-400 font-mono">{game.code}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge color={
            state.phase === 'ordering'   ? 'blue'  :
            state.phase === 'summary'    ? 'yellow':
            state.phase === 'ended'      ? 'green' : 'gray'
          }>
            {state.phase.toUpperCase()}
          </Badge>
          <Badge color="gray">Round {state.currentRound}/{config.totalRounds}</Badge>
          {state.paused && <Badge color="yellow">⏸ PAUSED</Badge>}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-5">

        {msg && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 flex items-center justify-between">
            {msg}
            <button onClick={() => setMsg('')} className="text-blue-400 ml-4">✕</button>
          </div>
        )}

        {/* Controls */}
        <Card className="p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Controls</h2>
          <div className="flex flex-wrap gap-2">
            {state.paused ? (
              <Button onClick={() => act(() => resumeGame(gameId), 'Resumed.')} disabled={working}>
                ▶ Resume
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => act(() => pauseGame(gameId), 'Paused.')} disabled={working || state.phase === 'ended'}>
                ⏸ Pause
              </Button>
            )}
            {state.phase === 'summary' && (
              <Button variant="secondary" onClick={() => act(() => advanceToNextRound(gameId), 'Advanced to next round.')} disabled={working}>
                ⏭ Skip summary
              </Button>
            )}
            <Button variant="secondary" onClick={() => act(() => autoFillBotPlayers(gameId), 'Bots filled.')} disabled={working}>
              🤖 Fill bots
            </Button>
            <Button variant="secondary" onClick={() => act(() => resetGameValues(gameId), 'Values reset.')} disabled={working}>
              ↺ Reset values
            </Button>
            <Button variant="danger" onClick={() => {
              if (confirm('Fully reset game? All progress and players will be cleared.')) {
                act(() => resetGameFull(gameId), 'Game fully reset.');
              }
            }} disabled={working}>
              ⚠ Full reset
            </Button>
          </div>
        </Card>

        {/* Player roster */}
        <Card className="p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Players</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map(role => {
              const p   = Object.values(players ?? {}).find(pl => pl.role === role);
              const done = state.playersDoneOrdering?.includes(role) ?? false;
              return (
                <div key={role} className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 ${
                  !p ? 'border-dashed border-gray-200' :
                  p.isBot ? 'border-gray-200 bg-gray-50' : 'border-green-200 bg-green-50'
                }`}>
                  <span className="text-xl">{ROLE_ICONS[role]}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500">{ROLE_LABELS[role]}</p>
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {p ? (p.isBot ? '🤖 Bot' : p.name) : 'Empty'}
                    </p>
                    {p && !p.isBot && <p className="text-xs text-gray-400 truncate">{p.email}</p>}
                  </div>
                  {state.phase === 'ordering' && done && (
                    <span className="ml-auto text-green-600 text-xs font-semibold">✓ Ordered</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Round costs */}
        {state.currentRound > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Cost summary</h2>
            <div className="flex flex-col gap-1.5 text-sm">
              {ROLES.map(role => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-gray-600">{ROLE_ICONS[role]} {ROLE_LABELS[role]}</span>
                  <span className="font-semibold text-gray-800">${(state.roles[role]?.totalCost ?? 0).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1 font-bold">
                <span>Team total</span>
                <span>${getTotalTeamCost(state.roles).toFixed(2)}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Analytics */}
        {state.currentRound > 0 && <Analytics game={game} />}

        {/* Results (if ended) */}
        {state.phase === 'ended' && <GameResults game={game} />}
      </div>
    </main>
  );
}
