// frontend/src/components/RightDock.jsx
import React, { useEffect, useRef, useState } from 'react'
import { fileDownloadUrl } from '../api.js'
import { useToast } from './ToastProvider'

export default function RightDock({ chatId, files, onUpload, onDelete, open, setOpen }) {
  const { notify } = useToast()
  const drawerRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const prevent = (e) => { e.preventDefault(); e.stopPropagation() }
  const onDragEnter = (e) => { prevent(e); setDragOver(true) }
  const onDragOver  = (e) => { prevent(e); setDragOver(true) }
  const onDragLeave = (e) => { prevent(e); setDragOver(false) }
  const onDrop = async (e) => {
    prevent(e); setDragOver(false)
    if (!chatId){
      notify('Open or create a chat first.', { tone: 'error' })
      return
    }
    const fs = Array.from(e.dataTransfer.files || [])
    if (!fs.length) return
    await onUpload(fs)
  }

  const clickPick = () => inputRef.current?.click()
  const onPick = async (e) => {
    const fs = Array.from(e.target.files || [])
    if (!fs.length) return
    await onUpload(fs)
    e.target.value = ''
  }

  return (
    <>
      {/* Right opener */}
      <button
        className="burger-fab-right"
        title={open ? 'Files open' : 'Open files'}
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen(true)}
      >
        ⧉
      </button>

      {/* Scrim */}
      <div className={`scrim-right ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`drawer-right ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Files"
      >
        <div className="drawer-header">
          <strong>Files</strong>
          <div style={{marginLeft:'auto'}}>
            <button className="icon-btn" title="Close" onClick={() => setOpen(false)}>×</button>
          </div>
        </div>

        {/* Upper division: file list */}
        <div className="files-pane">
          {files && files.length ? (
            files.map((name) => (
              <div key={name} className="file-item" style={{display:'flex', alignItems:'center', gap:8}}>
                <a
                  className="linklike"
                  href={chatId ? fileDownloadUrl(chatId, name) : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}
                >
                  {name}
                </a>
                <button
                  className="icon-btn"
                  type="button"
                  title="Delete file"
                  onClick={(e)=>{ e.preventDefault(); onDelete?.(name) }}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <div className="hint" style={{padding:12}}>No files yet.</div>
          )}
        </div>

        {/* Bottom division: dropzone */}
        <div
          className={`dropzone ${dragOver ? 'dragover' : ''}`}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={clickPick}
          title="Drag & drop or click to upload"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx"
            style={{ display: 'none' }}
            onChange={onPick}
          />
          <div className="dropzone-text">
            <div style={{fontWeight:600}}>Drag & drop files</div>
            <div className="hint">PDF or DOCX · or click to choose</div>
          </div>
        </div>
      </div>
    </>
  )
}
