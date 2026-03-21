export type PerformanceModeValue = 'lite' | 'full'

export function shouldUseLiteMode(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lowCores =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2
  const lowMemory =
    'deviceMemory' in navigator &&
    typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 'number' &&
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0) <= 2
  const connection = navigator as Navigator & {
    connection?: { saveData?: boolean }
  }
  const saveData = Boolean(connection.connection?.saveData)

  return reducedMotion || lowCores || lowMemory || saveData
}

export function readPerformanceMode(): PerformanceModeValue {
  if (typeof document === 'undefined') {
    return 'full'
  }

  return document.documentElement.getAttribute('data-performance') === 'full'
    ? 'full'
    : 'lite'
}
