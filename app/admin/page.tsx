'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAllGames, getSessionSettings, updateSessionSettings,
  startAllGames, startSingleGame, deleteAllGames, subscribeToAllGames,
} from '../../lib/supabase';
import { Game, SessionSettings, GameConfig, DEFAULT_CONFIG } from '../../lib/types';
import { Button, Card, Badge, Input, Spinner } from '../../components/ui';
import ObserverDashboard from '../../components/ObserverDashboard';

export default function AdminPage() {
  const router = useRouter();
  const [games,    setGames]    = useState<Game[]>([]);
  const [settings, setSettings] = useState<SessionSettings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');

  // Config form state
  const [cfg,         setCfg]         = useState<GameConfig>(DEFAULT_CONFIG);
  const [demandInput, setDemandInput] = useState(DEFAULT_CONFIG.demandSchedule.join(', '));

  useEffect(() => {
    Promise.all([getAllGames(), getSessionSettings()]).then(([gs, s]) => {
      setGames(gs);
      setSettings(s);
      const c = s.gameConfig ?? DEFAULT_CONFIG;
      setCfg(c);
      setDemandInput(c.demandSchedule.join(', '));
      setLoading(false);
    });
    const unsub = subscribeToAllGames(setGames);
    return unsub;
  }, []);

  // Parse demand input → number[]
  function parsedDemand(): number[] | null {
    const vals = demandInput.split(',').map(s => parseInt(s.trim(), 10));
    if (vals.some(isNaN)) return null;
    return vals;
  }

  const demand       = parsedDemand();
  const demandOk     = demand !== null && demand.length === cfg.totalRounds;
  const startingInv  = demand ? 3 * demand[0] : '—';

  async function handleStartAll() {
    setSaving(true);
    try { await startAllGames(); setMsg('All games started!'); }
    catch (e) { setMsg(String(e)); }
    finally { setSaving(false); }
  }

  async function handleStartOne(gameId: string, teamName: string) {
    setSaving(true);
    try { await startSingleGame(gameId); setMsg(`${teamName} started!`); }
    catch (e) { setMsg(String(e)); }
    finally { setSaving(false); }
  }

  async function handleDeleteAll() {
    if (!confirm('Delete ALL games? This cannot be undone.')) return;
    setSaving(true);
    try { await deleteAllGames(); setMsg('All games deleted.'); }
    catch (e) { setMsg(String(e)); }
    finally { setSaving(false); }
  }

  async function handleSaveSettings() {
    if (!demandOk) {
      setMsg(`Demand schedule must have exactly ${cfg.totalRounds} values (one per round).`);
      return;
    }
    setSaving(true);
    try {
      const newCfg: GameConfig = { ...cfg, demandSchedule: demand! };
      await updateSessionSettings({
        registrationOpen: settings?.registrationOpen ?? true,
        eventName:        settings?.eventName ?? 'Beer Game',
        gameConfig:       newCfg,
      });
      setCfg(newCfg);
      setMsg('Settings saved.');
    } catch (e) { setMsg(String(e)); }
    finally { setSaving(false); }
  }

  async function handleToggleReg() {
    if (!settings) return;
    const next = !settings.registrationOpen;
    setSettings(s => s ? { ...s, registrationOpen: next } : s);
    await updateSessionSettings({ registrationOpen: next });
  }

  function numField(key: keyof GameConfig, label: string, step = 1, min = 0) {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
        <input
          type="number" min={min} step={step}
          value={(cfg as Record<string, unknown>)[key] as number}
          onChange={e => setCfg(c => ({ ...c, [key]: parseFloat(e.target.value) || 0 }))}
          className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner className="w-8 h-8 text-amber-400" /></div>;
  }

  const inLobby = games.filter(g => ['lobby', 'onboarding'].includes(g.state?.phase));
  const active  = games.filter(g => !['ended'].includes(g.state?.phase));
  const ended   = games.filter(g => g.state?.phase === 'ended');

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍺</span>
          <h1 className="text-lg font-bold text-gray-900">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={settings?.registrationOpen ? 'green' : 'red'}>
            {settings?.registrationOpen ? 'Registration open' : 'Registration closed'}
          </Badge>
          <a href="/" className="text-sm text-gray-500 hover:text-gray-700 underline">Player view</a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 flex flex-col gap-6">

        {/* Toast */}
        {msg && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 flex items-center justify-between">
            {msg}
            <button onClick={() => setMsg('')} className="text-blue-400 hover:text-blue-600 ml-4">✕</button>
          </div>
        )}

        {/* Session control */}
        <Card className="p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Session control</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleStartAll} disabled={saving || !inLobby.length}>
              {saving ? <Spinner className="w-4 h-4" /> : '▶'} Start all games
            </Button>
            <Button
              variant={settings?.registrationOpen ? 'secondary' : 'primary'}
              onClick={handleToggleReg}
            >
              {settings?.registrationOpen ? '🔒 Close registration' : '🔓 Open registration'}
            </Button>
            <Button variant="danger" onClick={handleDeleteAll} disabled={saving}>
              🗑 Delete all games
            </Button>
            <Button variant="ghost" onClick={() => router.push('/observer')}>
              👁 Observer view
            </Button>
          </div>
          <div className="mt-4 flex gap-4 text-sm text-gray-600">
            <span><span className="font-semibold">{games.length}</span> total games</span>
            <span><span className="font-semibold">{active.length}</span> active</span>
            <span><span className="font-semibold">{ended.length}</span> ended</span>
          </div>
        </Card>

        {/* Event settings */}
        <Card className="p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Event settings</h2>
          <div className="max-w-sm">
            <Input
              label="Event name"
              value={settings?.eventName ?? ''}
              onChange={e => setSettings(s => s ? { ...s, eventName: e.target.value } : s)}
            />
          </div>
        </Card>

        {/* Game config */}
        <Card className="p-5">
          <h2 className="font-semibold text-gray-800 mb-1">Default game config</h2>
          <p className="text-xs text-gray-500 mb-4">Applied to new teams created after saving.</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            {numField('totalRounds',         'Total rounds',      1, 1)}
            {numField('orderTimerSeconds',   'Order timer (s)',   1, 5)}
            {numField('summaryTimerSeconds', 'Summary timer (s)', 1, 5)}
            {numField('holdingCostPerUnit',  'Holding cost/unit', 0.1, 0)}
            {numField('backlogCostPerUnit',  'Backlog cost/unit', 0.1, 0)}
          </div>

          {/* Demand schedule */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Customer demand schedule — comma-separated, one value per round
            </label>
            <textarea
              rows={2}
              value={demandInput}
              onChange={e => setDemandInput(e.target.value)}
              placeholder="4, 4, 4, 4, 8, 8, 8, 8, 8, 8, 8, 8, 8"
              className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none ${
                demand === null ? 'border-red-300' :
                !demandOk       ? 'border-yellow-300' : 'border-gray-300'
              }`}
            />
            <p className={`text-xs mt-1 ${
              demand === null ? 'text-red-500' :
              !demandOk       ? 'text-yellow-600' : 'text-gray-400'
            }`}>
              {demand === null
                ? 'Invalid — use numbers separated by commas.'
                : !demandOk
                  ? `${demand.length} values entered, need ${cfg.totalRounds} (one per round).`
                  : `✓ ${demand.length} rounds · Starting inventory auto-set to ${startingInv} (3 × first demand)`}
            </p>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="autoAdv"
              checked={cfg.autoAdvanceSummary}
              onChange={e => setCfg(c => ({ ...c, autoAdvanceSummary: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="autoAdv" className="text-sm text-gray-700">
              Auto-advance summary (if unchecked, game can halt — not recommended)
            </label>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving || !demandOk}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </Card>

        {/* Games list — with per-game Start button */}
        <Card className="p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Games</h2>
          {!games.length ? (
            <p className="text-sm text-gray-400">No games yet. Players join via the login page.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {games.map(g => {
                const teamName  = Object.values(g.players ?? {}).find(p => !p.isBot)?.teamName ?? g.code;
                const phase     = g.state?.phase ?? 'lobby';
                const inLobby_g = ['lobby', 'onboarding'].includes(phase);
                return (
                  <div
                    key={g.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 flex-wrap gap-2"
                  >
                    <div>
                      <span className="font-medium text-gray-800">{teamName}</span>
                      <span className="ml-2 text-xs font-mono text-gray-400">{g.code}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color={
                        phase === 'lobby'    ? 'gray'   :
                        phase === 'ordering' ? 'blue'   :
                        phase === 'summary'  ? 'yellow' :
                        phase === 'ended'    ? 'green'  : 'indigo'
                      }>
                        {phase === 'lobby' || phase === 'onboarding'
                          ? 'Lobby'
                          : `Round ${g.state?.currentRound ?? 0}/${g.config?.totalRounds ?? '—'}`}
                      </Badge>
                      {inLobby_g && (
                        <Button
                          size="sm"
                          onClick={() => handleStartOne(g.id, teamName)}
                          disabled={saving}
                        >
                          ▶ Start
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/admin/game/${g.id}`)}>
                        Manage →
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Live observer view */}
        <div>
          <h2 className="font-semibold text-gray-800 mb-3">Live overview</h2>
          <ObserverDashboard games={games} />
        </div>
      </div>
    </main>
  );
}
