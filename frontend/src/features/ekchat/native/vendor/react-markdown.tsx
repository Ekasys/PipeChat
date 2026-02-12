import React, { useMemo } from 'react'

type ReactMarkdownProps = {
  children?: any
  className?: string
  components?: any
  remarkPlugins?: any
  rehypePlugins?: any
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function inlineMarkdownToHtml(text: string): string {
  const src = String(text ?? '')
  let i = 0
  let out = ''

  const pushText = (chunk: string) => {
    out += escapeHtml(chunk)
  }

  while (i < src.length) {
    // Links: [label](href)
    if (src[i] === '[') {
      const close = src.indexOf(']', i + 1)
      const openParen = close >= 0 ? src.indexOf('(', close + 1) : -1
      const closeParen = openParen >= 0 ? src.indexOf(')', openParen + 1) : -1
      if (close >= 0 && openParen === close + 1 && closeParen >= 0) {
        const label = src.slice(i + 1, close)
        const href = src.slice(openParen + 1, closeParen)
        out += `<a href="${escapeAttr(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
        i = closeParen + 1
        continue
      }
    }

    // Code spans
    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1)
      if (end !== -1) {
        out += `<code>${escapeHtml(src.slice(i + 1, end))}</code>`
        i = end + 1
        continue
      }
    }

    // Bold+italic
    if (src.startsWith('***', i)) {
      const end = src.indexOf('***', i + 3)
      if (end !== -1) {
        out += `<b><i>${escapeHtml(src.slice(i + 3, end))}</i></b>`
        i = end + 3
        continue
      }
    }

    // Bold
    if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2)
      if (end !== -1) {
        out += `<b>${escapeHtml(src.slice(i + 2, end))}</b>`
        i = end + 2
        continue
      }
    }

    // Italic
    if (src[i] === '*') {
      const end = src.indexOf('*', i + 1)
      if (end !== -1) {
        out += `<i>${escapeHtml(src.slice(i + 1, end))}</i>`
        i = end + 1
        continue
      }
    }

    pushText(src[i])
    i += 1
  }

  return out
}

function splitTableCells(line: string): string[] {
  let src = String(line ?? '').trim()
  if (!src) return []

  if (src.startsWith('|')) src = src.slice(1)
  if (src.endsWith('|')) src = src.slice(0, -1)

  const cells: string[] = []
  let current = ''

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === '\\' && src[i + 1] === '|') {
      current += '|'
      i += 1
      continue
    }
    if (ch === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())

  return cells
}

function parseTableAlignments(line: string): ('left' | 'center' | 'right')[] | null {
  const cells = splitTableCells(line)
  if (!cells.length) return null

  const aligns: ('left' | 'center' | 'right')[] = []
  for (const cell of cells) {
    const compact = cell.replace(/\s+/g, '')
    if (!/^:?-{3,}:?$/.test(compact)) return null

    const left = compact.startsWith(':')
    const right = compact.endsWith(':')
    if (left && right) aligns.push('center')
    else if (right) aligns.push('right')
    else aligns.push('left')
  }

  return aligns
}

function renderTableHtml(headerLine: string, dividerLine: string, bodyLines: string[], tableId: string): string {
  const headers = splitTableCells(headerLine)
  const aligns = parseTableAlignments(dividerLine) || []
  const columnCount = Math.max(headers.length, aligns.length)
  if (!columnCount) return ''

  const normalizedHeaders = headers.slice(0, columnCount)
  while (normalizedHeaders.length < columnCount) normalizedHeaders.push('')

  const normalizedAligns = aligns.slice(0, columnCount)
  while (normalizedAligns.length < columnCount) normalizedAligns.push('left')

  const th = normalizedHeaders
    .map((cell, idx) => `<th style="text-align:${normalizedAligns[idx]}">${inlineMarkdownToHtml(cell)}</th>`)
    .join('')

  const rows = bodyLines
    .map((line) => {
      const row = splitTableCells(line)
      const normalized = row.slice(0, columnCount)
      while (normalized.length < columnCount) normalized.push('')
      const tds = normalized
        .map((cell, idx) => `<td style="text-align:${normalizedAligns[idx]}">${inlineMarkdownToHtml(cell)}</td>`)
        .join('')
      return `<tr>${tds}</tr>`
    })
    .join('')

  return (
    `<div class="md-table-shell" data-md-table-id="${escapeAttr(tableId)}">` +
      `<div class="md-table-toolbar">` +
        `<button type="button" class="md-table-action" data-md-table-action="copy">Copy table</button>` +
        `<button type="button" class="md-table-action" data-md-table-action="csv">Export CSV</button>` +
      `</div>` +
      `<div class="md-table-wrap">` +
        `<table><thead><tr>${th}</tr></thead>${rows ? `<tbody>${rows}</tbody>` : ''}</table>` +
      `</div>` +
    `</div>`
  )
}

function markdownToHtml(md: string): string {
  const parts = String(md ?? '').split(/```/)
  const blocks: string[] = []
  let tableIndex = 0

  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const part = parts[partIndex] ?? ''

    if (partIndex % 2 === 1) {
      // Code fence body (optionally has a language on first line).
      const lines = part.replace(/^\n/, '').split(/\r?\n/)
      const maybeLang = lines[0] ?? ''
      const codeLines = maybeLang.trim() && !maybeLang.includes(' ') && !maybeLang.includes('\t') ? lines.slice(1) : lines
      const code = codeLines.join('\n')
      blocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`)
      continue
    }

    const lines = part.split(/\r?\n/)
    let i = 0
    while (i < lines.length) {
      const raw = lines[i] ?? ''
      const line = raw.replace(/\s+$/, '')

      if (!line.trim()) {
        i += 1
        continue
      }

      const divider = (lines[i + 1] ?? '').replace(/\s+$/, '')
      if (line.includes('|') && divider.includes('-')) {
        const aligns = parseTableAlignments(divider)
        if (aligns && aligns.length > 0) {
          const bodyLines: string[] = []
          i += 2
          while (i < lines.length) {
            const rowLine = (lines[i] ?? '').replace(/\s+$/, '')
            if (!rowLine.trim() || !rowLine.includes('|')) break
            bodyLines.push(rowLine)
            i += 1
          }
          const tableId = `md-table-${tableIndex}`
          tableIndex += 1
          blocks.push(renderTableHtml(line, divider, bodyLines, tableId))
          continue
        }
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/)
      if (heading) {
        const level = Math.min(4, heading[1].length)
        blocks.push(`<h${level}>${inlineMarkdownToHtml(heading[2].trim())}</h${level}>`)
        i += 1
        continue
      }

      const bullet = line.match(/^[-*]\s+(.*)$/)
      const number = line.match(/^\d+[.)]\s+(.*)$/)
      if (bullet || number) {
        const ordered = Boolean(number)
        const items: string[] = []
        while (i < lines.length) {
          const cur = (lines[i] ?? '').replace(/\s+$/, '')
          const m = ordered ? cur.match(/^\d+[.)]\s+(.*)$/) : cur.match(/^[-*]\s+(.*)$/)
          if (!m) break
          items.push(`<li>${inlineMarkdownToHtml((m[1] ?? '').trim())}</li>`)
          i += 1
        }
        blocks.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`)
        continue
      }

      const paraLines: string[] = []
      while (i < lines.length) {
        const cur = (lines[i] ?? '').replace(/\s+$/, '')
        if (!cur.trim()) break
        if (/^(#{1,6})\s+/.test(cur) || /^[-*]\s+/.test(cur) || /^\d+[.)]\s+/.test(cur)) {
          break
        }
        paraLines.push(cur.trim())
        i += 1
      }
      if (paraLines.length) {
        blocks.push(`<p>${paraLines.map(inlineMarkdownToHtml).join('<br/>')}</p>`)
      } else {
        i += 1
      }
    }
  }

  return blocks.join('\n')
}

function normalizeModelHtmlishText(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    // Convert common HTML line/paragraph tags to markdown-friendly newlines.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<p\b[^>]*>/gi, '')
    .replace(/<\/div\s*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '')
    // Remove styling wrappers while preserving inner text.
    .replace(/<\/?font\b[^>]*>/gi, '')
    .replace(/<\/?span\b[^>]*>/gi, '')
    // Handle escaped HTML tags that some models emit literally.
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/&lt;\/p&gt;/gi, '\n\n')
    .replace(/&lt;p[^&]*&gt;/gi, '')
    .replace(/&lt;\/div&gt;/gi, '\n')
    .replace(/&lt;div[^&]*&gt;/gi, '')
    .replace(/&lt;\/?font[^&]*&gt;/gi, '')
    .replace(/&lt;\/?span[^&]*&gt;/gi, '')
    .replace(/&nbsp;/gi, ' ')
}

function getAuthToken(): string {
  return localStorage.getItem('accessToken') || ''
}

async function downloadAuthedUrl(url: string): Promise<void> {
  const token = getAuthToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const message = await res.text().catch(() => '')
    throw new Error(message || `Download failed (HTTP ${res.status})`)
  }
  const blob = await res.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  window.open(objectUrl, '_blank', 'noopener,noreferrer')
  // Best-effort cleanup: revoke after a short delay so the new tab can load.
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000)
}

function shouldInterceptLink(href: string): boolean {
  if (!href) return false
  if (href.startsWith('/api/ekchat/')) return href.includes('/download')
  if (href.includes('/api/ekchat/')) return href.includes('/download')
  return false
}

function extractTableRows(table: HTMLTableElement): string[][] {
  const rows: string[][] = []
  const trList = Array.from(table.querySelectorAll('tr'))
  for (const tr of trList) {
    const cells = Array.from(tr.querySelectorAll('th,td'))
    if (!cells.length) continue
    rows.push(cells.map((cell) => (cell.textContent || '').trim()))
  }
  return rows
}

function csvEscape(value: string): string {
  const raw = String(value ?? '')
  if (!/[",\n]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

async function copyPlainText(value: string): Promise<void> {
  const text = String(value ?? '')
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'absolute'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

function downloadCsv(content: string, filename = 'table-export.csv'): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10_000)
}

export default function ReactMarkdown({ children, className }: ReactMarkdownProps) {
  const source = typeof children === 'string' ? children : String(children ?? '')
  const normalizedSource = useMemo(() => normalizeModelHtmlishText(source), [source])
  const html = useMemo(() => markdownToHtml(normalizedSource), [normalizedSource])

  return (
    <div
      className={className}
      onClick={(e) => {
        const target = e.target as HTMLElement | null
        const tableAction = target?.closest?.('[data-md-table-action]') as HTMLButtonElement | null
        if (tableAction) {
          e.preventDefault()
          e.stopPropagation()
          const shell = tableAction.closest('.md-table-shell')
          const table = shell?.querySelector?.('table') as HTMLTableElement | null
          if (!table) return
          const rows = extractTableRows(table)
          if (!rows.length) return
          const action = tableAction.getAttribute('data-md-table-action')
          if (action === 'copy') {
            const plain = rows.map((row) => row.join('\t')).join('\n')
            copyPlainText(plain).catch(() => {})
            return
          }
          if (action === 'csv') {
            downloadCsv(rowsToCsv(rows))
            return
          }
        }
        const anchor = target?.closest?.('a') as HTMLAnchorElement | null
        const href = anchor?.getAttribute?.('href') || ''
        if (!href || !shouldInterceptLink(href)) return
        e.preventDefault()
        e.stopPropagation()
        downloadAuthedUrl(href).catch(() => {
          // Ignore; the calling UI already surfaces errors elsewhere.
        })
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
