import React, { useMemo, useState } from 'react'
import { useToast } from './ToastProvider'

function withAuthHeaders(headers = {}){
  const token = localStorage.getItem('accessToken') || ''
  if (!token) return headers
  return {
    ...headers,
    Authorization: `Bearer ${token}`
  }
}

function safeBaseName(value){
  const raw = (value || 'shred-document').toString()
  const base = raw.replace(/\.[^/.]+$/, '')
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return cleaned || 'shred-document'
}

function escapeRegExp(value){
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeKeywords(value){
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,;\n]+/)
      : []
  const cleaned = []
  const seen = new Set()
  for (const item of raw){
    const token = String(item || '').trim().replace(/[.,;:]+$/, '')
    if (!token) continue
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cleaned.push(token)
  }
  return cleaned
}

function buildKeywordRegex(keywords){
  const sorted = [...keywords].sort((a, b)=>b.length - a.length)
  const patterns = sorted
    .map((keyword)=>{
      const trimmed = keyword.trim()
      if (!trimmed) return ''
      const escaped = escapeRegExp(trimmed)
      if (/^[A-Za-z0-9]+$/.test(trimmed)){
        return `\\b${escaped}\\b`
      }
      return escaped
    })
    .filter(Boolean)
  if (!patterns.length) return null
  return new RegExp(`(${patterns.join('|')})`, 'gi')
}

function highlightSummary(text, keywords){
  const summary = (text || '').toString()
  if (!summary) return ''
  const normalized = normalizeKeywords(keywords)
  if (!normalized.length) return summary
  const regex = buildKeywordRegex(normalized)
  if (!regex) return summary
  const nodes = []
  let lastIndex = 0
  let match
  let keyIndex = 0
  while ((match = regex.exec(summary)) !== null){
    const start = match.index
    const end = start + match[0].length
    if (start > lastIndex){
      nodes.push(summary.slice(lastIndex, start))
    }
    nodes.push(<mark key={`kw-${start}-${keyIndex}`}>{match[0]}</mark>)
    keyIndex += 1
    lastIndex = end
  }
  if (lastIndex < summary.length){
    nodes.push(summary.slice(lastIndex))
  }
  return nodes
}

export default function ShredDocumentView({
  api,
  document: shredDoc,
  rows = [],
  loading = false,
  loadingLabel = 'Loading shred document...'
}){
  const { notify } = useToast()
  const [downloadBusy, setDownloadBusy] = useState(false)

  const createdAt = useMemo(()=>{
    const ts = shredDoc?.created_at
    if (!ts) return ''
    const dt = new Date(ts * 1000)
    if (Number.isNaN(dt.getTime())) return ''
    return dt.toLocaleString()
  }, [shredDoc])

  const hasRows = Array.isArray(rows) && rows.length > 0
  const hasDoc = Boolean(shredDoc?.id)
  const canDownload = Boolean(api && shredDoc?.id && hasRows && !loading)

  async function downloadXlsx(){
    if (!canDownload || downloadBusy) return
    setDownloadBusy(true)
    notify('Preparing Excel download...', { tone: 'info' })
    try{
      const url = `${api}/rfp/shred-document/export?document_id=${encodeURIComponent(shredDoc.id)}`
      const res = await fetch(url, { headers: withAuthHeaders() })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Export failed.')
      }
      const blob = await res.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${safeBaseName(shredDoc?.rfp_id)}-shred-document.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
      notify('Download ready.', { tone: 'success' })
    }catch(err){
      notify(err?.message || 'Export failed.', { tone: 'error' })
    }finally{
      setDownloadBusy(false)
    }
  }

  return (
    <div className="shred-doc-card">
      <div className="shred-doc-header">
        <div>
          <div className="shred-doc-title">Shred document</div>
          {shredDoc?.rfp_id && (
            <div className="shred-doc-subtitle">RFP: {shredDoc.rfp_id}</div>
          )}
        </div>
        <div className="shred-doc-right">
          <div className="shred-doc-meta">
            {shredDoc?.model && <span>Model: {shredDoc.model}</span>}
            {shredDoc?.prompt_version && <span>Prompt: {shredDoc.prompt_version}</span>}
            {createdAt && <span>Generated: {createdAt}</span>}
          </div>
          <div className="shred-doc-actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={downloadXlsx}
              disabled={!canDownload || downloadBusy}
            >
              Download Excel
            </button>
          </div>
        </div>
      </div>
      {hasRows ? (
        <div className="shred-doc-table-wrap">
          <table className="shred-doc-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Requirement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx)=>{
                const section = row?.requirement_id || `${idx + 1}`
                const summary = (row?.summary || row?.requirement_text || '').toString()
                return (
                  <tr key={row?.id || `${section}-${idx}`}>
                    <td className="shred-doc-section">{section}</td>
                    <td>
                      <div className="shred-doc-summary">
                        {highlightSummary(summary, row?.keywords)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="shred-doc-empty">
          {loading ? loadingLabel : (hasDoc ? 'No PWS statements found in this RFP.' : 'No shred document yet.')}
        </div>
      )}
    </div>
  )
}
