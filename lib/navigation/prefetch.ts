type RouterPrefetcher = {
  prefetch: (href: string) => void
}

const prefetchedHrefs = new Set<string>()
const scheduledHrefs = new Set<string>()

export function prefetchHrefOnce(router: RouterPrefetcher, href: string) {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  if (!href || prefetchedHrefs.has(href)) {
    return
  }

  prefetchedHrefs.add(href)
  router.prefetch(href)
}

export function schedulePrefetchHref(router: RouterPrefetcher, href: string, timeoutMs = 200) {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const browserWindow = typeof window === 'undefined' ? null : window

  if (
    !browserWindow ||
    !href ||
    prefetchedHrefs.has(href) ||
    scheduledHrefs.has(href)
  ) {
    return
  }

  scheduledHrefs.add(href)

  const flush = () => {
    scheduledHrefs.delete(href)
    prefetchHrefOnce(router, href)
  }

  if (typeof browserWindow.requestIdleCallback === 'function') {
    browserWindow.requestIdleCallback(flush, { timeout: timeoutMs })
    return
  }

  globalThis.setTimeout(flush, timeoutMs)
}
