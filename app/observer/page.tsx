'use client';
import { useState, useEffect } from 'react';
import { getAllGames, subscribeToAllGames } from '../../lib/supabase';
import { Game } from '../../lib/types';
import { Spinner, Badge } from '../../components/ui';
import ObserverDashboard from '../../components/ObserverDashboard';
import Leaderboard from '../../components/Leaderboard';

export default function ObserverPage() {
  const [games,   setGames]   = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'live' | 'board'>('live');

  useEffect(() => {
    getAllGames().then(gs => { setGames(gs); setLoading(false); });
    return subscribeToAllGames(setGames);
  }, []);

  const active = games.filter(g => g.state?.phase !== 'ended');
  const ended  = games.filter(g => g.state?.phase === 'ended');

  return (
    <main className="min-h-screen bg-gray-950 text-white pb-10">
      {/* Full-screen projector header */}
      <header className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍺</span>
          <h1 className="text-xl font-extrabold tracking-tight">Beer Game — Observer View</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge color="blue">{active.length} active</Badge>
          <Badge color="green">{ended.length} finished</Badge>
          {loading && <Spinner className="w-5 h-5 text-white/40" />}
          <a href="/admin" className="text-sm text-white/40 hover:text-white/70 underline">Admin →</a>
        </div>
      </header>

      <div className="px-6 py-5">
        {/* Tab toggle */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-5 w-fit">
          <button
            onClick={() => setTab('live')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'live' ? 'bg-white text-gray-900 shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            📡 Live
          </button>
          <button
            onClick={() => setTab('board')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'board' ? 'bg-white text-gray-900 shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            🏆 Leaderboard
          </button>
        </div>

        {tab === 'live' && (
          <div className="[--card-bg:theme(colors.white/5)] [--card-border:theme(colors.white/10)]">
            <ObserverDashboard games={games} />
          </div>
        )}

        {tab === 'board' && (
          <div className="max-w-xl">
            <Leaderboard games={games} />
          </div>
        )}
      </div>
    </main>
  );
}
