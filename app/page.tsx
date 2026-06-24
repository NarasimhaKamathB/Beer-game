'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { autoAssignPlayer, getSessionSettings } from '../lib/supabase';
import { Button, Input, Spinner } from '../components/ui';

function clearBeergameStorage() {
  ['beergame_player_id','beergame_game_id','beergame_role',
   'beergame_team_name','beergame_team_number','beergame_email']
    .forEach(k => localStorage.removeItem(k));
}

export default function LoginPage() {
  const router = useRouter();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [event,   setEvent]   = useState('Beer Game');

  useEffect(() => {
    getSessionSettings().then(s => setEvent(s.eventName));

    // If already assigned, return to lobby — but verify the game still exists first
    const gameId = localStorage.getItem('beergame_game_id');
    if (!gameId) return;

    import('../lib/supabase').then(({ getGame }) =>
      getGame(gameId).then(g => {
        if (!g) {
          // Stale session — clear and stay on login
          clearBeergameStorage();
        } else if (g.state?.phase === 'ended') {
          router.replace(`/results/${gameId}`);
        } else if (g.state?.phase === 'ordering' || g.state?.phase === 'summary') {
          router.replace(`/game/${gameId}`);
        } else {
          router.replace(`/lobby/${gameId}`);
        }
      })
    );
  }, [router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await autoAssignPlayer(trimmed);
      localStorage.setItem('beergame_player_id',   result.playerId);
      localStorage.setItem('beergame_game_id',      result.gameId);
      localStorage.setItem('beergame_role',         result.role);
      localStorage.setItem('beergame_team_name',    result.teamName);
      localStorage.setItem('beergame_team_number',  String(result.teamNumber));
      localStorage.setItem('beergame_email',        trimmed);
      router.push(`/lobby/${result.gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 flex flex-col items-center justify-center p-4">
      {/* Logo area */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">🍺</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">{event}</h1>
        <p className="text-gray-500 mt-2 text-sm sm:text-base max-w-xs mx-auto">
          Simulate the beer supply chain — can your team beat the Bullwhip Effect?
        </p>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <Input
            label="Your email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
          />
          {error && <p className="text-sm text-red-600 -mt-2">{error}</p>}
          <Button type="submit" disabled={loading} size="lg" className="w-full">
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="w-4 h-4 text-white" /> Joining…
              </span>
            ) : 'Join game →'}
          </Button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          You&apos;ll be automatically assigned a role. No account needed.
        </p>
      </div>

      {/* Admin link */}
      <p className="mt-6 text-xs text-gray-400">
        Facilitator?{' '}
        <a href="/admin" className="text-gray-600 underline hover:text-gray-800">Admin panel →</a>
      </p>
    </main>
  );
}
