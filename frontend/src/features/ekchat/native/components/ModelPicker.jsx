import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function ModelPicker({ models = [], value, onChange }){
  const [val, setVal] = useState(value || models[0] || '')
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(()=>{
    setVal(value || models[0] || '')
  }, [value, models])

  useEffect(()=>{
    if (!open) return
    function onDocumentClick(e){
      if (!rootRef.current?.contains(e.target)){
        setOpen(false)
      }
    }
    function onKeyDown(e){
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onKeyDown)
    return ()=>{
      document.removeEventListener('mousedown', onDocumentClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const label = useMemo(()=> val || 'Select model', [val])

  function handleSelect(model){
    setVal(model)
    onChange?.(model)
    setOpen(false)
  }

  return (
    <div className={`model-picker${open ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="model-display"
        onClick={()=>setOpen(o=>!o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <div className="model-menu" role="listbox">
          {models.map(model=>(
            <button
              key={model}
              type="button"
              className={`model-option${model === val ? ' selected' : ''}`}
              onClick={()=>handleSelect(model)}
              role="option"
              aria-selected={model === val}
            >
              {model}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
