import { Fragment, useId } from 'react';

interface TFlowLogoProps {
  className?: string;
  showText?: boolean;
}

function BrandGlyphGraphic({
  bodyGradientId,
  orbitGradientId,
  withOrbit = true,
}: {
  bodyGradientId: string;
  orbitGradientId: string;
  withOrbit?: boolean;
}) {
  return (
    <Fragment>
      {withOrbit ? (
        <path
          d="M10 33C16 36.5 25 37.8 35 36.5C40.8 35.7 44.8 34.2 48 32"
          fill="none"
          stroke={`url(#${orbitGradientId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.95"
        />
      ) : null}

      <path
        d="M10 25.5L41 11L31.5 25L45 29L18.5 38L24.5 27.5L10 25.5Z"
        fill={`url(#${bodyGradientId})`}
      />

      <path
        d="M10 25.5L41 11L24.5 27.5"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M24.5 27.5L45 29"
        fill="none"
        stroke="rgba(17,24,39,0.45)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      <circle cx="10" cy="25.5" r="3.5" fill="#38BDF8" />
      <circle cx="44.5" cy="15" r="2.2" fill="#8B5CF6" opacity="0.9" />
    </Fragment>
  );
}

export function TFlowLogo({ className = '', showText = true }: TFlowLogoProps) {
  const bodyGradientId = useId();
  const orbitGradientId = useId();
  const wordmarkId = useId();

  return (
    <svg
      viewBox={showText ? '0 0 190 52' : '0 0 56 48'}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CBTooll"
    >
      <defs>
        <linearGradient id={bodyGradientId} x1="8" y1="10" x2="44" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#4F7CFF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id={orbitGradientId} x1="10" y1="30" x2="48" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id={wordmarkId} x1="70" y1="12" x2="184" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#4F7CFF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      <BrandGlyphGraphic
        bodyGradientId={bodyGradientId}
        orbitGradientId={orbitGradientId}
        withOrbit
      />

      {showText ? (
        <text
          x="68"
          y="33"
          fill={`url(#${wordmarkId})`}
          fontSize="26"
          fontWeight="800"
          letterSpacing="0.2"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          CBTooll
        </text>
      ) : null}
    </svg>
  );
}

export function CompactLogo({ className = '' }: { className?: string }) {
  const bodyGradientId = useId();
  const orbitGradientId = useId();

  return (
    <svg
      viewBox="0 0 56 48"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CBTooll"
    >
      <defs>
        <linearGradient id={bodyGradientId} x1="8" y1="10" x2="44" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#4F7CFF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id={orbitGradientId} x1="10" y1="30" x2="48" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <BrandGlyphGraphic
        bodyGradientId={bodyGradientId}
        orbitGradientId={orbitGradientId}
        withOrbit
      />
    </svg>
  );
}
