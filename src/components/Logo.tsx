export function LynkLogo({ size = 32, withWord = false }: { size?: number; withWord?: boolean }) {
  const s = size;
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="lg1" x1="4" y1="44" x2="44" y2="4" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--a1, #8b5cf6)" />
            <stop offset="1" stopColor="var(--a2, #22d3ee)" />
          </linearGradient>
        </defs>
        {/* two interlocking chain links forming an infinity */}
        <rect x="14.5" y="14.5" width="19" height="19" rx="6.5" transform="rotate(45 24 24)"
          stroke="url(#lg1)" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M33.4 14.6c4.7 4.7 4.7 12.2 0 16.9" stroke="url(#lg1)" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M14.6 33.4c-4.7-4.7-4.7-12.2 0-16.9" stroke="url(#lg1)" strokeWidth="4.5" strokeLinecap="round" />
      </svg>
      {withWord && (
        <span className="font-display font-bold tracking-tight text-[1.35em] leading-none">
          LYNK<span className="text-grad">Z</span>
        </span>
      )}
    </span>
  );
}

export function LynkLogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lgm1" x1="4" y1="44" x2="44" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--a1, #8b5cf6)" />
          <stop offset="1" stopColor="var(--a2, #22d3ee)" />
        </linearGradient>
      </defs>
      <rect x="14.5" y="14.5" width="19" height="19" rx="6.5" transform="rotate(45 24 24)"
        stroke="url(#lgm1)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M33.4 14.6c4.7 4.7 4.7 12.2 0 16.9" stroke="url(#lgm1)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M14.6 33.4c-4.7-4.7-4.7-12.2 0-16.9" stroke="url(#lgm1)" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
