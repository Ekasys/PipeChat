// frontend/src/components/Composer.jsx
import React, { useMemo, useRef, useState } from 'react'

function slugify(name) {
  const base = name.replace(/\.[^.]+$/, '') // strip extension
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildHighlit(htmlSafeText, knownSlugs) {
  return htmlSafeText.replace(/(^|[\s.,;:!?()[\]{}'"`<>])@([A-Za-z0-9][\w.\-]{0,100})/g, (m, pre, token) => {
    const tokSlug = token.toLowerCase().replace(/[^a-z0-9]+/g, '')
    const matched = knownSlugs.some(s => s === tokSlug || s.startsWith(tokSlug) || s.includes(tokSlug))
    const cls = matched ? 'tag matched' : 'tag'
    const safeToken = escapeHtml(token)
    return `${pre}<mark class="${cls}">@${safeToken}</mark>`
  })
}

export default function Composer({ files = [], onSend, onUpload, uploading, disabled }) {
  const [text, setText] = useState('')
  const fileInputRef = useRef(null)

  const knownSlugs = useMemo(() => files.map(slugify), [files])

  const highlightedHTML = useMemo(() => {
    const safe = escapeHtml(text)
    return buildHighlit(safe, knownSlugs)
  }, [text, knownSlugs])

  const submit = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const selectFiles = () => fileInputRef.current?.click()

  const filesChanged = async (e) => {
    const sel = Array.from(e.target.files || [])
    if (!sel.length) return
    await onUpload(sel)
    e.target.value = ''
  }

  return (
    <div className="composer">
      <div className="wrap">
        <div className="input-stack">
          <div className="highlight-layer" aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightedHTML || '' }} />
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask something… Use @file to restrict context, e.g. @medicalRecords show last week's admissions"
          />
        </div>
        <div className="tools">
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx" onChange={filesChanged} />
          <span className="file-label" onClick={selectFiles}>{uploading ? 'Uploading…' : 'Attach files'}</span>
          <button className="send-btn" onClick={submit} disabled={disabled}>Send</button>
        </div>
      </div>
      <div className="hint">Tip: Use <b>@filename</b> to limit context to a single uploaded file.</div>
    </div>
  )
}