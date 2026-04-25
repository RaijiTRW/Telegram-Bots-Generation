import Image from 'next/image';

interface TFlowLogoProps {
  className?: string;
  showText?: boolean;
  idPrefix?: string;
}

const LOGO_SRC = '/icon.png';

function LogoMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <Image
        src={LOGO_SRC}
        alt="CBTooll"
        width={512}
        height={512}
        priority
        sizes="64px"
        className="h-full w-full translate-y-[3px] object-contain object-center drop-shadow-[0_8px_22px_rgba(59,130,246,0.16)]"
      />
    </span>
  );
}

export function TFlowLogo({ className = '', showText = true, idPrefix = 'cbtooll-logo' }: TFlowLogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label="CBTooll" data-logo-id={idPrefix}>
      <LogoMark className={showText ? 'h-full aspect-square' : 'h-full w-full'} />
      {showText ? (
        <span className="text-xl font-extrabold leading-none tracking-tight gradient-text">CBTooll</span>
      ) : null}
    </span>
  );
}

export function CompactLogo({
  className = '',
  idPrefix = 'cbtooll-compact-logo',
}: {
  className?: string;
  idPrefix?: string;
}) {
  return <LogoMark className={className} key={idPrefix} />;
}
