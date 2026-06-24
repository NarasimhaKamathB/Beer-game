'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  summaryStartedAt: number | null;
  totalPausedMs: number;
  pausedAt: number | null;
  paused: boolean;
  durationSeconds: number;
  autoAdvance: boolean;
  onAdvance: () => void;
}

export default function SummaryTimer({
  summaryStartedAt, totalPausedMs, pausedAt, paused,
  durationSeconds, autoAdvance, onAdvance,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const firedRef = useRef(false);
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;

  const getSecondsLeft = useCallback(() => {
    if (!summaryStartedAt) return durationSeconds;
    const frozenMs = (totalPausedMs || 0) + (paused && pausedAt ? Date.now() - pausedAt : 0);
    const elapsed  = (Date.now() - summaryStartedAt - frozenMs) / 1000;
    return Math.max(0, durationSeconds - elapsed);
  }, [summaryStartedAt, totalPausedMs, pausedAt, paused, durationSeconds]);

  useEffect(() => {
    firedRef.current = false;
    setSecondsLeft(getSecondsLeft());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryStartedAt]);

  useEffect(() => {
    if (paused || !autoAdvance) return;
    const id = setInterval(() => {
      const secs = getSecondsLeft();
      setSecondsLeft(secs);
      if (secs <= 0 && !firedRef.current) {
        firedRef.current = true;
        onAdvanceRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [paused, autoAdvance, getSecondsLeft]);

  const display = Math.ceil(secondsLeft);
  const pct     = Math.max(0, Math.min(1, secondsLeft / durationSeconds));

  if (paused) {
    return (
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2 text-center text-sm font-semibold text-yellow-700">
        ⏸ Paused
      </div>
    );
  }

  if (!autoAdvance) {
    return null; // no auto-advance; manual button only
  }

  return (
    <div className="rounded-lg overflow-hidden border border-blue-200 bg-blue-50">
      <div className="relative h-8 flex items-center justify-center">
        <div
          className="absolute left-0 top-0 h-full bg-blue-200 transition-all"
          style={{ width: `${pct * 100}%` }}
        />
        <span className="relative z-10 text-xs font-semibold text-blue-700">
          Next round in {display}s
        </span>
      </div>
    </div>
  );
}
