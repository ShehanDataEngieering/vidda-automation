import type { ReactNode } from 'react';
import { brand } from '@/lib/brand';
import { cn } from '@/lib/utils';

// Same 8-point mark as Logo.tsx, plotted on a 32x32 grid.
const ACCENT_STAR = '16,2 18.83,13.17 30,16 18.83,18.83 16,30 13.17,18.83 2,16 13.17,13.17';

// Abstract stand-ins for photography — a diagonal hairline field on espresso,
// a soft glow on cream — used behind hero/section content instead of stock imagery.
// The full-bleed texture SVG uses preserveAspectRatio="slice", which crops
// differently depending on the container's aspect ratio — fine for a repeating
// pattern, but anything meant to sit in a specific spot (the accent star) is
// rendered as its own small, corner-anchored SVG instead so it can't drift
// into content at unexpected container sizes.
// The decorative SVGs and any children are all positioned, so children (later in
// DOM order) paint above them regardless of the parent's own stacking context.
export function GradientPanel({
  variant = 'dark', className, children,
}: {
  variant?: 'dark' | 'light';
  className?: string;
  children?: ReactNode;
}) {
  if (variant === 'dark') {
    return (
      <div
        className={cn('relative overflow-hidden rounded-xl', className)}
        style={{ background: `radial-gradient(circle at 28% 22%, ${brand.espressoLight}, ${brand.espresso} 62%)` }}
      >
        <svg width="100%" height="100%" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0">
          <defs>
            <pattern id="vidda-diag-lines" width="22" height="22" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="22" stroke={brand.amber} strokeWidth="1" opacity="0.14" />
            </pattern>
          </defs>
          <rect width="320" height="200" fill="url(#vidda-diag-lines)" />
        </svg>
        <svg viewBox="0 0 32 32" aria-hidden="true" className="absolute top-4 right-4 h-6 w-6 opacity-90">
          <polygon points={ACCENT_STAR} fill={brand.amber} />
        </svg>
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl', className)}
      style={{ background: `linear-gradient(135deg, ${brand.cream}, ${brand.creamText})` }}
    >
      <svg width="100%" height="100%" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0">
        <circle cx="70" cy="160" r="95" fill="none" stroke={brand.espresso} strokeOpacity="0.07" strokeWidth="34" />
        <circle cx="262" cy="30" r="58" fill={brand.amber} opacity="0.16" />
      </svg>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="absolute bottom-4 right-4 h-5 w-5 opacity-60">
        <polygon points={ACCENT_STAR} fill={brand.espresso} />
      </svg>
      {children}
    </div>
  );
}
