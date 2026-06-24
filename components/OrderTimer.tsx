'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  roundStartedAt: number | null;
  totalPausedMs: number;
  pausedAt: number | null;
  paused: boolean;
  durationSeconds: number;
  /** True once this player has submitted their order — changes timer text. */
  submitted?: boolean;
  onExpire: () => void;
}

export default function OrderTimer({
  roundStartedAt, totalPausedMs, pausedAt, paused, durationSeconds, submitted = false, onExpire,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const getSecondsLeft = useCallback(() => {
    if (!roundStartedAt) return durationSeconds;
    const frozenMs = (totalPausedMs || 0) + (paused && pausedAt ? Date.now() - pausedAt : 0);
    const elapsed  = (Date.now() - roundStartedAt - frozenMs) / 1000;
    return Math.max(0, durationSeconds - elapsed);
  }, [roundStartedAt, totalPausedMs, pausedAt, paused, durationSeconds]);

  useEffect(() => {
    firedRef.current = false;
    setSecondsLeft(getSecondsLeft());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundStartedAt]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const secs = getSecondsLeft();
      setSecondsLeft(secs);
      if (secs <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [paused, getSecondsLeft]);

  const pct     = Math.max(0, Math.min(1, secondsLeft / durationSeconds));
  const urgent  = secondsLeft <= 10 && !paused && !submitted;
  const display = Math.ceil(secondsLeft);

  if (paused) {
    return (
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-center text-sm font-semibold text-yellow-700">
        ⏸ Paused by facilitator
      </div>
    );
  }

  // Player has submitted — show a calm "waiting for others" bar
  if (submitted) {
    return (
      <div className="rounded-lg overflow-hidden border border-green-200 bg-green-50">
        <div className="relative h-9 flex items-center justify-center">
          <div
            className="absolute left-0 top-0 h-full bg-green-100 transition-all"
            style={{ width: `${pct * 100}%` }}
          />
          <span className="relative z-10 text-sm font-semibold text-green-700">
            ✓ Waiting for others to submit — {display}s left
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border ${urgent ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="relative h-9 flex items-center justify-center">
        <div
          className={`absolute left-0 top-0 h-full transition-all ${urgent ? 'bg-red-200' : 'bg-green-100'}`}
          style={{ width: `${pct * 100}%` }}
        />
        <span className={`relative z-10 text-sm font-semibold ${urgent ? 'text-red-700' : 'text-gray-600'}`}>
          {urgent
            ? `⚠ Auto-submitting in ${display}s`
            : `Submit your order within ${display}s`}
        </span>
      </div>
    </div>
  );
}
