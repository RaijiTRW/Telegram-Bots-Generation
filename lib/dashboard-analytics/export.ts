import 'server-only'

import * as XLSX from 'xlsx'

export type DashboardExportSheet = {
  name: string
  headers: string[]
  rows: Array<Array<string | number | null | undefined>>
}

export type DashboardExportPayload = {
  filename: string
  mimeType: string
  contentBase64: string
}

function normalizeSheetName(value: string) {
  const trimmed = value.trim() || 'Sheet'
  return trimmed.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet'
}

export function buildBase64CsvPayload(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): DashboardExportPayload {
  const content = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const text = cell === null || cell === undefined ? '' : String(cell)
          if (/[",\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`
          }
          return text
        })
        .join(',')
    )
    .join('\n')

  return {
    filename,
    mimeType: 'text/csv;charset=utf-8;',
    contentBase64: Buffer.from(content, 'utf-8').toString('base64'),
  }
}

export function buildBase64XlsxPayload(
  filename: string,
  sheets: DashboardExportSheet[]
): DashboardExportPayload {
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const rows = [sheet.headers, ...sheet.rows]
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, normalizeSheetName(sheet.name))
  }

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
  }) as Buffer

  return {
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    contentBase64: buffer.toString('base64'),
  }
}
