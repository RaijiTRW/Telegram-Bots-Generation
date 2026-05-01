import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

function sliceBetween(source, startMarker, endMarker) {
  const startIndex = source.indexOf(startMarker)
  if (startIndex === -1) {
    throw new Error(`Start marker not found: ${startMarker}`)
  }

  const afterStart = source.slice(startIndex + startMarker.length)
  if (!endMarker) {
    return afterStart
  }

  const endIndex = afterStart.indexOf(endMarker)
  if (endIndex === -1) {
    throw new Error(`End marker not found: ${endMarker}`)
  }

  return afterStart.slice(0, endIndex)
}

function extractMatches(source, pattern) {
  return uniqueSorted([...source.matchAll(pattern)].map((match) => match[1]))
}

function extractNodeTypesFromUnion(source) {
  const unionBody = sliceBetween(source, 'export type NodeType =', '\n\nexport interface Bot')
  return extractMatches(unionBody, /'([^']+)'/g)
}

function extractTopLevelObjectKeys(source, startMarker, endMarker) {
  const block = sliceBetween(source, startMarker, endMarker)
  return extractMatches(block, /^ {2}([A-Za-z][A-Za-z0-9]*):\s*\{/gm)
}

function extractCanvasTypes(source) {
  const block = sliceBetween(source, 'export const nodeTypes = {', '\n}\n\nexport interface NodeTemplate')
  return extractMatches(block, /^ {2}([A-Za-z][A-Za-z0-9]*):/gm)
}

function extractPaletteTypes(source) {
  const block = sliceBetween(source, 'export const nodeTemplates: NodeTemplate[] = [', '\n]')
  return extractMatches(block, /^ {4}type: '([^']+)',/gm)
}

function extractRuntimeTypes(source) {
  return extractMatches(source, /node\.type === '([^']+)'/g)
}

function extractCodegenTypes(source) {
  const nodeLoop = sliceBetween(
    source,
    'for (const node of this.config.nodes) {',
    '\n\n      const handlerCode ='
  )
  const handlerSwitch = sliceBetween(
    source,
    'switch (node.type) {',
    '\n      default:'
  )
  const caseTypes = extractMatches(handlerSwitch, /case '([^']+)':/g)
  const directChecks = extractMatches(nodeLoop, /node\.type === '([^']+)'/g)
  return uniqueSorted([...caseTypes, ...directChecks])
}

function relativeComplement(left, right) {
  return left.filter((item) => !right.includes(item))
}

const botTypesSource = readFile('lib/bot-editor/types/bot.types.ts')
const componentSchemasSource = readFile('lib/bot-editor/types/component-schemas.ts')
const nodeTypesSource = readFile('components/bot-editor/canvas/node-types.tsx')
const runtimeSource = readFile('lib/bot-editor/runtime/workflow-runtime.ts')
const codegenSource = readFile('lib/bot-editor/code-generator/index.ts')

const unionTypes = extractNodeTypesFromUnion(botTypesSource)
const nodeConfigKeys = extractTopLevelObjectKeys(
  componentSchemasSource,
  'export const NODE_CONFIGS: Record<string, NodeConfig> = {',
  '\n}\n\n// ============================================================================\n// DEFAULT DATA'
)
const defaultDataKeys = extractTopLevelObjectKeys(
  componentSchemasSource,
  'export const DEFAULT_NODE_DATA:',
  '\n}'
)
const canvasTypes = extractCanvasTypes(nodeTypesSource)
const paletteTypes = extractPaletteTypes(nodeTypesSource)
const runtimeTypes = extractRuntimeTypes(runtimeSource)
const codegenTypes = extractCodegenTypes(codegenSource)

const legacyHiddenFromPalette = ['comment', 'webhook']

const missingNodeConfigs = relativeComplement(unionTypes, nodeConfigKeys)
const missingDefaultData = relativeComplement(unionTypes, defaultDataKeys)
const missingFromCanvas = relativeComplement(unionTypes, canvasTypes)
const missingFromPalette = relativeComplement(unionTypes, paletteTypes)
const blockingPaletteMissing = missingFromPalette.filter(
  (nodeType) => !legacyHiddenFromPalette.includes(nodeType)
)
const missingFromRuntime = relativeComplement(unionTypes, runtimeTypes)
const jsCodegenMissing = relativeComplement(
  unionTypes.filter((nodeType) => !['trigger', 'comment'].includes(nodeType)),
  codegenTypes
)

const report = {
  pass:
    missingNodeConfigs.length === 0 &&
    missingDefaultData.length === 0 &&
    missingFromCanvas.length === 0 &&
    blockingPaletteMissing.length === 0 &&
    missingFromRuntime.length === 0,
  legacyHiddenFromPalette,
  unionTypes,
  nodeConfigKeys,
  defaultDataKeys,
  canvasTypes,
  paletteTypes,
  runtimeTypes,
  codegenTypes,
  missingNodeConfigs,
  missingDefaultData,
  missingFromCanvas,
  missingFromPalette,
  blockingPaletteMissing,
  missingFromRuntime,
  informational: {
    jsCodegenMissing,
  },
}

console.log(JSON.stringify(report, null, 2))

process.exit(report.pass ? 0 : 1)
