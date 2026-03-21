'use client';

interface BorderBeamProps {
  roundedClassName?: string;
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export function BorderBeam({
  roundedClassName = '',
  size = 200,
  duration = 15,
  colorFrom = 'rgba(30, 136, 229, 0.5)',
  colorTo = 'rgba(124, 77, 255, 0.5)',
  delay = 0,
}: BorderBeamProps) {
  void size;
  void duration;
  void colorTo;
  void delay;

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${roundedClassName}`}
    >
      <div
        className={`absolute inset-0 ${roundedClassName}`}
        style={{
          border: '1px solid',
          borderColor: colorFrom,
          opacity: 0.14,
        }}
      />
    </div>
  );
}
