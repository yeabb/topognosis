export default function GraphPanel() {
  return (
    <div className="flex flex-col h-full items-center justify-center border-l border-white/10 bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-600">
            <circle cx="12" cy="5" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
            <line x1="12" y1="7" x2="5" y2="17" />
            <line x1="12" y1="7" x2="19" y2="17" />
          </svg>
        </div>
        <p className="text-neutral-600 text-xs">Graph renders here</p>
      </div>
    </div>
  )
}
