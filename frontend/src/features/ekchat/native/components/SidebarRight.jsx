import React, { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Upload, FileText, Trash2 } from 'lucide-react'
import { useToast } from './ToastProvider'

export default function SidebarRight({ api, chatId, files = [], onFilesChanged, open, onToggle }){
  const { notify } = useToast()
  const [drag, setDrag] = useState(false)
  const dropRef = useRef(null)

  function onClickFile(name){
    if (!chatId) return
    const url = `${api}/files/download?chat_id=${encodeURIComponent(chatId)}&name=${encodeURIComponent(name)}`
    window.open(url, '_blank', 'noopener')
  }

  async function onUpload(inputFiles){
    if (!chatId || !inputFiles?.length) return
    const fd = new FormData()
    fd.append('chat_id', chatId)
    for (const f of inputFiles) fd.append('files', f)
    try{
      const res = await fetch(`${api}/files/upload`, {method:'POST', body: fd})
      if (!res.ok){
        let errMsg = 'Failed to upload files.'
        try{
          const detail = await res.json()
          errMsg = detail?.detail || detail?.message || errMsg
        }catch{
          errMsg = (await res.text()) || errMsg
        }
        throw new Error(errMsg)
      }
      let data = null
      try{ data = await res.json() }catch{}
      const message = data?.message || 'Files indexed.'
      notify(message, { tone: 'success' })
      await onFilesChanged?.(chatId)
    }catch(err){
      console.error('File upload failed', err)
      notify(err?.message || 'Could not upload files. Please try again.', { tone: 'error' })
    }
  }

  // DnD
  useEffect(()=>{
    const el = dropRef.current
    if (!el) return
    const over = (e)=>{ e.preventDefault(); setDrag(true) }
    const leave = (e)=>{ e.preventDefault(); setDrag(false) }
    const drop = (e)=>{ e.preventDefault(); setDrag(true); const fl = [...(e.dataTransfer?.files || [])]; onUpload(fl) }
    el.addEventListener('dragover', over)
    el.addEventListener('dragleave', leave)
    el.addEventListener('drop', drop)
    return ()=>{ el.removeEventListener('dragover', over); el.removeEventListener('dragleave', leave); el.removeEventListener('drop', drop) }
  },[chatId])

  return (
    <div className="rightbar">
      <div className="rightbar-head">
        <div className="rightbar-title">Files</div>
        <button className="icon-btn" onClick={onToggle} title={open?'Collapse':'Expand'}>
          {open ? <ChevronRight size={18}/> : <ChevronLeft size={18}/> }
        </button>
      </div>
      <div className="rightbar-body">
        <div className="file-stack">
          <div className="file-list">
            {files.length===0 && <div style={{padding:'8px 10px', color:'var(--muted)'}}>No files yet.</div>}
            {files.map(name=>(
              <div key={name} className="file-item" title="Open in a new tab" style={{display:'flex', alignItems:'center', gap:8}}>
                <button type="button" onClick={()=>onClickFile(name)} className="linklike" style={{display:'flex', alignItems:'center', gap:6, flex:1}}>
                  <FileText size={16}/> <div className="label" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{name}</div>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Delete file"
                  onClick={async (e)=>{
                    e.stopPropagation()
                    if (!chatId) return
                    try{
                      const res = await fetch(`${api}/files/delete`, {
                        method:'POST',
                        headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ chat_id: chatId, name })
                      })
                      if (!res.ok){
                        const msg = await res.text()
                        throw new Error(msg || 'Delete failed.')
                      }
                      await onFilesChanged?.(chatId)
                    }catch(err){
                      console.error('Delete failed', err)
                      notify(err?.message || 'Could not delete file.', { tone: 'error' })
                    }
                  }}
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>

          <div ref={dropRef} className={`drop-zone ${drag?'drag':''}`}>
            <div style={{display:'flex', gap:8, alignItems:'center', justifyContent:'center'}}>
              <Upload size={16}/> Drag & drop files here
            </div>
            <div style={{fontSize:12, marginTop:6}}>…or click to choose</div>
            <input
              type="file" multiple
              onChange={e=>onUpload(e.target.files)}
              style={{position:'absolute', inset:0, opacity:0, cursor:'pointer'}}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
