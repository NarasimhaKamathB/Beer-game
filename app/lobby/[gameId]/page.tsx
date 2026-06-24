'use client';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToGame, getGame } from '../../../lib/supabase';
import { Game, ROLES, ROLE_LABELS, ROLE_ICONS, ROLE_DESCRIPTIONS } from '../../../lib/types';
import { Card, Badge, Spinner } from '../../../components/ui';
import TutorialModal from '../../../components/TutorialModal';

export default function LobbyPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId }  = use(params);
  const router      = useRouter();
  const [game, setGame]       = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  const [myRole,       setMyRole]       = useState('');
  const [myTeamName,   setMyTeamName]   = useState('');
  const [myPlayerId,   setMyPlayerId]   = useState('');
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    setMyRole(localStorage.getItem('beergame_role') ?? '');
    setMyTeamName(localStorage.getItem('beergame_team_name') ?? '');
    setMyPlayerId(localStorage.getItem('beergame_player_id') ?? '');

    getGame(gameId).then(g => { setGame(g); setLoading(false); });
    const unsub = subscribeToGame(gameId, g => {
      setGame(g);
      if (g?.state?.phase === 'ordering' || g?.state?.phase === 'onboarding') {
        router.push(`/game/${gameId}`);
      }
    });
    return unsub;
  }, [gameId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8 text-amber-400" />
      </div>
    );
  }

  if (!game) {
    // Clear stale session so home page doesn't redirect here again
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-5 py-6">

        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-1">🍺</div>
          <h1 className="text-2xl font-extrabold text-gray-900">Waiting for game to start</h1>
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
              <p className="text-lg font-bold text-gray-900">{ROLE_LABELS[myRole as keyof typeof ROLE_LABELS] ?? myRole}</p>
              <p className="text-sm text-gray-500">{ROLE_DESCRIPTIONS[myRole as keyof typeof ROLE_DESCRIPTIONS]}</p>
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
                    isMe     ? 'border-amber-200 bg-amber-50' :
                    player   ? (player.isBot ? 'border-gray-200 bg-gray-50' : 'border-green-200 bg-green-50') :
                               'border-dashed border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-xl">{ROLE_ICONS[role]}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-600">{ROLE_LABELS[role]}</p>
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {player
                        ? player.isBot ? '🤖 Bot (TBD)' : player.name
                        : 'Waiting…'}
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

        {/* Tutorial */}
        <button
          onClick={() => setShowTutorial(true)}
          className="w-full rounded-2xl overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-900 to-yellow-950 hover:brightness-110 transition-all group relative"
          style={{ minHeight: 180 }}
        >
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6">
            <div className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-300/50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-amber-200 ml-1" fill="currentColor" viewBox="0 0 24 24">
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

        {/* Waiting indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Spinner className="w-4 h-4" />
          Waiting for facilitator to start the game…
        </div>
      </div>
    </main>
  );
}
