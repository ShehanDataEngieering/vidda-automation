import { brand } from '@/lib/brand';

// Eight-point mark, plotted on a 32x32 grid (center 16,16; outer radius 14, inner radius 4).
const MARK_POINTS = '16,2 18.83,13.17 30,16 18.83,18.83 16,30 13.17,18.83 2,16 13.17,13.17';

export function LogoMark({ size = 24, color = brand.amber }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <polygon points={MARK_POINTS} fill={color} />
    </svg>
  );
}

// Mark inside a rounded tile — used for nav/sidebar slots.
export function LogoTile({ size = 28 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md"
      style={{ width: size, height: size, background: brand.amber }}
    >
      <LogoMark size={Math.round(size * 0.55)} color={brand.espresso} />
    </div>
  );
}

// Mark + wordmark, for standalone placements (auth screens, empty states).
export function Logo({ variant = 'dark', className }: { variant?: 'dark' | 'light'; className?: string }) {
  const textColor = variant === 'dark' ? brand.creamTextBright : brand.espresso;
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <LogoMark size={22} />
      <span style={{ fontWeight: 600, fontSize: 18, color: textColor, letterSpacing: '-0.01em' }}>
        Vidda
      </span>
    </div>
  );
}
