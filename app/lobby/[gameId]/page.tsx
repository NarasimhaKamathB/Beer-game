'use client';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  subscribeToGame, getGame, getSessionSettings,
  autoFillBotPlayers, startSingleGame,
} from '../../../lib/supabase';
import { Game, ROLES, ROLE_LABELS, ROLE_ICONS, ROLE_DESCRIPTIONS } from '../../../lib/types';
import { Card, Badge, Spinner } from '../../../components/ui';
import TutorialModal from '../../../components/TutorialModal';

export default function LobbyPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router     = useRouter();

  const [game,         setGame]         = useState<Game | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [allowSelfStart, setAllowSelfStart] = useState(true);

  const [myRole,       setMyRole]       = useState('');
  const [myTeamName,   setMyTeamName]   = useState('');
  const [myPlayerId,   setMyPlayerId]   = useState('');
  const [showTutorial, setShowTutorial] = useState(false);

  // Self-start state
  const [starting,    setStarting]    = useState(false);
  const [startMsg,    setStartMsg]    = useState('');

  useEffect(() => {
    setMyRole(localStorage.getItem('beergame_role') ?? '');
    setMyTeamName(localStorage.getItem('beergame_team_name') ?? '');
    setMyPlayerId(localStorage.getItem('beergame_player_id') ?? '');

    Promise.all([getGame(gameId), getSessionSettings()]).then(([g, s]) => {
      setGame(g);
      setAllowSelfStart(s.allowSelfStart ?? true);
      setLoading(false);
    });

    const unsub = subscribeToGame(gameId, g => {
      setGame(g);
      if (g?.state?.phase === 'ordering' || g?.state?.phase === 'onboarding') {
        router.push(`/game/${gameId}`);
      }
    });
    return unsub;
  }, [gameId, router]);

  async function handleSelfStart() {
    if (starting) return;
    setStarting(true);
    try {
      setStartMsg('Filling empty slots with bots…');
      await autoFillBotPlayers(gameId);
      setStartMsg('Starting game…');
      await startSingleGame(gameId);
      // Realtime subscription will redirect when phase changes
    } catch (e) {
      setStartMsg('Something went wrong. Please try again.');
      setStarting(false);
      console.error(e);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8 text-amber-400" />
      </div>
    );
  }

  // ── Game not found ─────────────────────────────────────────────────────────
  if (!game) {
    if (typeof window !== 'undefined') {
      ['beergame_player_id','beergame_game_id','beergame_role',
       'beergame_team_name','beergame_team_number','beergame_email']
        .forEach(k => localStorage.removeItem(k));
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-amber-50 p-6 text-center">
        <div className="text-5xl">🍺</div>
        <h2 className="text-xl font-bold text-gray-800">Session expired</h2>
        <p className="text-gray-500 max-w-xs">
          This game no longer exists — it may have been reset or you followed a stale link.
        </p>
        <a
          href="/"
          className="mt-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
        >
          Start fresh →
        </a>
      </div>
    );
  }

  const players    = game.players ?? {};
  const humanCount = Object.values(players).filter(p => !p.isBot).length;
  const emptySlots = 4 - humanCount;

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-5 py-6">

        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-1">🍺</div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            {allowSelfStart ? 'Ready to play?' : 'Waiting for game to start'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Team: <span className="font-semibold text-gray-700">{myTeamName}</span>
            &nbsp;·&nbsp;Code: <span className="font-mono text-gray-700">{game.code}</span>
          </p>
        </div>

        {/* Your assignment */}
        <Card className="p-4 border-l-4 border-l-amber-400">
          <p className="text-xs text-amber-600 font-semibold uppercase mb-1">Your role</p>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{ROLE_ICONS[myRole as keyof typeof ROLE_ICONS] ?? '?'}</span>
            <div>
              <p className="text-lg font-bold text-gray-900">
                {ROLE_LABELS[myRole as keyof typeof ROLE_LABELS] ?? myRole}
              </p>
              <p className="text-sm text-gray-500">
                {ROLE_DESCRIPTIONS[myRole as keyof typeof ROLE_DESCRIPTIONS]}
              </p>
            </div>
          </div>
        </Card>

        {/* Player slots */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Team members</p>
            <Badge color={humanCount === 4 ? 'green' : 'yellow'}>{humanCount}/4 joined</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map(role => {
              const player = Object.values(players).find(p => p.role === role);
              const isMe   = player?.id === myPlayerId;
              return (
                <div
                  key={role}
                  className={`flex items-center gap-3 rounded-lg p-3 border ${
                    isMe   ? 'border-amber-200 bg-amber-50' :
                    player ? (player.isBot ? 'border-gray-200 bg-gray-50' : 'border-green-200 bg-green-50')
                           : 'border-dashed border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-xl">{ROLE_ICONS[role]}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-600">{ROLE_LABELS[role]}</p>
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {player ? (player.isBot ? '🤖 Bot (TBD)' : player.name) : 'Waiting…'}
                      {isMe && <span className="ml-1 text-xs text-amber-600">(you)</span>}
                    </p>
                  </div>
                  {player && !player.isBot && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Self-start / waiting section ── */}
        {allowSelfStart ? (
          <Card className="p-5">
            <div className="flex flex-col gap-3">
              {/* Main call to action */}
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Start the game when you&apos;re ready.
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {humanCount === 4
                    ? 'All 4 players have joined — you\'re good to go!'
                    : emptySlots === 1
                      ? '1 slot is empty — a bot will fill it when you start.'
                      : `${emptySlots} slots are empty — bots will fill them when you start.`}
                </p>
              </div>

              {/* Tooltip note */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <span className="text-base mt-0.5">💡</span>
                <p className="text-xs text-amber-800">
                  <strong>4 players make the Bullwhip Effect come alive!</strong> If your teammates haven&apos;t joined yet, share the link and wait. Can&apos;t get 4? No problem — bots will play the empty roles.
                </p>
              </div>

              {/* Start button */}
              {starting ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Spinner className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="text-sm font-medium text-amber-700">{startMsg}</span>
                </div>
              ) : (
                <button
                  onClick={handleSelfStart}
                  className="w-full py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-base transition-colors shadow-sm"
                >
                  ▶ Start game now
                </button>
              )}

              {/* Divider */}
              <p className="text-xs text-center text-gray-400 mt-1">
                or wait — the facilitator can also start the game from the admin panel.
              </p>
            </div>
          </Card>
        ) : (
          /* Admin-only start mode */
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-2">
            <Spinner className="w-4 h-4" />
            Waiting for facilitator to start the game…
          </div>
        )}

        {/* Tutorial */}
        <button
          onClick={() => setShowTutorial(true)}
          className="w-full rounded-2xl overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-900 to-yellow-950 hover:brightness-110 transition-all group relative"
          style={{ minHeight: 160 }}
        >
          <div className="flex flex-col items-center justify-center gap-3 py-8 px-6">
            <div className="w-14 h-14 rounded-full bg-amber-400/20 border-2 border-amber-300/50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-amber-200 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-amber-100 font-bold text-base">▶ Watch Tutorial</p>
              <p className="text-amber-300/70 text-sm mt-0.5">Learn how the Beer Distribution Game works (~1 min)</p>
            </div>
          </div>
        </button>

        {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      </div>
    </main>
  );
}
