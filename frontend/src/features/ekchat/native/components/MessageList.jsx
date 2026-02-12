import React, { useMemo } from 'react'
import { FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function escapeRegExp(value = ''){
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildLinkEntries(files = []){
  const names = files
    .map((file) => {
      if (!file) return null
      if (typeof file === 'string') return file
      if (typeof file?.name === 'string') return file.name
      if (typeof file?.original_name === 'string') return file.original_name
      return null
    })
    .filter((name) => typeof name === 'string' && name.trim())
  if (!names.length) return []

  const baseCounts = new Map()
  for (const name of names){
    const base = name.replace(/\.[^/.]+$/, '')
    if (!base) continue
    const key = base.toLowerCase()
    baseCounts.set(key, (baseCounts.get(key) || 0) + 1)
  }

  const entries = []
  const seen = new Set()
  for (const name of names){
    const fullKey = name.toLowerCase()
    if (!seen.has(fullKey)){
      entries.push({ label: name, name })
      seen.add(fullKey)
    }
    const base = name.replace(/\.[^/.]+$/, '')
    const baseKey = base.toLowerCase()
    if (base && baseCounts.get(baseKey) === 1 && !seen.has(baseKey)){
      entries.push({ label: base, name })
      seen.add(baseKey)
    }
  }

  return entries.sort((a, b) => b.label.length - a.label.length)
}

function linkifySegment(text, entries, baseUrl){
  let out = text
  for (const entry of entries){
    const pattern = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(entry.label)})(?=$|[^A-Za-z0-9])`, 'gi')
    out = out.replace(pattern, (match, prefix, label, offset, full) => {
      if (prefix === '['){
        const after = full.slice(offset + match.length, offset + match.length + 2)
        if (after === '](') return match
      }
      const href = `${baseUrl}${encodeURIComponent(entry.name)}`
      return `${prefix}[${label}](${href})`
    })
  }
  return out
}

function linkifyContent(content, entries, baseUrl){
  if (!content || !entries.length || !baseUrl) return content
  const fenceParts = content.split(/```/)
  const linked = fenceParts.map((part, idx) => {
    if (idx % 2 === 1) return part
    const inlineParts = part.split(/`/)
    const linkedInline = inlineParts.map((chunk, j) => {
      if (j % 2 === 1) return chunk
      const segments = []
      const linkPattern = /\[[^\]]*]\([^)]+\)/g
      let lastIndex = 0
      let match
      while ((match = linkPattern.exec(chunk))){
        if (match.index > lastIndex){
          segments.push(linkifySegment(chunk.slice(lastIndex, match.index), entries, baseUrl))
        }
        segments.push(match[0])
        lastIndex = match.index + match[0].length
      }
      if (lastIndex < chunk.length){
        segments.push(linkifySegment(chunk.slice(lastIndex), entries, baseUrl))
      }
      return segments.join('')
    })
    return linkedInline.join('`')
  })
  return linked.join('```')
}

const ATTACHMENT_LINE = /^\s*(?:[-*]\s*)?(pdf|docx|file)\s*:\s*\[([^\]]+)\]\(([^)]+)\)\s*$/i

function extractAttachments(content){
  if (!content) return { text: content, attachments: [] }
  const lines = content.split(/\r?\n/)
  const attachments = []
  const kept = []
  for (const line of lines){
    const match = line.match(ATTACHMENT_LINE)
    if (match){
      if (kept.length && kept[kept.length - 1].trim() === '---'){
        kept.pop()
      }
      attachments.push({
        kind: match[1].toLowerCase(),
        name: match[2],
        url: match[3]
      })
      continue
    }
    kept.push(line)
  }
  return { text: kept.join('\n'), attachments }
}

export default function MessageList({ messages, linkifyFiles = [], linkifyBaseUrl = '' }) {
  const linkEntries = useMemo(() => buildLinkEntries(linkifyFiles), [linkifyFiles])
  const linkComponents = useMemo(()=>{
    if (!linkifyBaseUrl) return undefined
    return {
      a: ({ href, children, node, ...props }) => {
        const isFileLink = typeof href === 'string' && href.startsWith(linkifyBaseUrl)
        return (
          <a
            href={href}
            {...props}
            target={isFileLink ? '_blank' : undefined}
            rel={isFileLink ? 'noreferrer' : undefined}
          >
            {children}
          </a>
        )
      }
    }
  }, [linkifyBaseUrl])

  return (
    <div className="md">
      {messages.map((m, i) => {
        const raw = (m?.content || '').toString()
        const { text, attachments } = extractAttachments(raw)
        const content = linkifyContent(text, linkEntries, linkifyBaseUrl)
        if (!content.trim() && !attachments.length) return null
        return (
          <div key={i} className="message-chunk">
            {content.trim() && (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={linkComponents}>
                {content}
              </ReactMarkdown>
            )}
            {!!attachments.length && (
              <div className="attachment-list">
                {attachments.map((att, idx) => (
                  <a
                    key={`${att.url}-${idx}`}
                    href={att.url}
                    className="attachment-item"
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e)=>{
                      const href = att.url || ''
                      const isEkchatDownload = href.includes('/api/ekchat/') && href.includes('/download')
                      if (!isEkchatDownload) return
                      e.preventDefault()
                      e.stopPropagation()
                      const token = localStorage.getItem('accessToken') || ''
                      const headers = token ? { Authorization: `Bearer ${token}` } : {}
                      fetch(href, { headers })
                        .then(async (res)=>{
                          if (!res.ok){
                            const message = await res.text().catch(()=> '')
                            throw new Error(message || `Download failed (HTTP ${res.status})`)
                          }
                          const blob = await res.blob()
                          const objectUrl = window.URL.createObjectURL(blob)
                          window.open(objectUrl, '_blank', 'noopener,noreferrer')
                          setTimeout(()=>window.URL.revokeObjectURL(objectUrl), 60_000)
                        })
                        .catch(()=>{})
                    }}
                  >
                    <FileText className="attachment-icon" />
                    <span className="attachment-name">{att.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
