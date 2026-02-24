'use client'

import { useEffect, useRef } from 'react'

const ACTIVE_DOT_FILL = '#22C55E'
const ACTIVE_DOT_STROKE = 'rgba(255, 255, 255, 0.95)'
const DEFAULT_FAVICON_PATH = '/favicon.ico'

function ensureFaviconLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (existing) {
    return existing
  }

  const fallback = document.createElement('link')
  fallback.rel = 'icon'
  fallback.href = DEFAULT_FAVICON_PATH
  document.head.appendChild(fallback)
  return fallback
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    image.src = src
  })
}

async function createActiveFavicon(baseHref: string): Promise<string> {
  const sourceImage = await loadImage(baseHref)

  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D context is not available')
  }

  context.clearRect(0, 0, size, size)
  context.drawImage(sourceImage, 0, 0, size, size)

  const radius = Math.round(size * 0.16)
  const centerX = size - radius - 3
  const centerY = size - radius - 3

  context.beginPath()
  context.arc(centerX, centerY, radius + 2, 0, Math.PI * 2)
  context.fillStyle = ACTIVE_DOT_STROKE
  context.fill()

  context.beginPath()
  context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  context.fillStyle = ACTIVE_DOT_FILL
  context.fill()

  return canvas.toDataURL('image/png')
}

export function useBotActivityFavicon(isActive: boolean) {
  const faviconLinkRef = useRef<HTMLLinkElement | null>(null)
  const originalHrefRef = useRef<string>(DEFAULT_FAVICON_PATH)
  const activeHrefRef = useRef<string | null>(null)

  useEffect(() => {
    const faviconLink = ensureFaviconLink()
    faviconLinkRef.current = faviconLink
    originalHrefRef.current = faviconLink.href

    return () => {
      if (faviconLinkRef.current) {
        faviconLinkRef.current.href = originalHrefRef.current
      }
    }
  }, [])

  useEffect(() => {
    const faviconLink = faviconLinkRef.current
    if (!faviconLink) {
      return
    }

    let cancelled = false

    if (!isActive) {
      faviconLink.href = originalHrefRef.current
      return () => {
        cancelled = true
      }
    }

    const applyActiveFavicon = async () => {
      try {
        if (!activeHrefRef.current) {
          activeHrefRef.current = await createActiveFavicon(originalHrefRef.current)
        }

        if (!cancelled && activeHrefRef.current) {
          faviconLink.href = activeHrefRef.current
        }
      } catch {
        if (!cancelled) {
          faviconLink.href = originalHrefRef.current
        }
      }
    }

    void applyActiveFavicon()

    return () => {
      cancelled = true
    }
  }, [isActive])
}
