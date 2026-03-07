import type { ReactNode } from 'react'

function parseInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    const [full] = match
    const start = match.index

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start))
    }

    if (full.startsWith('**') && full.endsWith('**')) {
      parts.push(
        <strong key={`b-${key++}`} className="font-semibold text-white">
          {full.slice(2, -2)}
        </strong>,
      )
    } else if (full.startsWith('`') && full.endsWith('`')) {
      parts.push(
        <code
          key={`c-${key++}`}
          className="rounded bg-white/10 px-1 py-0.5 text-[0.95em] text-zinc-100"
        >
          {full.slice(1, -1)}
        </code>,
      )
    } else {
      const linkMatch = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        const [, label, href] = linkMatch
        parts.push(
          <a
            key={`a-${key++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#7dd3fc] underline underline-offset-2 hover:text-[#bae6fd]"
          >
            {label}
          </a>,
        )
      } else {
        parts.push(full)
      }
    }

    lastIndex = start + full.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export function DocsInlineText({ text }: { text: string }) {
  const lines = String(text || '').split('\n')
  return (
    <>
      {lines.map((line, index) => (
        <span key={`line-${index}`}>
          {parseInlineMarkdown(line)}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  )
}
