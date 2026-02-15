'use client';

interface MaskedGradientProps {
  direction?: 'top' | 'bottom' | 'left' | 'right' | 'all';
  className?: string;
  children: React.ReactNode;
  intensity?: number; // 0-1, controls gradient strength
}

export function MaskedGradient({
  direction = 'bottom',
  className = '',
  children,
  intensity = 0.4,
}: MaskedGradientProps) {
  const masks = {
    top: `linear-gradient(to bottom, rgba(5, 7, 10, ${intensity}) 0%, rgba(5, 7, 10, ${intensity * 0.6}) 40%, transparent 100%)`,
    bottom: `linear-gradient(to top, rgba(5, 7, 10, ${intensity}) 0%, rgba(5, 7, 10, ${intensity * 0.6}) 40%, transparent 100%)`,
    left: `linear-gradient(to right, rgba(5, 7, 10, ${intensity}) 0%, rgba(5, 7, 10, ${intensity * 0.6}) 40%, transparent 100%)`,
    right: `linear-gradient(to left, rgba(5, 7, 10, ${intensity}) 0%, rgba(5, 7, 10, ${intensity * 0.6}) 40%, transparent 100%)`,
    all: `radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(5, 7, 10, ${intensity}) 100%)`,
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: masks[direction],
        }}
      />
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
