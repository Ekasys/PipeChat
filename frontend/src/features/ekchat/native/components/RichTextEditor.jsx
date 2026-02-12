import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Link2,
  Unlink,
  Eraser,
} from 'lucide-react'

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Calibri', value: 'Calibri' },
  { label: 'Cambria', value: 'Cambria' },
  { label: 'Garamond', value: 'Garamond' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Courier New', value: 'Courier New' },
]

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48]

const BLOCK_FORMATS = [
  { label: 'Paragraph', value: 'p' },
  { label: 'Heading 1', value: 'h1' },
  { label: 'Heading 2', value: 'h2' },
  { label: 'Heading 3', value: 'h3' },
  { label: 'Heading 4', value: 'h4' },
]

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing…',
  className = '',
}){
  const editorRef = useRef(null)
  const lastHtmlRef = useRef(value || '')
  const lastRangeRef = useRef(null)

  const saveSelection = useCallback(()=>{
    const editor = editorRef.current
    const sel = document.getSelection?.()
    if (!editor || !sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const container = range.commonAncestorContainer
    const node = container?.nodeType === 1 ? container : container?.parentNode
    if (!node || !editor.contains(node)) return
    try{
      lastRangeRef.current = range.cloneRange()
    }catch{
      lastRangeRef.current = null
    }
  }, [])

  const restoreSelection = useCallback(()=>{
    const editor = editorRef.current
    const range = lastRangeRef.current
    const sel = document.getSelection?.()
    if (!editor || !range || !sel) return
    try{
      sel.removeAllRanges()
      sel.addRange(range)
    }catch{
      // If the DOM changed and range is invalid, ignore.
    }
  }, [])

  useEffect(()=>{
    const el = editorRef.current
    if (!el) return
    if ((value || '') === lastHtmlRef.current) return
    el.innerHTML = value || ''
    lastHtmlRef.current = value || ''
  }, [value])

  const emitChange = useCallback(()=>{
    const html = editorRef.current?.innerHTML || ''
    lastHtmlRef.current = html
    onChange?.(html)
  }, [onChange])

  const withFocus = useCallback((fn)=>{
    editorRef.current?.focus()
    restoreSelection()
    fn()
    emitChange()
    saveSelection()
  }, [emitChange, restoreSelection, saveSelection])

  const exec = useCallback((command, valueArg)=>{
    withFocus(()=>document.execCommand(command, false, valueArg))
  }, [withFocus])

  const applyFontFamily = useCallback((family)=>{
    if (!family) return
    exec('fontName', family)
  }, [exec])

  const applyFontSizePt = useCallback((pt)=>{
    const size = Number(pt)
    if (!Number.isFinite(size) || size <= 0) return
    withFocus(()=>{
      document.execCommand('fontSize', false, 7)
      const editor = editorRef.current
      if (!editor) return
      editor.querySelectorAll('font[size="7"]').forEach(node=>{
        node.removeAttribute('size')
        node.style.fontSize = `${size}pt`
      })
    })
  }, [withFocus])

  const applyBlockFormat = useCallback((tag)=>{
    const valueArg = String(tag || 'p')
    exec('formatBlock', valueArg.startsWith('<') ? valueArg : `<${valueArg}>`)
  }, [exec])

  const onCreateLink = useCallback(()=>{
    const url = window.prompt('Enter link URL')
    if (!url) return
    exec('createLink', url)
  }, [exec])

  const toolbarButtons = useMemo(()=>[
    { key: 'bold', title: 'Bold', icon: Bold, onClick: ()=>exec('bold') },
    { key: 'italic', title: 'Italic', icon: Italic, onClick: ()=>exec('italic') },
    { key: 'underline', title: 'Underline', icon: Underline, onClick: ()=>exec('underline') },
    { key: 'strike', title: 'Strikethrough', icon: Strikethrough, onClick: ()=>exec('strikeThrough') },
    { key: 'ul', title: 'Bulleted list', icon: List, onClick: ()=>exec('insertUnorderedList') },
    { key: 'ol', title: 'Numbered list', icon: ListOrdered, onClick: ()=>exec('insertOrderedList') },
    { key: 'left', title: 'Align left', icon: AlignLeft, onClick: ()=>exec('justifyLeft') },
    { key: 'center', title: 'Align center', icon: AlignCenter, onClick: ()=>exec('justifyCenter') },
    { key: 'right', title: 'Align right', icon: AlignRight, onClick: ()=>exec('justifyRight') },
    { key: 'justify', title: 'Justify', icon: AlignJustify, onClick: ()=>exec('justifyFull') },
    { key: 'undo', title: 'Undo', icon: Undo, onClick: ()=>exec('undo') },
    { key: 'redo', title: 'Redo', icon: Redo, onClick: ()=>exec('redo') },
    { key: 'link', title: 'Insert link', icon: Link2, onClick: onCreateLink },
    { key: 'unlink', title: 'Remove link', icon: Unlink, onClick: ()=>exec('unlink') },
    { key: 'clear', title: 'Clear formatting', icon: Eraser, onClick: ()=>exec('removeFormat') },
  ], [exec, onCreateLink])

  return (
    <div className={`rte ${className}`}>
      <div className="rte-toolbar">
        <select
          className="rte-select"
          onChange={(e)=>applyFontFamily(e.target.value)}
          defaultValue=""
          aria-label="Font family"
        >
          {FONT_FAMILIES.map(f=>(
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>

        <select
          className="rte-select"
          onChange={(e)=>applyFontSizePt(e.target.value)}
          defaultValue="11"
          aria-label="Font size"
        >
          {FONT_SIZES.map(size=>(
            <option key={size} value={size}>{size} pt</option>
          ))}
        </select>

        <select
          className="rte-select"
          onChange={(e)=>applyBlockFormat(e.target.value)}
          defaultValue="p"
          aria-label="Block style"
        >
          {BLOCK_FORMATS.map(b=>(
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>

        <div className="rte-divider" />

        <div className="rte-buttons">
          {toolbarButtons.map(btn=>{
            const Icon = btn.icon
            return (
              <button
                key={btn.key}
                type="button"
                className="rte-btn"
                title={btn.title}
                onClick={btn.onClick}
              >
                <Icon size={16}/>
              </button>
            )
          })}
        </div>
      </div>

      <div
        ref={editorRef}
        className="rte-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={()=>{
          emitChange()
          saveSelection()
        }}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
        onBlur={emitChange}
        data-placeholder={placeholder}
      />
    </div>
  )
}
