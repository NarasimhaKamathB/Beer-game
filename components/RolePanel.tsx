'use client';
import { useState } from 'react';
import { Role, RoleState, ROLE_LABELS, ROLE_ICONS, ROLE_DESCRIPTIONS, UPSTREAM_ROLE } from '../lib/types';
import { Button, Card, Badge } from './ui';

const MAX_ORDER = 100_000;

interface Props {
  role: Role;
  roleState: RoleState;
  round: number;
  totalRounds: number;
  ordersDone: number;
  submitted: boolean;
  disabled: boolean;
  onSubmit: (amount: number) => Promise<void>;
}

export default function RolePanel({
  role, roleState, round, totalRounds, ordersDone, submitted, disabled, onSubmit,
}: Props) {
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const upstream    = UPSTREAM_ROLE[role];
  const isMfg       = role === 'manufacturer';
  const parsed      = parseInt(amount, 10);
  const isValid     = /^\d+$/.test(amount.trim()) && parsed >= 0;
  const exceedsMax  = isValid && parsed > MAX_ORDER;

  async function handleSubmit() {
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    let value = parsed;
    if (value < 0) value = 0;
    if (value > MAX_ORDER) {
      value = MAX_ORDER;
      setError(`Maximum is ${MAX_ORDER.toLocaleString()} units — submitting ${MAX_ORDER.toLocaleString()}.`);
    }
    try {
      await onSubmit(value);
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Role header */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{ROLE_ICONS[role]}</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{ROLE_LABELS[role]}</h2>
              <Badge color="blue">Round {round}/{totalRounds}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        </div>
      </Card>

      {/* Inventory snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Inventory"        value={roleState.inventory}        color="green"  />
        <StatCard label="Backlog"          value={roleState.backlog}          color={roleState.backlog > 0 ? 'red' : 'gray'} />
        <StatCard label="Incoming order"   value={roleState.incomingOrder}    color="blue"   />
        {/* Manufacturer receives production output, not a shipment from upstream */}
        <StatCard
          label={isMfg ? 'Production ready' : 'Incoming shipment'}
          value={roleState.incomingShipment}
          color="indigo"
        />
      </div>

      {/* Cost this round */}
      <Card className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">Round cost: </span>
          ${roleState.roundCost.toFixed(2)}
          <span className="ml-3 text-gray-400">|</span>
          <span className="ml-3 font-semibold text-gray-800">Total: </span>
          ${roleState.totalCost.toFixed(2)}
        </div>
        <div className="text-xs text-gray-400">Inventory ×0.5 + Backlog ×1.0</div>
      </Card>

      {/* Order input / submitted state */}
      <Card className="p-4">
        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="flex items-center gap-2 text-green-700 font-semibold text-base">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Submitted ({roleState.outgoingOrder} units)
            </div>
            <p className="text-sm text-gray-500">
              Waiting for others&nbsp;
              <span className="font-semibold text-gray-700">({ordersDone}/4 done)</span>
            </p>
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i < ordersDone ? 'bg-green-400' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">
                {isMfg ? 'Production order' : `Order to ${upstream ? ROLE_LABELS[upstream] : 'upstream'}`}
              </label>
              <span className="text-xs text-gray-400">{ordersDone}/4 submitted</span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={MAX_ORDER}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                disabled={disabled || loading}
                placeholder="Enter units…"
                className={`flex-1 h-11 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:bg-gray-50 ${
                  exceedsMax ? 'border-yellow-400' : 'border-gray-300'
                }`}
              />
              <Button onClick={handleSubmit} disabled={!isValid || disabled || loading} size="lg">
                {loading ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
            {exceedsMax && (
              <p className="text-xs text-yellow-600">
                ⚠ Maximum order is {MAX_ORDER.toLocaleString()} units — will be capped on submit.
              </p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <p className="text-xs text-gray-400">
              Tip: demand {roleState.incomingOrder} + backlog {roleState.backlog} − inventory {roleState.inventory} = net need {roleState.incomingOrder + roleState.backlog - roleState.inventory}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-50  text-green-700  border-green-100',
    red:    'bg-red-50    text-red-700    border-red-100',
    blue:   'bg-blue-50   text-blue-700   border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    gray:   'bg-gray-50   text-gray-700   border-gray-100',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color] ?? colors.gray}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
