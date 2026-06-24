'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getGame, subscribeToGame, submitOrder, submitBotOrdersAndProcess, advanceToNextRound } from '../../../lib/supabase';
import { processRound } from '../../../lib/gameLogic';
import { Game, Role, ROLE_LABELS, ROLE_ICONS } from '../../../lib/types';
import { Spinner, Badge } from '../../../components/ui';
import OrderTimer from '../../../components/OrderTimer';
import RolePanel from '../../../components/RolePanel';
import WeeklySummary from '../../../components/WeeklySummary';

export default function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router     = useRouter();

  const [game, setGame]       = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitErr, setSubmitErr] = useState('');

  // Read player info once from localStorage
  const myRole     = useRef<Role | null>(null);
  const myPlayerId = useRef<string>('');

  useEffect(() => {
    myRole.current     = (localStorage.getItem('beergame_role') as Role | null);
    myPlayerId.current = localStorage.getItem('beergame_player_id') ?? '';

    getGame(gameId).then(g => {
      setGame(g);
      setLoading(false);
      if (g?.state?.phase === 'ended') router.replace(`/results/${gameId}`);
    });

    const unsub = subscribeToGame(gameId, g => {
      setGame(g);
      if (g?.state?.phase === 'ended') router.replace(`/results/${gameId}`);
    });
    return unsub;
  }, [gameId, router]);

  // Called when order timer expires — bot fills missing orders
  const handleTimerExpire = useCallback(async () => {
    try {
      await submitBotOrdersAndProcess(gameId, processRound);
    } catch (e) {
      console.error('Timer expire error:', e);
    }
  }, [gameId]);

  // Called when summary timer fires — advance to next round
  const handleSummaryAdvance = useCallback(async () => {
    try {
      await advanceToNextRound(gameId);
    } catch (e) {
      console.error('Summary advance error:', e);
    }
  }, [gameId]);

  // Submit player order
  const handleSubmit = useCallback(async (amount: number) => {
    if (!game || !myRole.current) return;
    setSubmitErr('');
    try {
      await submitOrder(game, myRole.current, amount, { processRound });
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : 'Submit failed');
    }
  }, [game]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8 text-amber-400" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Game not found. <a href="/" className="ml-2 underline text-blue-500">Go back</a>
      </div>
    );
  }

  const { state, config } = game;
  const role              = myRole.current;
  const roleState         = role ? state.roles[role] : null;
  const done              = state.playersDoneOrdering ?? [];
  const ordersDone        = done.length;
  const submitted         = role ? done.includes(role) : false;

  return (
    <main className="min-h-screen bg-gray-50 pb-8">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍺</span>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">Beer Game</p>
            <p className="text-xs text-gray-400 font-mono">{game.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {role && (
            <Badge color="blue">
              {ROLE_ICONS[role]} {ROLE_LABELS[role]}
            </Badge>
          )}
          <Badge color={
            state.phase === 'ordering'   ? 'blue'   :
            state.phase === 'processing' ? 'indigo' :
            state.phase === 'summary'    ? 'yellow' : 'gray'
          }>
            Round {state.currentRound}/{config.totalRounds}
          </Badge>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 flex flex-col gap-4">

        {/* ── Ordering phase ── */}
        {state.phase === 'ordering' && role && roleState && (
          <>
            <OrderTimer
              roundStartedAt={state.roundStartedAt}
              totalPausedMs={state.totalPausedMs}
              pausedAt={state.pausedAt}
              paused={state.paused}
              durationSeconds={config.orderTimerSeconds}
              submitted={submitted}
              onExpire={handleTimerExpire}
            />
            {submitErr && <p className="text-sm text-red-600">{submitErr}</p>}
            <RolePanel
              role={role}
              roleState={roleState}
              round={state.currentRound}
              totalRounds={config.totalRounds}
              ordersDone={ordersDone}
              submitted={submitted}
              disabled={submitted || state.paused}
              onSubmit={handleSubmit}
            />
          </>
        )}

        {/* ── Processing (brief transition) ── */}
        {state.phase === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Spinner className="w-10 h-10 text-amber-400" />
            <p className="text-gray-500 text-sm font-medium">Processing round…</p>
          </div>
        )}

        {/* ── Summary phase ── */}
        {state.phase === 'summary' && role && (
          <WeeklySummary
            state={state}
            config={config}
            myRole={role}
            onAdvance={handleSummaryAdvance}
          />
        )}

        {/* ── Lobby / onboarding ── */}
        {(state.phase === 'lobby' || state.phase === 'onboarding') && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Spinner className="w-8 h-8 text-amber-400" />
            <p className="text-gray-500 text-sm">Waiting for game to start…</p>
          </div>
        )}
      </div>
    </main>
  );
}
