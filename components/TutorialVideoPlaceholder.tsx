export default function TutorialVideoPlaceholder() {
  return (
    <div className="w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-900 aspect-video flex flex-col items-center justify-center gap-3 select-none">
      {/* Play icon */}
      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <p className="text-white/80 text-sm font-semibold">Tutorial video coming soon</p>
      <p className="text-white/40 text-xs">Learn how the Beer Distribution Game works</p>
    </div>
  );
}
