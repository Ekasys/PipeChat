import React, { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'

export default function ReferenceDocModal({ api, reference, onClose }){
  const [doc, setDoc] = useState(null)
  const [status, setStatus] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(()=>{
    let cancelled = false
    if (!reference){
      setDoc(null)
      setStatus('')
      return undefined
    }
    const load = async ()=>{
      setStatus('Loading document...')
      setDoc(null)
      try{
        const res = await fetch(`${api}/rfp/history/doc?name=${encodeURIComponent(reference.doc_id || '')}`)
        const data = await res.json().catch(()=>null)
        if (!res.ok){
          throw new Error(data?.detail || data?.message || 'Failed to load document.')
        }
        if (!cancelled){
          setDoc(data)
          setStatus('')
        }
      }catch(err){
        if (!cancelled){
          setStatus(err?.message || 'Failed to load document.')
        }
      }
    }
    load()
    return ()=>{ cancelled = true }
  }, [api, reference])

  const evidenceSnippet = reference?.evidence_snippet || ''
  const isPdf = Boolean(doc?.is_pdf)
  const page = Number.isFinite(reference?.source_page) ? reference.source_page + 1 : null
  const downloadUrl = reference?.doc_id
    ? `${api}/rfp/history/download?name=${encodeURIComponent(reference.doc_id)}`
    : ''

  useEffect(()=>{
    let cancelled = false
    let objectUrl = ''

    if (!reference || !downloadUrl || !isPdf){
      setPdfUrl('')
      setPdfBusy(false)
      return undefined
    }

    setPdfBusy(true)
    fetch(downloadUrl)
      .then(async (res)=>{
        if (!res.ok){
          const message = await res.text().catch(()=> '')
          throw new Error(message || `Failed to load PDF (HTTP ${res.status})`)
        }
        const blob = await res.blob()
        return window.URL.createObjectURL(blob)
      })
      .then((url)=>{
        objectUrl = url
        if (cancelled){
          window.URL.revokeObjectURL(url)
          return
        }
        setPdfUrl(url)
      })
      .catch((err)=>{
        if (cancelled) return
        setPdfUrl('')
        setStatus(err?.message || 'Failed to load PDF.')
      })
      .finally(()=>{
        if (cancelled) return
        setPdfBusy(false)
      })

    return ()=>{
      cancelled = true
      if (objectUrl){
        window.URL.revokeObjectURL(objectUrl)
      }
    }
  }, [reference, downloadUrl, isPdf])

  const highlighted = useMemo(()=>{
    const text = doc?.text || ''
    if (!text || !evidenceSnippet) return null
    const lower = text.toLowerCase()
    const needle = evidenceSnippet.toLowerCase()
    const idx = lower.indexOf(needle)
    if (idx < 0) return null
    return {
      before: text.slice(0, idx),
      match: text.slice(idx, idx + evidenceSnippet.length),
      after: text.slice(idx + evidenceSnippet.length)
    }
  }, [doc, evidenceSnippet])

  if (!reference) return null

  const metadata = doc?.metadata || {}
  const title = metadata.title || reference.doc_title || reference.doc_id || 'Reference'
  const agency = metadata.agency || reference.doc_agency
  const year = metadata.year || reference.doc_year
  const date = metadata.date
  const naics = metadata.naics

  return (
    <div className="reference-modal-overlay" onClick={onClose}>
      <div className="reference-modal" onClick={(e)=>e.stopPropagation()}>
        <div className="reference-modal-head">
          <div className="reference-modal-title">{title}</div>
          <button className="icon-btn" type="button" onClick={onClose}>
            <X size={16}/>
          </button>
        </div>
        <div className="reference-modal-meta">
          <div><span>Agency:</span> {agency || 'N/A'}</div>
          <div><span>Year:</span> {year || 'N/A'}</div>
          <div><span>Date:</span> {date || 'N/A'}</div>
          <div><span>NAICS:</span> {naics || 'N/A'}</div>
          {page && <div><span>Source page:</span> {page}</div>}
        </div>
        {evidenceSnippet && (
          <div className="reference-modal-evidence">
            <div className="reference-modal-label">Evidence</div>
            <div className="reference-modal-snippet">{evidenceSnippet}</div>
          </div>
        )}
        {status && <div className="reference-modal-status">{status}</div>}
        <div className="reference-modal-body">
          {isPdf ? (
            downloadUrl ? (
              pdfBusy ? (
                <div className="reference-modal-fallback">Loading PDF preview...</div>
              ) : pdfUrl ? (
                <iframe
                  className="reference-modal-frame"
                  src={page ? `${pdfUrl}#page=${page}` : pdfUrl}
                  title={`Reference ${title}`}
                />
              ) : (
                <div className="reference-modal-fallback">Document preview unavailable.</div>
              )
            ) : (
              <div className="reference-modal-fallback">Document preview unavailable.</div>
            )
          ) : (
            <div className="reference-modal-text">
              {doc?.text ? (
                highlighted ? (
                  <>
                    {highlighted.before}
                    <mark>{highlighted.match}</mark>
                    {highlighted.after}
                  </>
                ) : (
                  doc.text
                )
              ) : (
                <div className="reference-modal-fallback">No text available.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
