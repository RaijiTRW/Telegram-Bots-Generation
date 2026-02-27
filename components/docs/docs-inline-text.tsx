import type { ReactNode } from 'react'

function parseBoldMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    const [full, boldText] = match
    const start = match.index

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start))
    }

    parts.push(
      <strong key={`b-${key++}`} className="font-semibold text-white">
        {boldText}
      </strong>,
    )

    lastIndex = start + full.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export function DocsInlineText({ text }: { text: string }) {
  return <>{parseBoldMarkdown(text)}</>
}

