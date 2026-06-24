'use client';
import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

export default function TutorialModal({ onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-950/90 border-b border-amber-900/50">
        <span className="text-amber-200 font-semibold text-sm tracking-wide">
          🍺 The Beer Game — Tutorial
        </span>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-200/10 hover:bg-amber-200/20 text-amber-100 text-sm font-semibold transition-colors"
        >
          Got it ✓
        </button>
      </div>

      {/* Tutorial iframe */}
      <iframe
        src="/tutorial.html"
        className="flex-1 w-full border-0"
        allow="autoplay"
        title="Beer Game Tutorial"
      />
    </div>
  );
}
