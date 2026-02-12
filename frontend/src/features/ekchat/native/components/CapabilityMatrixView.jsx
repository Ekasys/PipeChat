import React, { useMemo, useState } from 'react'
import ReferenceDocModal from './ReferenceDocModal'
import { useToast } from './ToastProvider'

function withAuthHeaders(headers = {}){
  const token = localStorage.getItem('accessToken') || ''
  if (!token) return headers
  return {
    ...headers,
    Authorization: `Bearer ${token}`
  }
}

const coverageLabels = {
  3: 'Strong',
  2: 'Partial',
  1: 'Limited',
  0: 'Gap'
}

function formatCoverage(score){
  const safeScore = Number.isFinite(score) ? score : 0
  return {
    score: safeScore,
    label: coverageLabels[safeScore] || 'Gap'
  }
}

function safeBaseName(value){
  const raw = (value || 'capability-matrix').toString()
  const base = raw.replace(/\.[^/.]+$/, '')
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return cleaned || 'capability-matrix'
}

function headingLevel(value){
  const raw = (value || '').toString().trim()
  if (!raw) return 1
  const match = raw.match(/^(\d+(?:\.\d+)*)/)
  if (!match) return 1
  const parts = match[1].split('.').filter(Boolean)
  return parts.length || 1
}

function formatEvidenceSource(ref){
  const docId = ref?.doc_id || 'Reference'
  if (Number.isFinite(ref?.source_page)) return `${docId} / p.${ref.source_page + 1}`
  return `${docId} / p.N/A`
}

function excerpt25Words(text){
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  return words.slice(0, 25).join(' ')
}

export default function CapabilityMatrixView({
  api,
  matrix,
  rows = [],
  loading = false
}){
  const { notify } = useToast()
  const [activeRef, setActiveRef] = useState(null)
  const [downloadBusy, setDownloadBusy] = useState(false)

  const createdAt = useMemo(()=>{
    const ts = matrix?.created_at
    if (!ts) return ''
    const dt = new Date(ts * 1000)
    if (Number.isNaN(dt.getTime())) return ''
    return dt.toLocaleString()
  }, [matrix])

  const hasRows = Array.isArray(rows) && rows.length > 0
  const hasMatrix = Boolean(matrix?.id)
  const canDownload = Boolean(api && matrix?.id && hasRows && !loading)

  async function downloadXlsx(){
    if (!canDownload || downloadBusy) return
    setDownloadBusy(true)
    notify('Preparing Excel download...', { tone: 'info' })
    try{
      const url = `${api}/rfp/capability-matrix/export?matrix_id=${encodeURIComponent(matrix.id)}`
      const res = await fetch(url, { headers: withAuthHeaders() })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Export failed.')
      }
      const blob = await res.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${safeBaseName(matrix?.rfp_id)}-capability-matrix.xlsx`
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
    <div className="cap-matrix-card">
      <div className="cap-matrix-header">
        <div>
          <div className="cap-matrix-title">Capability matrix</div>
          {matrix?.rfp_id && (
            <div className="cap-matrix-subtitle">RFP: {matrix.rfp_id}</div>
          )}
        </div>
        <div className="cap-matrix-right">
          <div className="cap-matrix-meta">
            {matrix?.model && <span>Model: {matrix.model}</span>}
            {matrix?.prompt_version && <span>Prompt: {matrix.prompt_version}</span>}
            {createdAt && <span>Generated: {createdAt}</span>}
          </div>
          <div className="cap-matrix-actions">
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
        <div className="cap-matrix-table-wrap">
          <table className="cap-matrix-table">
            <thead>
              <tr>
                <th>RFP Task / Requirement ID</th>
                <th>Clause Breakdown</th>
                <th>Coverage Score (0–3)</th>
                <th>Clause-Level Findings</th>
                <th>Evidence Summary</th>
                <th>Evidence Source (proposal/page)</th>
                <th>Gaps / Required Fixes (exact sentences to add)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx)=>{
                const heading = row?.rfp_requirement_id || row?.capability_area || 'RFP Requirement'
                const level = headingLevel(heading)
                const cappedLevel = Math.min(level, 6)
                const indent = Math.max(0, level - 1) * 14
                const isSection = Boolean(row?.is_section) || !(row?.requirement_text || '').toString().trim()
                const coverage = isSection ? null : formatCoverage(row?.coverage_score)
                const refs = Array.isArray(row?.references) ? row.references.slice(0, 3) : []
                const evidenceSummary = (row?.evidence_excerpts || '').toString().trim()
                const excerptFallback = refs
                  .map(ref => excerpt25Words(ref?.evidence_snippet || ''))
                  .filter(Boolean)
                  .join('\n')
                const evidenceText = isSection ? '' : (evidenceSummary || excerptFallback || 'None')
                const sourcesText = isSection ? '' : (row?.evidence_sources || '').toString().trim()
                return (
                  <tr key={row?.id || `${row?.capability_area}-${idx}`} className={isSection ? 'cap-matrix-row-section' : ''}>
                    <td>
                      <div
                        className={`cap-matrix-heading level-${cappedLevel}`}
                        style={{ marginLeft: `${indent}px` }}
                      >
                        {heading}
                      </div>
                    </td>
                    <td><div className="cap-matrix-pre">{row?.clause_breakdown || ''}</div></td>
                    <td>
                      {isSection ? (
                        <div className="cap-matrix-coverage cap-matrix-section">Section</div>
                      ) : (
                        <div className={`cap-matrix-coverage score-${coverage.score}`}>
                          <span className="cap-matrix-coverage-score">{coverage.score}</span>
                          <span className="cap-matrix-coverage-label">{coverage.label}</span>
                        </div>
                      )}
                    </td>
                    <td><div className="cap-matrix-pre">{isSection ? '' : (row?.rationale || '')}</div></td>
                    <td><div className="cap-matrix-pre">{evidenceText}</div></td>
                    <td>
                      {isSection ? (
                        <div className="cap-matrix-empty" />
                      ) : refs.length ? (
                        <div className="cap-matrix-ref-list">
                          {refs.map((ref, refIdx)=>{
                            const label = formatEvidenceSource(ref)
                            return (
                              <button
                                key={`${ref?.doc_id || 'ref'}-${ref?.source_page ?? 'na'}-${refIdx}`}
                                className="cap-matrix-ref-chip"
                                type="button"
                                title={ref?.evidence_snippet || label}
                                onClick={()=>setActiveRef(ref)}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="cap-matrix-empty">{sourcesText || 'None'}</div>
                      )}
                    </td>
                    <td><div className="cap-matrix-pre">{isSection ? '' : (row?.gaps_actions || '')}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cap-matrix-empty">
          {hasMatrix ? 'No PWS statements found in this RFP.' : 'No capability matrix yet.'}
        </div>
      )}
      <ReferenceDocModal
        api={api}
        reference={activeRef}
        onClose={()=>setActiveRef(null)}
      />
    </div>
  )
}
