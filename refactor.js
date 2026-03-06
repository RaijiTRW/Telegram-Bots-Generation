const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, 'components/admin/docs-cms/docs-cms-editor.tsx')
let code = fs.readFileSync(file, 'utf8')

// 1. Add imports
code = code.replace(
    "import { Button } from '@/components/ui/button'",
    "import { TipTapEditor } from './tiptap-editor'\nimport { Button } from '@/components/ui/button'"
)

// Add convertBlocksToHtml above DocsCmsEditor
const convertFunc = `
function convertBlocksToHtml(blocks: DocsBlock[]): string {
  if (!blocks || blocks.length === 0) return ''
  if (blocks.length === 1 && blocks[0].type === 'richText') return (blocks[0] as any).content

  let html = ''
  for (const block of blocks) {
    if (block.type === 'richText') {
      html += (block as any).content
    } else if (block.type === 'heading') {
      html += \`<h\${(block as any).level}>\${(block as any).text}</h\${(block as any).level}>\`
    } else if (block.type === 'paragraph') {
      html += \`<p>\${(block as any).richText.replace(/\\n/g, '<br/>')}</p>\`
    } else if (block.type === 'list') {
      const tag = (block as any).ordered ? 'ol' : 'ul'
      html += \`<\${tag}>\${(block as any).items.map((i: string) => \`<li>\${i}</li>\`).join('')}</\${tag}>\`
    } else if (block.type === 'image') {
      html += \`<img src="\${(block as any).url}" alt="\${(block as any).alt || ''}" />\`
    } else if (block.type === 'code') {
      html += \`<pre><code>\${(block as any).code}</code></pre>\`
    } else if (block.type === 'divider') {
      html += \`<hr/>\`
    } else if (block.type === 'callout') {
      html += \`<blockquote><strong>\${(block as any).title}</strong><br/>\${(block as any).text}</blockquote>\`
    }
  }
  return html
}
`
code = code.replace('export function DocsCmsEditor() {', convertFunc + '\nexport function DocsCmsEditor() {')

// 2. Remove states and references
code = code.replace(/const \[newBlockType[^\n]+\n/g, '')
code = code.replace(/const \[draggedBlockId[^\n]+\n/g, '')
code = code.replace(/const \[uploadStateByBlockId[^\n]+\n/g, '')
code = code.replace(/const mediaInputRefs[^\n]+\n/g, '')
code = code.replace(/const \[viewMode[^\n]+\n/g, '')

// 3. Remove block editing functions
const funcsToRemove = [
    'const addBlock = ',
    'const updateBlock = ',
    'const removeBlock = ',
    'const duplicateBlock = ',
    'const moveBlock = ',
    'const onBlockDrop = ',
    'const updateBlockUploadState = ',
    'const uploadMediaForBlock = '
]

for (const func of funcsToRemove) {
    let startIdx = code.indexOf(func)
    if (startIdx > -1) {
        let bracketCount = 0
        let i = startIdx
        let started = false
        while (i < code.length) {
            if (code[i] === '{') { bracketCount++; started = true }
            else if (code[i] === '}') { bracketCount-- }

            if (started && bracketCount === 0) {
                break
            }
            i++
        }
        code = code.slice(0, startIdx) + code.slice(i + 1)
    }
}

// 4. Replace UI section 
const startUi = '<div className="mb-4 flex flex-wrap items-center justify-between gap-2">'
const endUi = '{notice ? ('
const uiStartIdx = code.indexOf(startUi)
const uiEndIdx = code.indexOf(endUi)

if (uiStartIdx > -1 && uiEndIdx > -1) {
    const newUi = fs.readFileSync(path.join(__dirname, 'new_ui.txt'), 'utf8')
    code = code.slice(0, uiStartIdx) + newUi + code.slice(uiEndIdx)
} else {
    console.log("Failed to find UI start/end indices.")
    process.exit(1)
}

fs.writeFileSync(file, code)
console.log('Done')
