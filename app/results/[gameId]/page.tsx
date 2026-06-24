'use client';
import { use, useState, useEffect } from 'react';
import { getGame, getAllGames } from '../../../lib/supabase';
import { Game } from '../../../lib/types';
import { Spinner, Button } from '../../../components/ui';
import GameResults from '../../../components/GameResults';
import Analytics from '../../../components/Analytics';
import Leaderboard from '../../../components/Leaderboard';

export default function ResultsPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId }     = use(params);
  const [game, setGame]     = useState<Game | null>(null);
  const [allGames, setAll]  = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<'results' | 'analytics' | 'leaderboard'>('results');

  const [myRole,   setMyRole]   = useState('');
  const [myGameId, setMyGameId] = useState('');

  useEffect(() => {
    setMyRole(localStorage.getItem('beergame_role') ?? '');
    setMyGameId(localStorage.getItem('beergame_game_id') ?? '');

    Promise.all([getGame(gameId), getAllGames()]).then(([g, all]) => {
      setGame(g);
      setAll(all);
      setLoading(false);
    });
  }, [gameId]);

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
        Game not found. <a href="/" className="ml-2 underline text-blue-500">Go home</a>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 text-center">
        <div className="text-3xl mb-1">🏁</div>
        <h1 className="text-2xl font-extrabold text-gray-900">Game Over!</h1>
        <p className="text-sm text-gray-500">
          {Object.values(game.players).find(p => !p.isBot)?.teamName ?? game.code} ·{' '}
          {game.config.totalRounds} rounds completed
        </p>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-5">
        {/* Tab nav */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
          {(['results', 'analytics', 'leaderboard'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'results' ? '📊 Results' : t === 'analytics' ? '📈 Analytics' : '🏆 Leaderboard'}
            </button>
          ))}
        </div>

        {tab === 'results'     && <GameResults game={game} myRole={myRole} />}
        {tab === 'analytics'   && <Analytics game={game} />}
        {tab === 'leaderboard' && <Leaderboard games={allGames} myGameId={myGameId} />}

        {/* Actions */}
        <div className="flex gap-3 justify-center mt-8">
          <Button variant="secondary" onClick={() => {
            localStorage.removeItem('beergame_game_id');
            localStorage.removeItem('beergame_player_id');
            localStorage.removeItem('beergame_role');
            window.location.href = '/';
          }}>
            Play again →
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            Print results
          </Button>
        </div>
      </div>
    </main>
  );
}
