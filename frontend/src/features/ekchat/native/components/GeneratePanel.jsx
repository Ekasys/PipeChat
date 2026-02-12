import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Sparkles, Upload, Trash2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import ChatWindow from './ChatWindow'
import ModelPicker from './ModelPicker'
import RichTextEditor from './RichTextEditor'
import CapabilityMatrixView from './CapabilityMatrixView'
import ShredDocumentView from './ShredDocumentView'
import { useToast } from './ToastProvider'
import { streamCapabilityMatrix, streamRfpSection } from '../api'

const EMPTY_MESSAGE = 'No files yet.'
const DRAFT_STORAGE_KEY = 'ekchat.rfpDrafts.v1'
const DEFAULT_LIBRARY_FOLDER = 'past-performance'

function withAuthHeaders(headers = {}){
  const token = localStorage.getItem('accessToken') || ''
  if (!token) return headers
  return {
    ...headers,
    Authorization: `Bearer ${token}`
  }
}

export default function GeneratePanel({
  api,
  models = [],
  defaultModel = '',
  activeTab: controlledTab,
  onTabChange,
  showTabs = true,
  historySubsection = '',
  analyzeSubsection = '',
  onEditNavigate
}){
  const isControlled = typeof controlledTab === 'string'
  const [localTab, setLocalTab] = useState('history')
  const { notify } = useToast()
  const activeTab = isControlled ? controlledTab : localTab
  const setActiveTab = useCallback((nextTab)=>{
    if (onTabChange) onTabChange(nextTab)
    if (!isControlled) setLocalTab(nextTab)
  }, [isControlled, onTabChange])
  const [historyFiles, setHistoryFiles] = useState([])
  const [historyBusy, setHistoryBusy] = useState(false)
  const [libraryFiles, setLibraryFiles] = useState([])
  const [librarySort, setLibrarySort] = useState('modified')
  const [analyzeFiles, setAnalyzeFiles] = useState([])
  const [analyzeBusy, setAnalyzeBusy] = useState(false)
  const [selectedAnalyzeFile, setSelectedAnalyzeFile] = useState('')
  const [analyzeActionsOpen, setAnalyzeActionsOpen] = useState(false)
  const [capabilityMatrix, setCapabilityMatrix] = useState(null)
  const [capabilityMatrixRows, setCapabilityMatrixRows] = useState([])
  const [capMatrixBusy, setCapMatrixBusy] = useState(false)
  const [capMatrixError, setCapMatrixError] = useState('')
  const [capMatrixLoadedFor, setCapMatrixLoadedFor] = useState('')
  const [shredDocument, setShredDocument] = useState(null)
  const [shredRows, setShredRows] = useState([])
  const [shredLoadBusy, setShredLoadBusy] = useState(false)
  const [shredGenerateBusy, setShredGenerateBusy] = useState(false)
  const [shredError, setShredError] = useState('')
  const [shredLoadedFor, setShredLoadedFor] = useState('')
  const [analysisView, setAnalysisView] = useState('capability')
  const [styleBusy, setStyleBusy] = useState(false)
  const [styleProfile, setStyleProfile] = useState('')
  const [styleUpdatedAt, setStyleUpdatedAt] = useState(null)
  const [styleEditing, setStyleEditing] = useState(false)
  const [styleDraft, setStyleDraft] = useState('')
  const [docChat, setDocChat] = useState(null)
  const [docChatBusy, setDocChatBusy] = useState(false)
  const [docChatClearBusy, setDocChatClearBusy] = useState(false)
  const [docChatError, setDocChatError] = useState('')
  const [previewFile, setPreviewFile] = useState('')
  const [analyzePreviewFile, setAnalyzePreviewFile] = useState('')
  const [historyPreviewUrl, setHistoryPreviewUrl] = useState('')
  const [historyPreviewBusy, setHistoryPreviewBusy] = useState(false)
  const [analyzePreviewUrl, setAnalyzePreviewUrl] = useState('')
  const [analyzePreviewBusy, setAnalyzePreviewBusy] = useState(false)
  const [rfpFile, setRfpFile] = useState(null)
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [response, setResponse] = useState('')
  const [responseBusy, setResponseBusy] = useState(false)
  const [responseMode, setResponseMode] = useState('edit')
  const [exportBusy, setExportBusy] = useState(false)
  const [editorHtml, setEditorHtml] = useState('')
  const [editorExportBusy, setEditorExportBusy] = useState(false)
  const [editorLoadBusy, setEditorLoadBusy] = useState(false)
  const [savedDrafts, setSavedDrafts] = useState([])
  const [draftEditingId, setDraftEditingId] = useState('')
  const [draftEditingName, setDraftEditingName] = useState('')
  const [draftPreviewId, setDraftPreviewId] = useState('')
  const [draftPdfUrls, setDraftPdfUrls] = useState({})
  const [draftPdfBusy, setDraftPdfBusy] = useState({})
  const [sectionFile, setSectionFile] = useState(null)
  const [sectionSession, setSectionSession] = useState('')
  const [sectionSections, setSectionSections] = useState([])
  const [sectionAutoGenerate, setSectionAutoGenerate] = useState(true)
  const [sectionGeneratingIndex, setSectionGeneratingIndex] = useState(null)
  const [sectionBusy, setSectionBusy] = useState(false)
  const [sectionExportBusy, setSectionExportBusy] = useState(false)
  const [model, setModel] = useState(defaultModel || models[0] || '')
  const libraryInputRef = useRef(null)
  const analyzeInputRef = useRef(null)
  const rfpInputRef = useRef(null)
  const sectionInputRef = useRef(null)
  const styleCardRef = useRef(null)
  const draftPdfUrlsRef = useRef({})
  const draftPdfInFlight = useRef(new Map())
  const docChatAbortRef = useRef(null)
  const sectionAutoRunSessionRef = useRef('')
  const sectionDraftRef = useRef({ id: '', name: '', createdAt: 0 })
  const sanitizeSchema = useRef({
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), 'b', 'i']
  })
  const pushToast = useCallback((message, tone = 'info', options = {})=>{
    if (!message) return
    notify(message, { tone, ...options })
  }, [notify])

  const isDocChat = activeTab === 'history' && historySubsection === 'chat'
  const draftPreviewDraft = useMemo(()=>{
    if (!draftPreviewId) return null
    return savedDrafts.find(item=>item.id === draftPreviewId) || null
  }, [savedDrafts, draftPreviewId])
  const sortedLibraryFiles = useMemo(()=>{
    const sortKey = librarySort === 'added' ? 'addedAt' : 'modifiedAt'
    return libraryFiles
      .map((file)=>{
        const rawName = String(file?.name || '')
        if (!rawName) return null
        const parts = rawName.split('/')
        const folderHint = (file?.folder || (parts.length > 1 ? parts[0] : '')).trim()
        if (folderHint && folderHint !== DEFAULT_LIBRARY_FOLDER) return null
        return {
          name: rawName,
          displayName: file?.displayName || parts[parts.length - 1] || rawName,
          addedAt: Number(file?.addedAt || file?.added_at || 0),
          modifiedAt: Number(file?.modifiedAt || file?.modified_at || 0)
        }
      })
      .filter(Boolean)
      .sort((a, b)=>(b[sortKey] || 0) - (a[sortKey] || 0))
  }, [libraryFiles, librarySort])

  const escapeHtml = useCallback((text)=>(
    String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  ), [])

  const inlineMarkdownToHtml = useCallback((text)=>{
    const src = String(text || '')
    let i = 0
    let out = ''
    const push = (chunk)=>{ out += escapeHtml(chunk) }
    while (i < src.length){
      if (src.startsWith('***', i)){
        const end = src.indexOf('***', i + 3)
        if (end !== -1){
          out += `<b><i>${escapeHtml(src.slice(i + 3, end))}</i></b>`
          i = end + 3
          continue
        }
      }
      if (src.startsWith('**', i)){
        const end = src.indexOf('**', i + 2)
        if (end !== -1){
          out += `<b>${escapeHtml(src.slice(i + 2, end))}</b>`
          i = end + 2
          continue
        }
      }
      if (src.startsWith('*', i)){
        const end = src.indexOf('*', i + 1)
        if (end !== -1){
          out += `<i>${escapeHtml(src.slice(i + 1, end))}</i>`
          i = end + 1
          continue
        }
      }
      push(src[i])
      i += 1
    }
    return out
  }, [escapeHtml])

  const normalizeModelHtmlishText = useCallback((raw)=>{
    return String(raw || '')
      .replace(/\r\n?/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n\n')
      .replace(/<p\b[^>]*>/gi, '')
      .replace(/<\/div\s*>/gi, '\n')
      .replace(/<div\b[^>]*>/gi, '')
      .replace(/<\/?font\b[^>]*>/gi, '')
      .replace(/<\/?span\b[^>]*>/gi, '')
      .replace(/&lt;br\s*\/?&gt;/gi, '\n')
      .replace(/&lt;\/p&gt;/gi, '\n\n')
      .replace(/&lt;p[^&]*&gt;/gi, '')
      .replace(/&lt;\/div&gt;/gi, '\n')
      .replace(/&lt;div[^&]*&gt;/gi, '')
      .replace(/&lt;\/?font[^&]*&gt;/gi, '')
      .replace(/&lt;\/?span[^&]*&gt;/gi, '')
      .replace(/&nbsp;/gi, ' ')
  }, [])

  const splitTableCells = useCallback((line)=>{
    let src = String(line || '').trim()
    if (!src) return []
    if (src.startsWith('|')) src = src.slice(1)
    if (src.endsWith('|')) src = src.slice(0, -1)

    const cells = []
    let current = ''
    for (let i = 0; i < src.length; i += 1){
      const ch = src[i]
      if (ch === '\\' && src[i + 1] === '|'){
        current += '|'
        i += 1
        continue
      }
      if (ch === '|'){
        cells.push(current.trim())
        current = ''
        continue
      }
      current += ch
    }
    cells.push(current.trim())
    return cells
  }, [])

  const parseTableAlignments = useCallback((line)=>{
    const cells = splitTableCells(line)
    if (!cells.length) return null
    const aligns = []
    for (const cell of cells){
      const compact = cell.replace(/\s+/g, '')
      if (!/^:?-{3,}:?$/.test(compact)) return null
      const left = compact.startsWith(':')
      const right = compact.endsWith(':')
      if (left && right) aligns.push('center')
      else if (right) aligns.push('right')
      else aligns.push('left')
    }
    return aligns
  }, [splitTableCells])

  const renderTableHtml = useCallback((headerLine, dividerLine, bodyLines)=>{
    const headers = splitTableCells(headerLine)
    const aligns = parseTableAlignments(dividerLine) || []
    const columnCount = Math.max(headers.length, aligns.length)
    if (!columnCount) return ''

    const normalizedHeaders = headers.slice(0, columnCount)
    while (normalizedHeaders.length < columnCount) normalizedHeaders.push('')

    const normalizedAligns = aligns.slice(0, columnCount)
    while (normalizedAligns.length < columnCount) normalizedAligns.push('left')

    const head = normalizedHeaders
      .map((cell, idx)=>`<th style="text-align:${normalizedAligns[idx]}">${inlineMarkdownToHtml(cell)}</th>`)
      .join('')

    const rows = bodyLines.map((line)=>{
      const row = splitTableCells(line)
      const normalized = row.slice(0, columnCount)
      while (normalized.length < columnCount) normalized.push('')
      const cols = normalized
        .map((cell, idx)=>`<td style="text-align:${normalizedAligns[idx]}">${inlineMarkdownToHtml(cell)}</td>`)
        .join('')
      return `<tr>${cols}</tr>`
    }).join('')

    return `<div class="md-table-wrap"><table><thead><tr>${head}</tr></thead>${rows ? `<tbody>${rows}</tbody>` : ''}</table></div>`
  }, [inlineMarkdownToHtml, parseTableAlignments, splitTableCells])

  const markdownToHtml = useCallback((md)=>{
    const lines = normalizeModelHtmlishText(md).split(/\r?\n/)
    const blocks = []
    let i = 0
    while (i < lines.length){
      const raw = lines[i]
      const line = raw.replace(/\s+$/, '')
      if (!line.trim()){
        i += 1
        continue
      }
      const divider = (lines[i + 1] || '').replace(/\s+$/, '')
      if (line.includes('|') && divider.includes('-')){
        const aligns = parseTableAlignments(divider)
        if (aligns && aligns.length){
          const bodyLines = []
          i += 2
          while (i < lines.length){
            const rowLine = (lines[i] || '').replace(/\s+$/, '')
            if (!rowLine.trim() || !rowLine.includes('|')) break
            bodyLines.push(rowLine)
            i += 1
          }
          blocks.push(renderTableHtml(line, divider, bodyLines))
          continue
        }
      }
      const heading = line.match(/^(#{1,6})\s+(.*)$/)
      if (heading){
        const level = Math.min(4, heading[1].length)
        blocks.push(`<h${level}>${inlineMarkdownToHtml(heading[2].trim())}</h${level}>`)
        i += 1
        continue
      }
      const bullet = line.match(/^[-*]\s+(.*)$/)
      const number = line.match(/^\d+[.)]\s+(.*)$/)
      if (bullet || number){
        const ordered = Boolean(number)
        const items = []
        while (i < lines.length){
          const cur = lines[i].replace(/\s+$/, '')
          const m = ordered ? cur.match(/^\d+[.)]\s+(.*)$/) : cur.match(/^[-*]\s+(.*)$/)
          if (!m) break
          items.push(`<li>${inlineMarkdownToHtml(m[1].trim())}</li>`)
          i += 1
        }
        blocks.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`)
        continue
      }
      const paraLines = []
      while (i < lines.length){
        const cur = lines[i].replace(/\s+$/, '')
        if (!cur.trim()) break
        if (/^(#{1,6})\s+/.test(cur) || /^[-*]\s+/.test(cur) || /^\d+[.)]\s+/.test(cur)){
          break
        }
        paraLines.push(cur.trim())
        i += 1
      }
      if (paraLines.length){
        blocks.push(`<p>${paraLines.map(inlineMarkdownToHtml).join('<br/>')}</p>`)
      }else{
        i += 1
      }
    }
    return blocks.join('\n')
  }, [inlineMarkdownToHtml, normalizeModelHtmlishText, parseTableAlignments, renderTableHtml])

  const renderMarkdown = useCallback((content)=>(
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema.current]
        ]}
      >
        {content}
      </ReactMarkdown>
    </div>
  ), [])

  const goToEditTab = useCallback(()=>{
    if (onEditNavigate){
      onEditNavigate()
    }else{
      setActiveTab('edit')
    }
  }, [onEditNavigate, setActiveTab])

  const isPdf = useCallback((name)=>/\.pdf$/i.test(name || ''), [])
  const libraryFileUrl = useCallback((name)=>(
    `${api}/rfp/history/download?name=${encodeURIComponent(name || '')}`
  ), [api])
  const analyzeFileUrl = useCallback((name)=>(
    `${api}/rfp/analyze/download?name=${encodeURIComponent(name || '')}`
  ), [api])
  const historyDownloadBase = useMemo(()=>`${api}/rfp/history/download?name=`, [api])

  const fetchBlobUrl = useCallback(async (url, onError)=>{
    const res = await fetch(url)
    if (!res.ok){
      const message = await res.text().catch(()=> '')
      throw new Error(message || `Failed to load file (HTTP ${res.status})`)
    }
    const blob = await res.blob()
    return window.URL.createObjectURL(blob)
  }, [])

  const downloadBlob = useCallback(async (url, filename)=>{
    const res = await fetch(url)
    if (!res.ok){
      const message = await res.text().catch(()=> '')
      throw new Error(message || `Download failed (HTTP ${res.status})`)
    }
    const blob = await res.blob()
    const objectUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(objectUrl)
  }, [])
  const formatDraftTimestamp = useCallback((value)=>{
    const date = value ? new Date(value) : new Date()
    if (Number.isNaN(date.getTime())) return ''
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`
  }, [])
  const buildAutoDraftName = useCallback((prefix, fileName)=>{
    const base = (fileName || '').trim()
    const title = base ? `${prefix} - ${base}` : prefix
    return `${title} (${formatDraftTimestamp(Date.now())})`
  }, [formatDraftTimestamp])

  const loadHistory = useCallback(async ()=>{
    try{
      const res = await fetch(`${api}/rfp/history/list`)
      if (!res.ok) throw new Error('Failed to load library.')
      const data = await res.json()
      const rawFiles = Array.isArray(data?.files) ? data.files : []
      const normalized = rawFiles
        .map(item=>{
          if (typeof item === 'string'){
            return { name: item }
          }
          return {
            name: String(item?.name || ''),
            displayName: String(item?.display_name || item?.displayName || ''),
            folder: String(item?.folder || ''),
            addedAt: Number(item?.added_at || item?.addedAt || 0),
            modifiedAt: Number(item?.modified_at || item?.modifiedAt || 0)
          }
        })
        .filter(item=>item.name)
      const pastPerformance = normalized.filter(item=>{
        const rawName = String(item?.name || '')
        if (!rawName) return false
        const parts = rawName.split('/')
        const folderHint = (item?.folder || (parts.length > 1 ? parts[0] : '')).trim()
        return !folderHint || folderHint === DEFAULT_LIBRARY_FOLDER
      })
      setLibraryFiles(normalized)
      setHistoryFiles(pastPerformance.map(item=>item.name))
    }catch{
      setHistoryFiles([])
      setLibraryFiles([])
    }
  }, [api])
  const loadAnalyze = useCallback(async ()=>{
    try{
      const res = await fetch(`${api}/rfp/analyze/list`)
      if (!res.ok) throw new Error('Failed to load RFPs.')
      const data = await res.json()
      const rawFiles = Array.isArray(data?.files) ? data.files : []
      const normalized = rawFiles
        .map(item => {
          if (!item) return ''
          if (typeof item === 'string') return item
          if (typeof item?.name === 'string') return item.name
          return ''
        })
        .filter(Boolean)
      setAnalyzeFiles(normalized)
    }catch{
      setAnalyzeFiles([])
    }
  }, [api])

  const loadCapabilityMatrix = useCallback(async (name)=>{
    const target = (name || '').trim()
    if (!target){
      setCapabilityMatrix(null)
      setCapabilityMatrixRows([])
      setCapMatrixLoadedFor('')
      setCapMatrixError('')
      return
    }
    setCapMatrixBusy(true)
    setCapMatrixError('')
    pushToast('Loading capability matrix...', 'info')
    try{
      const res = await fetch(`${api}/rfp/capability-matrix/latest?rfp_name=${encodeURIComponent(target)}`, {
        headers: withAuthHeaders()
      })
      if (!res.ok){
        if (res.status === 404){
          setCapabilityMatrix(null)
          setCapabilityMatrixRows([])
          setCapMatrixError('')
          pushToast('No capability matrix generated yet.', 'info')
          setCapMatrixLoadedFor(target)
          return
        }
        const rawText = await res.text().catch(()=> '')
        let data = null
        try{
          data = rawText ? JSON.parse(rawText) : null
        }catch{
          data = null
        }
        const detail = data?.detail || data?.message
        if (detail) throw new Error(detail)
        const trimmed = (rawText || '').toString().trim()
        if (trimmed){
          const titleMatch = trimmed.startsWith('<') ? trimmed.match(/<title>([^<]+)<\/title>/i) : null
          const msg = titleMatch?.[1] ? `${titleMatch[1]} (HTTP ${res.status})` : trimmed.slice(0, 260)
          throw new Error(msg)
        }
        throw new Error(`Failed to load capability matrix (HTTP ${res.status}).`)
      }
      const rawText = await res.text().catch(()=> '')
      let data = null
      try{
        data = rawText ? JSON.parse(rawText) : null
      }catch{
        data = null
      }
      if (!data){
        throw new Error('Capability matrix load returned an invalid response.')
      }
      setCapabilityMatrix(data?.matrix || null)
      setCapabilityMatrixRows(Array.isArray(data?.rows) ? data.rows : [])
      setCapMatrixError('')
      setCapMatrixLoadedFor(target)
    }catch(err){
      setCapabilityMatrix(null)
      setCapabilityMatrixRows([])
      setCapMatrixError(err?.message || 'Capability matrix load failed.')
      pushToast(err?.message || 'Capability matrix load failed.', 'error')
      setCapMatrixLoadedFor('')
    }finally{
      setCapMatrixBusy(false)
    }
  }, [api, pushToast])

  useEffect(()=>{
    if (!Array.isArray(models) || !models.length) return
    const preferred = models.includes(defaultModel) ? defaultModel : models[0]
    if (!model || !models.includes(model)){
      setModel(preferred)
    }
  }, [models, defaultModel, model])

  const loadShredDocument = useCallback(async (name, options = {})=>{
    const { silent = false } = options
    const target = (name || '').trim()
    if (!target){
      setShredDocument(null)
      setShredRows([])
      setShredLoadedFor('')
      setShredError('')
      return
    }
    setShredLoadBusy(true)
    setShredError('')
    if (!silent){
      pushToast('Loading shred document...', 'info')
    }
    try{
      const res = await fetch(`${api}/rfp/shred-document/latest?rfp_name=${encodeURIComponent(target)}`, {
        headers: withAuthHeaders()
      })
      if (!res.ok){
        if (res.status === 404){
          setShredDocument(null)
          setShredRows([])
          setShredError('')
          if (!silent){
            pushToast('No shred document generated yet.', 'info')
          }
          setShredLoadedFor(target)
          return
        }
        const rawText = await res.text().catch(()=> '')
        let data = null
        try{
          data = rawText ? JSON.parse(rawText) : null
        }catch{
          data = null
        }
        const detail = data?.detail || data?.message
        if (detail) throw new Error(detail)
        const trimmed = (rawText || '').toString().trim()
        if (trimmed){
          const titleMatch = trimmed.startsWith('<') ? trimmed.match(/<title>([^<]+)<\/title>/i) : null
          const msg = titleMatch?.[1] ? `${titleMatch[1]} (HTTP ${res.status})` : trimmed.slice(0, 260)
          throw new Error(msg)
        }
        throw new Error(`Failed to load shred document (HTTP ${res.status}).`)
      }
      const rawText = await res.text().catch(()=> '')
      let data = null
      try{
        data = rawText ? JSON.parse(rawText) : null
      }catch{
        data = null
      }
      if (!data){
        throw new Error('Shred document load returned an invalid response.')
      }
      setShredDocument(data?.document || null)
      setShredRows(Array.isArray(data?.rows) ? data.rows : [])
      setShredError('')
      setShredLoadedFor(target)
    }catch(err){
      setShredDocument(null)
      setShredRows([])
      setShredError(err?.message || 'Shred document load failed.')
      if (!silent){
        pushToast(err?.message || 'Shred document load failed.', 'error')
      }
      setShredLoadedFor(target)
    }finally{
      setShredLoadBusy(false)
    }
  }, [api, pushToast])

  const loadStyleProfile = useCallback(async ()=>{
    try{
      const res = await fetch(`${api}/rfp/history/style`)
      if (!res.ok) return
      const data = await res.json()
      setStyleProfile((data?.summary || '').trim())
      setStyleUpdatedAt(data?.updated_at || null)
    }catch{
      setStyleProfile('')
      setStyleUpdatedAt(null)
    }
  }, [api])

  const ensureDocChat = useCallback(async ()=>{
    if (docChatBusy) return
    setDocChatBusy(true)
    setDocChatError('')
    if (docChatAbortRef.current){
      docChatAbortRef.current.abort()
    }
    const controller = new AbortController()
    docChatAbortRef.current = controller
    const timeoutId = window.setTimeout(()=>{
      controller.abort()
    }, 20000)
    try{
      const resolvedModel = (model || '').trim() || (models[0] || '')
      const res = await fetch(`${api}/rfp/history/chat`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ model: resolvedModel }),
        signal: controller.signal
      })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Failed to load document chat.')
      }
      const data = await res.json()
      setDocChat(data?.chat || null)
      setDocChatError('')
    }catch(err){
      if (err?.name === 'AbortError'){
        pushToast('Document chat request timed out. Retry.', 'error')
        setDocChatError('Document chat request timed out. Retry.')
      }else{
        pushToast(err?.message || 'Failed to load document chat.', 'error')
        setDocChatError(err?.message || 'Failed to load document chat.')
      }
      setDocChat(null)
    }finally{
      window.clearTimeout(timeoutId)
      setDocChatBusy(false)
    }
  }, [api, model, models, docChatBusy, pushToast])

  const clearDocChat = useCallback(async (chatId)=>{
    if (!chatId || docChatClearBusy) return
    const ok = window.confirm('Clear this chat? This will remove the conversation but keep your documents.')
    if (!ok) return
    setDocChatClearBusy(true)
    try{
      const res = await fetch(`${api}/rfp/history/chat/clear`, { method: 'POST' })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Failed to clear document chat.')
      }
      await res.json().catch(()=>({}))
      window.dispatchEvent(new CustomEvent('ekchat:refresh-chat', { detail: { chatId } }))
    }catch(err){
      console.error('Clear doc chat failed', err)
      pushToast(err?.message || 'Failed to clear document chat.', 'error')
    }finally{
      setDocChatClearBusy(false)
    }
  }, [api, docChatClearBusy, pushToast])

  const renameDocChatTitle = useCallback(async (chatId, title)=>{
    if (!chatId) return
    const trimmed = (title || '').trim()
    if (!trimmed) return
    try{
      const res = await fetch(`${api}/chats/${chatId}/title`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ title: trimmed })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok){
        throw new Error(data?.detail || 'Failed to rename chat')
      }
      const finalTitle = data?.title || trimmed
      setDocChat(prev => (prev && prev.id === chatId ? { ...prev, title: finalTitle } : prev))
    }catch(err){
      console.error('Rename doc chat failed', err)
      throw err
    }
  }, [api])

  const handleDocChatModel = useCallback((chatId, nextModel)=>{
    if (!chatId) return
    setDocChat(prev => (prev && prev.id === chatId ? { ...prev, model: nextModel } : prev))
  }, [])

  useEffect(()=>{
    loadHistory()
  }, [loadHistory])
  useEffect(()=>{
    if (activeTab !== 'history') return
    if (historySubsection !== 'style') return
    loadStyleProfile()
  }, [activeTab, historySubsection, loadStyleProfile])
  useEffect(()=>{
    if (activeTab !== 'analyze') return
    loadAnalyze()
  }, [activeTab, loadAnalyze])
  useEffect(()=>{
    if (isDocChat && !docChat && !docChatBusy){
      ensureDocChat()
    }
  }, [isDocChat, docChat, docChatBusy, ensureDocChat])
  useEffect(()=>{
    if (isDocChat) return
    if (docChatAbortRef.current){
      docChatAbortRef.current.abort()
      docChatAbortRef.current = null
    }
  }, [isDocChat])
  useEffect(()=>{
    if (activeTab !== 'history') return
    if (historySubsection === 'style' && styleCardRef.current){
      styleCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeTab, historySubsection])
  useEffect(()=>{
    if (activeTab === 'history' && historySubsection && previewFile){
      setPreviewFile('')
    }
  }, [activeTab, historySubsection, previewFile])
  useEffect(()=>{
    if (activeTab !== 'analyze' && analyzePreviewFile){
      setAnalyzePreviewFile('')
    }
  }, [activeTab, analyzePreviewFile])
  useEffect(()=>{
    if (activeTab === 'history') return
    if (draftPreviewId){
      setDraftPreviewId('')
    }
  }, [activeTab, draftPreviewId])
  useEffect(()=>{
    draftPdfUrlsRef.current = draftPdfUrls
  }, [draftPdfUrls])
  useEffect(()=>{
    if (!draftPreviewId) return
    const exists = savedDrafts.some(item=>item.id === draftPreviewId)
    if (!exists){
      setDraftPreviewId('')
    }
  }, [draftPreviewId, savedDrafts])

  useEffect(()=>{
    if (previewFile && !historyFiles.includes(previewFile)){
      setPreviewFile('')
    }
  }, [historyFiles, previewFile])
  useEffect(()=>{
    if (analyzePreviewFile && !analyzeFiles.includes(analyzePreviewFile)){
      setAnalyzePreviewFile('')
    }
  }, [analyzeFiles, analyzePreviewFile])

  useEffect(()=>{
    let cancelled = false
    let objectUrl = ''

    if (!previewFile || !isPdf(previewFile)){
      setHistoryPreviewUrl('')
      setHistoryPreviewBusy(false)
      return undefined
    }

    setHistoryPreviewBusy(true)
    fetchBlobUrl(libraryFileUrl(previewFile))
      .then((url)=>{
        objectUrl = url
        if (cancelled){
          window.URL.revokeObjectURL(url)
          return
        }
        setHistoryPreviewUrl(url)
      })
      .catch((err)=>{
        if (cancelled) return
        setHistoryPreviewUrl('')
        pushToast(err?.message || 'Failed to load preview.', 'error')
      })
      .finally(()=>{
        if (cancelled) return
        setHistoryPreviewBusy(false)
      })

    return ()=>{
      cancelled = true
      if (objectUrl){
        window.URL.revokeObjectURL(objectUrl)
      }
    }
  }, [previewFile, fetchBlobUrl, libraryFileUrl, isPdf, pushToast])

  useEffect(()=>{
    let cancelled = false
    let objectUrl = ''

    if (!analyzePreviewFile || !isPdf(analyzePreviewFile)){
      setAnalyzePreviewUrl('')
      setAnalyzePreviewBusy(false)
      return undefined
    }

    setAnalyzePreviewBusy(true)
    fetchBlobUrl(analyzeFileUrl(analyzePreviewFile))
      .then((url)=>{
        objectUrl = url
        if (cancelled){
          window.URL.revokeObjectURL(url)
          return
        }
        setAnalyzePreviewUrl(url)
      })
      .catch((err)=>{
        if (cancelled) return
        setAnalyzePreviewUrl('')
        pushToast(err?.message || 'Failed to load preview.', 'error')
      })
      .finally(()=>{
        if (cancelled) return
        setAnalyzePreviewBusy(false)
      })

    return ()=>{
      cancelled = true
      if (objectUrl){
        window.URL.revokeObjectURL(objectUrl)
      }
    }
  }, [analyzePreviewFile, fetchBlobUrl, analyzeFileUrl, isPdf, pushToast])
  useEffect(()=>{
    if (selectedAnalyzeFile && !analyzeFiles.includes(selectedAnalyzeFile)){
      setSelectedAnalyzeFile('')
    }
  }, [analyzeFiles, selectedAnalyzeFile])
  useEffect(()=>{
    if (!selectedAnalyzeFile && analyzeActionsOpen){
      setAnalyzeActionsOpen(false)
    }
  }, [selectedAnalyzeFile, analyzeActionsOpen])
  useEffect(()=>{
    if (activeTab !== 'analyze') return
    if (!selectedAnalyzeFile){
      setCapabilityMatrix(null)
      setCapabilityMatrixRows([])
      setCapMatrixLoadedFor('')
      return
    }
    if (capMatrixBusy) return
    if (capMatrixLoadedFor === selectedAnalyzeFile) return
    loadCapabilityMatrix(selectedAnalyzeFile)
  }, [activeTab, selectedAnalyzeFile, capMatrixBusy, capMatrixLoadedFor, loadCapabilityMatrix])
  useEffect(()=>{
    if (activeTab !== 'analyze') return
    if (!selectedAnalyzeFile){
      setShredDocument(null)
      setShredRows([])
      setShredLoadedFor('')
      return
    }
    if (shredLoadBusy || shredGenerateBusy) return
    if (shredLoadedFor === selectedAnalyzeFile) return
    loadShredDocument(selectedAnalyzeFile, { silent: true })
  }, [activeTab, selectedAnalyzeFile, shredLoadBusy, shredGenerateBusy, shredLoadedFor, loadShredDocument])

  useEffect(()=>{
    if (!styleEditing){
      setStyleDraft(styleProfile)
    }
  }, [styleProfile, styleEditing])

  useEffect(()=>{
    if (!sectionSession || !sectionSections.length) return
    if (sectionBusy || sectionGeneratingIndex !== null) return
    if (sectionAutoRunSessionRef.current === sectionSession) return
    const hasDrafts = sectionSections.some(sec => (sec.draft || '').trim())
    if (hasDrafts) return
    sectionAutoRunSessionRef.current = sectionSession
    generateAllSections()
  }, [sectionSession, sectionSections, sectionBusy, sectionGeneratingIndex])

  useEffect(()=>{
    try{
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const cleaned = parsed
        .map(item=>({
          id: String(item?.id || ''),
          name: String(item?.name || '').trim(),
          content: String(item?.content || ''),
          createdAt: Number(item?.createdAt || item?.updatedAt || 0),
          updatedAt: Number(item?.updatedAt || 0)
        }))
        .filter(item=>item.id && item.name)
      setSavedDrafts(cleaned)
    }catch{
      setSavedDrafts([])
    }
  }, [])

  useEffect(()=>{
    try{
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(savedDrafts))
    }catch{
      // Ignore storage errors (quota, privacy mode, etc).
    }
  }, [savedDrafts])
  useEffect(()=>{
    const ids = new Set(savedDrafts.map(item=>item.id))
    setDraftPdfUrls(prev=>{
      const next = { ...prev }
      Object.entries(prev).forEach(([id, url])=>{
        if (!ids.has(id)){
          if (url) URL.revokeObjectURL(url)
          delete next[id]
        }
      })
      return next
    })
    setDraftPdfBusy(prev=>{
      const next = { ...prev }
      Object.keys(prev).forEach(id=>{
        if (!ids.has(id)) delete next[id]
      })
      return next
    })
  }, [savedDrafts])
  useEffect(()=>{
    return () => {
      Object.values(draftPdfUrlsRef.current || {}).forEach(url=>{
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [])

  useEffect(()=>{
    // Keep selected model in sync with available list
    setModel(prev=>{
      if (prev && models.includes(prev)) return prev
      if (defaultModel && models.includes(defaultModel)) return defaultModel
      return models[0] || ''
    })
  }, [models, defaultModel])

  const uploadHistory = useCallback(async (inputFiles, folderId)=>{
    const files = Array.from(inputFiles || [])
    if (!files.length) return
    setHistoryBusy(true)
    pushToast('Uploading files...', 'info')
    const fd = new FormData()
    if (folderId) fd.append('folder', folderId)
    for (const f of files) fd.append('files', f)
    try{
      const folderQuery = folderId ? `?folder=${encodeURIComponent(folderId)}` : ''
      const res = await fetch(`${api}/rfp/history/upload${folderQuery}`, {method:'POST', body: fd})
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Failed to upload files.')
      }
      const data = await res.json()
      pushToast(data?.message || 'Files added to the library.', 'success')
      await loadHistory()
    }catch(err){
      pushToast(err?.message || 'Library upload failed.', 'error')
    }finally{
      setHistoryBusy(false)
    }
  }, [api, loadHistory, pushToast])
  const uploadAnalyze = useCallback(async (inputFiles)=>{
    const files = Array.from(inputFiles || [])
    if (!files.length) return
    setAnalyzeBusy(true)
    pushToast('Uploading RFPs...', 'info')
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    try{
      const res = await fetch(`${api}/rfp/analyze/upload`, {method:'POST', body: fd})
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Failed to upload RFPs.')
      }
      const data = await res.json()
      pushToast(data?.message || 'RFPs uploaded.', 'success')
      await loadAnalyze()
    }catch(err){
      pushToast(err?.message || 'RFP upload failed.', 'error')
    }finally{
      setAnalyzeBusy(false)
      if (analyzeInputRef.current) analyzeInputRef.current.value = ''
    }
  }, [api, loadAnalyze, pushToast])

  const buildStyleProfile = useCallback(async ()=>{
    if (!historyFiles.length){
      pushToast('Upload past responses first.', 'info')
      return
    }
    if (!model){
      pushToast('Select a model to build the style profile.', 'info')
      return
    }
    setStyleBusy(true)
    pushToast('Analyzing writing style...', 'info')
    try{
      const res = await fetch(`${api}/rfp/history/style`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model })
      })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Style profile failed.')
      }
      const data = await res.json()
      setStyleProfile((data?.summary || '').trim())
      setStyleUpdatedAt(data?.updated_at || null)
      pushToast('Style profile saved.', 'success')
    }catch(err){
      pushToast(err?.message || 'Style profile failed.', 'error')
    }finally{
      setStyleBusy(false)
    }
  }, [api, historyFiles.length, model, pushToast])

  const startStyleEdit = useCallback(()=>{
    setStyleDraft(styleProfile || '')
    setStyleEditing(true)
  }, [styleProfile])

  const cancelStyleEdit = useCallback(()=>{
    setStyleEditing(false)
    setStyleDraft(styleProfile || '')
  }, [styleProfile])

  const saveStyleProfile = useCallback(async ()=>{
    const summary = (styleDraft || '').trim()
    if (!summary){
      pushToast('Style profile cannot be empty.', 'error')
      return
    }
    setStyleBusy(true)
    pushToast('Saving style profile...', 'info')
    try{
      const res = await fetch(`${api}/rfp/history/style/edit`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ summary })
      })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Save failed.')
      }
      const data = await res.json()
      const cleaned = (data?.summary || summary).trim()
      setStyleProfile(cleaned)
      setStyleUpdatedAt(data?.updated_at || null)
      setStyleEditing(false)
      pushToast('Style profile updated.', 'success')
    }catch(err){
      pushToast(err?.message || 'Save failed.', 'error')
    }finally{
      setStyleBusy(false)
    }
  }, [api, styleDraft, pushToast])

  const deleteHistoryFile = useCallback(async (name)=>{
    if (!name) return
    setHistoryBusy(true)
    pushToast('Deleting file...', 'info')
    try{
      const res = await fetch(`${api}/rfp/history/delete`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name })
      })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Delete failed.')
      }
      if (previewFile === name){
        setPreviewFile('')
      }
      await loadHistory()
      pushToast('File deleted.', 'success')
    }catch(err){
      pushToast(err?.message || 'Delete failed.', 'error')
    }finally{
      setHistoryBusy(false)
    }
  }, [api, loadHistory, previewFile, pushToast])
  const deleteAnalyzeFile = useCallback(async (name)=>{
    if (!name) return
    setAnalyzeBusy(true)
    pushToast('Deleting file...', 'info')
    try{
      const res = await fetch(`${api}/rfp/analyze/delete`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name })
      })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Delete failed.')
      }
      if (analyzePreviewFile === name){
        setAnalyzePreviewFile('')
      }
      if (selectedAnalyzeFile === name){
        setSelectedAnalyzeFile('')
      }
      await loadAnalyze()
      pushToast('File deleted.', 'success')
    }catch(err){
      pushToast(err?.message || 'Delete failed.', 'error')
    }finally{
      setAnalyzeBusy(false)
    }
  }, [api, loadAnalyze, analyzePreviewFile, selectedAnalyzeFile, pushToast])

  const generateCapabilityMatrix = useCallback(async (name)=>{
    const target = (name || selectedAnalyzeFile || '').trim()
    if (!target){
      pushToast('Select an RFP to generate a capability matrix.', 'info')
      return
    }
    if (!model){
      pushToast('Select a model to generate.', 'info')
      return
    }
    setAnalysisView('capability')
    setCapMatrixBusy(true)
    setCapMatrixError('')
    setCapabilityMatrix({ rfp_id: target })
    setCapabilityMatrixRows([])
    setCapMatrixLoadedFor('')
    pushToast('Generating capability matrix...', 'info')
    let completed = false
    try{
      for await (const evt of streamCapabilityMatrix(target, model)) {
        if (evt?.error){
          throw new Error(evt.error)
        }
        if (evt?.type === 'init'){
          if (evt?.rfp_id){
            setCapabilityMatrix(prev => ({ ...(prev || {}), rfp_id: evt.rfp_id }))
          }
        }
        if (evt?.type === 'row' && evt?.row){
          setCapabilityMatrixRows(prev=>[...prev, evt.row])
        }
        if (evt?.type === 'done'){
          if (evt?.matrix){
            setCapabilityMatrix(evt.matrix)
          }
          if (Array.isArray(evt?.rows)){
            setCapabilityMatrixRows(evt.rows)
          }
          completed = true
        }
      }
      if (!completed){
        throw new Error('Capability matrix stream ended unexpectedly.')
      }
      setCapMatrixError('')
      pushToast('Capability matrix ready.', 'success')
      setCapMatrixLoadedFor(target)
    }catch(err){
      setCapMatrixError(err?.message || 'Capability matrix generation failed.')
      pushToast(err?.message || 'Capability matrix generation failed.', 'error')
    }finally{
      setCapMatrixBusy(false)
    }
  }, [model, selectedAnalyzeFile, pushToast])

  const generateShredDocument = useCallback(async (name)=>{
    const target = (name || selectedAnalyzeFile || '').trim()
    if (!target){
      pushToast('Select an RFP to generate a shred document.', 'info')
      return
    }
    if (!model){
      pushToast('Select a model to generate.', 'info')
      return
    }
    setAnalysisView('shred')
    setShredGenerateBusy(true)
    setShredError('')
    setShredDocument({ rfp_id: target })
    setShredRows([])
    setShredLoadedFor('')
    pushToast('Generating shred document...', 'info')
    try{
      const res = await fetch(`${api}/rfp/shred-document/generate`, {
        method: 'POST',
        headers: withAuthHeaders({'Content-Type':'application/json'}),
        body: JSON.stringify({ rfp_name: target, model })
      })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Shred document generation failed.')
      }
      const data = await res.json()
      setShredDocument(data?.document || null)
      setShredRows(Array.isArray(data?.rows) ? data.rows : [])
      setShredLoadedFor(target)
      setAnalysisView('shred')
      setShredError('')
      pushToast('Shred document ready.', 'success')
    }catch(err){
      setShredDocument(null)
      setShredRows([])
      setShredError(err?.message || 'Shred document generation failed.')
      pushToast(err?.message || 'Shred document generation failed.', 'error')
    }finally{
      setShredGenerateBusy(false)
    }
  }, [api, model, selectedAnalyzeFile, pushToast])

  const loadAnalyzeEdit = useCallback(async (name)=>{
    const target = (name || '').trim()
    if (!target || editorLoadBusy) return
    setAnalyzeActionsOpen(false)
    goToEditTab()
    setEditorLoadBusy(true)
    pushToast('Loading RFP into editor...', 'info')
    try{
      const res = await fetch(`${api}/rfp/analyze/text?name=${encodeURIComponent(target)}`)
      const data = await res.json().catch(()=>({}))
      if (!res.ok){
        throw new Error(data?.detail || data?.message || 'Failed to load RFP.')
      }
      const text = String(data?.text || '')
      if (!text.trim()){
        throw new Error('No text extracted from the RFP.')
      }
      setEditorHtml(markdownToHtml(text))
      const suffix = data?.truncated ? ' (truncated).' : '.'
      pushToast(`Loaded RFP "${target}" into editor${suffix}`, 'success')
    }catch(err){
      pushToast(err?.message || 'Failed to load RFP.', 'error')
    }finally{
      setEditorLoadBusy(false)
    }
  }, [api, editorLoadBusy, goToEditTab, markdownToHtml, pushToast])

  async function generateResponse(targetFile = rfpFile){
    if (!targetFile){
      pushToast('Choose an RFP file to generate a response.', 'info')
      return
    }
    if (!model){
      pushToast('Select a model to generate.', 'info')
      return
    }
    if (!historyFiles.length){
      pushToast('Upload past responses before generating.', 'info')
      return
    }
    setResponseBusy(true)
    pushToast('Generating response...', 'info')
    const fd = new FormData()
    fd.append('file', targetFile)
    if (model) fd.append('model', model)
    try{
      const res = await fetch(`${api}/rfp/response/generate`, {method:'POST', body: fd})
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Response generation failed.')
      }
      const data = await res.json()
      const next = (data?.response || '').trim()
      setResponse(next)
      if (!editorHtml){
        setEditorHtml(markdownToHtml(next))
      }
      if (next){
        const now = Date.now()
        saveDraftEntry({
          name: buildAutoDraftName('Draft Proposal', targetFile?.name || 'RFP'),
          content: next,
          createdAt: now
        })
      }
      pushToast(data?.message || 'Draft ready and saved.', 'success')
      setResponseMode('edit')
    }catch(err){
      pushToast(err?.message || 'Response generation failed.', 'error')
    }finally{
      setResponseBusy(false)
    }
  }

  async function downloadResponse(format, { contentType = 'markdown', overrideContent } = {}){
    const raw = typeof overrideContent === 'string' ? overrideContent : response
    const content = (raw || '').trim()
    if (!content){
      const msg = 'Generate or paste a response first.'
      pushToast(msg, 'info')
      return
    }
    if (contentType === 'html'){
      if (editorExportBusy) return
      setEditorExportBusy(true)
      pushToast(`Preparing ${format.toUpperCase()} download...`, 'info')
    }else{
      if (exportBusy) return
      setExportBusy(true)
      pushToast(`Preparing ${format.toUpperCase()} download...`, 'info')
    }
    try{
      const baseName = (rfpFile?.name || 'rfp-response').replace(/\.[^/.]+$/, '')
      const res = await fetch(`${api}/rfp/response/export`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ content, format, filename: baseName, content_type: contentType })
      })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Export failed.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `rfp-response.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      pushToast('Download ready.', 'success')
    }catch(err){
      pushToast(err?.message || 'Export failed.', 'error')
    }finally{
      if (contentType === 'html') setEditorExportBusy(false)
      else setExportBusy(false)
    }
  }

  const buildDraftPdf = useCallback(async (draft)=>{
    const content = (draft?.content || '').trim()
    if (!content) return ''
    const res = await fetch(`${api}/rfp/response/export`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        content,
        format: 'pdf',
        filename: draft?.name || 'draft',
        content_type: 'markdown'
      })
    })
    if (!res.ok){
      const message = await res.text()
      throw new Error(message || 'Draft PDF export failed.')
    }
    const blob = await res.blob()
    return window.URL.createObjectURL(blob)
  }, [api])

  const ensureDraftPdf = useCallback((draft)=>{
    const id = draft?.id
    if (!id) return Promise.resolve('')
    const existing = draftPdfUrlsRef.current[id]
    if (existing) return Promise.resolve(existing)
    const inflight = draftPdfInFlight.current.get(id)
    if (inflight) return inflight
    const promise = (async ()=>{
      setDraftPdfBusy(prev=>({ ...prev, [id]: true }))
      try{
        const url = await buildDraftPdf(draft)
        if (url){
          setDraftPdfUrls(prev=>({ ...prev, [id]: url }))
        }
        return url
      }catch(err){
        pushToast(err?.message || 'Draft PDF export failed.', 'error')
        return ''
      }finally{
        draftPdfInFlight.current.delete(id)
        setDraftPdfBusy(prev=>{
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
    })()
    draftPdfInFlight.current.set(id, promise)
    return promise
  }, [buildDraftPdf, pushToast])

  const downloadDraftPdf = useCallback(async (draft)=>{
    if (!draft?.id) return
    const name = (draft.name || 'draft').trim() || 'draft'
    const url = await ensureDraftPdf(draft)
    if (!url){
      pushToast('Draft PDF unavailable.', 'error')
      return
    }
    const link = document.createElement('a')
    link.href = url
    link.download = `${name}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [ensureDraftPdf, pushToast])

  useEffect(()=>{
    if (!draftPreviewId) return
    const draft = savedDrafts.find(item=>item.id === draftPreviewId)
    if (!draft) return
    ensureDraftPdf(draft)
  }, [draftPreviewId, savedDrafts, ensureDraftPdf])

  const makeDraftId = useCallback(()=>{
    if (typeof crypto !== 'undefined' && crypto.randomUUID){
      return crypto.randomUUID()
    }
    return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }, [])

  const saveDraftEntry = useCallback((payload)=>{
    const content = (payload?.content || '').trim()
    if (!content) return
    const now = Date.now()
    const draft = {
      id: payload?.id || makeDraftId(),
      name: (payload?.name || '').trim() || buildAutoDraftName('Draft', ''),
      content,
      createdAt: payload?.createdAt || now,
      updatedAt: now
    }
    setSavedDrafts(prev=>{
      const idx = prev.findIndex(item=>item.id === draft.id)
      if (idx === -1){
        return [draft, ...prev]
      }
      const next = [...prev]
      next[idx] = { ...prev[idx], ...draft, createdAt: prev[idx].createdAt || draft.createdAt }
      return next
    })
  }, [buildAutoDraftName, makeDraftId])

  const loadDraft = useCallback((draft)=>{
    if (!draft?.content) return
    setResponse(draft.content)
    setResponseMode('edit')
    pushToast(`Loaded draft "${draft.name}".`, 'success')
  }, [pushToast])

  const deleteDraft = useCallback((id)=>{
    if (!id) return
    setSavedDrafts(prev=>prev.filter(item=>item.id !== id))
    if (draftEditingId === id){
      setDraftEditingId('')
      setDraftEditingName('')
    }
  }, [draftEditingId])

  const startDraftRename = useCallback((draft)=>{
    if (!draft?.id) return
    setDraftEditingId(draft.id)
    setDraftEditingName(draft.name || '')
  }, [])

  const cancelDraftRename = useCallback(()=>{
    setDraftEditingId('')
    setDraftEditingName('')
  }, [])

  const applyDraftRename = useCallback((id)=>{
    const name = (draftEditingName || '').trim()
    if (!name){
      pushToast('Draft name cannot be empty.', 'error')
      return
    }
    setSavedDrafts(prev=>prev.map(item=>(
      item.id === id ? { ...item, name, updatedAt: Date.now() } : item
    )))
    setDraftEditingId('')
    setDraftEditingName('')
    pushToast('Draft renamed.', 'success')
  }, [draftEditingName, pushToast])

  const buildSectionDocumentFrom = useCallback((sections)=>{
    if (!sections?.length) return ''
    return sections
      .map(sec=>{
        const draft = (sec.draft || '').trim()
        if (!draft) return ''
        return `## ${sec.title}\n${draft}`
      })
      .filter(Boolean)
      .join('\n\n')
  }, [])
  const buildSectionDocument = useCallback(()=>(
    buildSectionDocumentFrom(sectionSections)
  ), [buildSectionDocumentFrom, sectionSections])
  const saveSectionDraftFromSections = useCallback((sections)=>{
    const content = buildSectionDocumentFrom(sections).trim()
    if (!content) return
    const now = Date.now()
    if (!sectionDraftRef.current.id){
      sectionDraftRef.current = {
        id: makeDraftId(),
        name: buildAutoDraftName('Sections Draft', sectionFile?.name || 'RFP'),
        createdAt: now
      }
    }
    const meta = sectionDraftRef.current
    saveDraftEntry({
      id: meta.id,
      name: meta.name,
      content,
      createdAt: meta.createdAt || now
    })
  }, [buildAutoDraftName, buildSectionDocumentFrom, makeDraftId, saveDraftEntry, sectionFile])

  const prepareSectionRun = useCallback(async (fileOverride)=>{
    const targetFile = fileOverride || sectionFile
    if (!targetFile){
      pushToast('Choose an RFP file to extract sections.', 'info')
      return
    }
    if (!model){
      pushToast('Select a model to generate.', 'info')
      return
    }
    setSectionBusy(true)
    pushToast('Extracting outline and context...', 'info')
    const fd = new FormData()
    fd.append('file', targetFile)
    if (model) fd.append('model', model)
    try{
      const res = await fetch(`${api}/rfp/sections/prepare`, {method:'POST', body: fd})
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Section prep failed.')
      }
      const data = await res.json()
      const sections = Array.isArray(data?.sections)
        ? data.sections.map(sec => ({...sec, draft: (sec.draft || '').trim()}))
        : []
      setSectionSections(sections)
      setSectionSession(data?.session_id || '')
      const now = Date.now()
      sectionDraftRef.current = {
        id: makeDraftId(),
        name: buildAutoDraftName('Sections Draft', targetFile?.name || 'RFP'),
        createdAt: now
      }
      pushToast('Outline ready. Generating sections now.', 'success')
    }catch(err){
      setSectionSections([])
      setSectionSession('')
      pushToast(err?.message || 'Section prep failed.', 'error')
    }finally{
      setSectionBusy(false)
    }
  }, [api, buildAutoDraftName, makeDraftId, model, sectionFile, pushToast])

  async function generateSection(index){
    if (!sectionSession){
      pushToast('Prepare the sections first by uploading the RFP.', 'info')
      return
    }
    if (sectionGeneratingIndex !== null){
      pushToast('Another section is already generating.', 'info')
      return
    }
    const target = sectionSections.find(sec=>sec.index === index)
    if (!target) return
    setSectionGeneratingIndex(index)
    pushToast(`Generating section ${index}...`, 'info')
    let acc = ''
    let completed = false
    try{
      for await (const evt of streamRfpSection(sectionSession, index, model)) {
        if (evt?.error){
          throw new Error(evt.error)
        }
        if (evt?.delta){
          acc += evt.delta
          const next = acc
          setSectionSections(prev=>prev.map(item=>(
            item.index === index ? { ...item, draft: next } : item
          )))
        }
        if (evt?.type === 'done'){
          const finalText = (evt.text ?? acc).trim()
          setSectionSections(prev=>{
            const next = prev.map(item=>{
              if (item.index !== index) return item
              return {
                ...item,
                draft: finalText || (item.draft || ''),
                coverage_ids: evt?.coverage_ids || item.coverage_ids,
                anchor_terms: evt?.anchor_terms_used || item.anchor_terms
              }
            })
            saveSectionDraftFromSections(next)
            return next
          })
          completed = true
        }
      }
      if (completed){
        pushToast(`Section ${index} drafted.`, 'success')
      }
    }catch(err){
      pushToast(err?.message || `Section ${index} failed.`, 'error')
    }finally{
      setSectionGeneratingIndex(null)
    }
  }

  async function generateAllSections(){
    if (!sectionSession){
      pushToast('Prepare the sections first by uploading the RFP.', 'info')
      return
    }
    if (!sectionSections.length){
      pushToast('No sections found to generate.', 'info')
      return
    }
    setSectionBusy(true)
    for (const sec of sectionSections){
      await generateSection(sec.index)
    }
    setSectionBusy(false)
  }

  function onPickHistory(e){
    uploadHistory(e.target.files, DEFAULT_LIBRARY_FOLDER)
    if (e.target) e.target.value = ''
  }
  function onPickAnalyze(e){
    uploadAnalyze(e.target.files)
  }

  function onPickRfp(e){
    const file = (e.target.files || [])[0]
    if (!file) return
    setRfpFile(file)
    setResponse('')
    pushToast(`Selected ${file.name}`, 'success')
    if (autoGenerate){
      generateResponse(file)
    }
    if (rfpInputRef.current) rfpInputRef.current.value = ''
  }

  function onPickSectionRfp(e){
    const file = (e.target.files || [])[0]
    if (!file) return
    setSectionFile(file)
    setSectionSession('')
    setSectionSections([])
    sectionDraftRef.current = { id: '', name: '', createdAt: 0 }
    pushToast(`Selected ${file.name}`, 'success')
    if (sectionAutoGenerate){
      prepareSectionRun(file)
    }
    if (sectionInputRef.current) sectionInputRef.current.value = ''
  }

  async function downloadSectionResponse(format){
    const content = buildSectionDocument().trim()
    if (!content){
      pushToast('Generate or write section drafts first.', 'info')
      return
    }
    if (sectionExportBusy) return
    setSectionExportBusy(true)
    pushToast(`Preparing ${format.toUpperCase()} download...`, 'info')
    try{
      const baseName = (sectionFile?.name || 'rfp-response').replace(/\.[^/.]+$/, '')
      const res = await fetch(`${api}/rfp/response/export`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ content, format, filename: baseName })
      })
      if (!res.ok){
        const message = await res.text()
        throw new Error(message || 'Export failed.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `rfp-response.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      pushToast('Download ready.', 'success')
    }catch(err){
      pushToast(err?.message || 'Export failed.', 'error')
    }finally{
      setSectionExportBusy(false)
    }
  }

  const formattedStyleDate = styleUpdatedAt
    ? new Date(styleUpdatedAt * 1000).toLocaleString()
    : ''
  const styleDirty = styleEditing
    && (styleDraft || '').trim() !== (styleProfile || '').trim()
  const activeOperation = useMemo(()=>{
    if (docChatBusy) return 'Loading document chat...'
    if (historyBusy) return 'Updating library...'
    if (analyzeBusy) return 'Updating analyze files...'
    if (capMatrixBusy) return 'Building capability matrix...'
    if (shredGenerateBusy) return 'Generating shred document...'
    if (shredLoadBusy) return 'Loading shred document...'
    if (responseBusy) return 'Generating draft response...'
    if (sectionBusy) return 'Generating sections...'
    if (sectionExportBusy || exportBusy || editorExportBusy) return 'Preparing export...'
    if (styleBusy) return 'Updating style profile...'
    return ''
  }, [
    docChatBusy,
    historyBusy,
    analyzeBusy,
    capMatrixBusy,
    shredGenerateBusy,
    shredLoadBusy,
    responseBusy,
    sectionBusy,
    sectionExportBusy,
    exportBusy,
    editorExportBusy,
    styleBusy
  ])

  return (
    <div className="generate-panel">
      {!isDocChat && (
        <div className="generate-header">
          <div>
            <div className="generate-title">Generate</div>
            <div className="generate-subtitle">Build RFP responses from your past submissions.</div>
          </div>
          <div className="generate-model">
            <div className="generate-model-label">Model</div>
            <ModelPicker
              models={models}
              value={model}
              onChange={setModel}
            />
          </div>
        </div>
      )}
      {!!activeOperation && (
        <div className="generate-inline-status" role="status" aria-live="polite">
          <span className="generate-inline-spinner" aria-hidden="true" />
          <span>{activeOperation}</span>
        </div>
      )}

      <div className={`generate-body${isDocChat ? ' doc-chat-body' : ''}`}>
        {showTabs && (
          <div className="generate-tabs">
            <button
              type="button"
              className={`generate-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={()=>setActiveTab('history')}
            >
              Library
            </button>
            <button
              type="button"
              className={`generate-tab ${activeTab === 'rfp' ? 'active' : ''}`}
              onClick={()=>setActiveTab('rfp')}
            >
              Draft Proposal
            </button>
            <button
              type="button"
              className={`generate-tab ${activeTab === 'edit' ? 'active' : ''}`}
              onClick={()=>setActiveTab('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              className={`generate-tab ${activeTab === 'sections' ? 'active' : ''}`}
              onClick={()=>setActiveTab('sections')}
            >
              Sections
            </button>
          </div>
        )}

        {activeTab === 'history' ? (
          <>
            <div className="generate-grid">
            {historySubsection === 'chat' ? (
              <div className="doc-chat-shell">
                {docChat ? (
                  <ChatWindow
                    api={api}
                    chat={docChat}
                    models={models}
                    files={historyFiles}
                    onFilesChanged={loadHistory}
                    onModelChanged={handleDocChatModel}
                    onRenameTitle={renameDocChatTitle}
                    onClearChat={clearDocChat}
                    clearDisabled={docChatClearBusy}
                    linkifyFiles={historyFiles}
                    linkifyBaseUrl={historyDownloadBase}
                    defaultSources={historyFiles}
                  />
                ) : (
                  <div className="doc-chat-empty">
                    {docChatBusy ? (
                      'Loading document chat...'
                    ) : (
                      <>
                        <div>{docChatError || 'Document chat unavailable.'}</div>
                        <div className="doc-chat-empty-actions">
                          <button className="btn-secondary" type="button" onClick={ensureDocChat}>
                            Retry
                          </button>
                          {historyFiles.length > 0 && (
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={()=>{
                                setActiveTab('history')
                                setHistorySubsection('')
                              }}
                            >
                              Review Library
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : historySubsection === 'style' ? (
              <div className="generate-card span-2" ref={styleCardRef}>
                <div className="generate-card-title">Writing style profile</div>
                <div className="generate-card-desc">Extract tone, structure, and phrasing for reuse.</div>
                <div className="generate-actions">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={buildStyleProfile}
                    disabled={styleBusy || !historyFiles.length || styleEditing}
                  >
                    <Sparkles size={16}/> Build style profile
                  </button>
                  {styleEditing ? (
                    <>
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={saveStyleProfile}
                        disabled={styleBusy || !styleDirty}
                      >
                        Save edits
                      </button>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={cancelStyleEdit}
                        disabled={styleBusy}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={startStyleEdit}
                      disabled={styleBusy}
                    >
                      {styleProfile ? 'Edit profile' : 'Create profile'}
                    </button>
                  )}
                  {formattedStyleDate && (
                    <div className="generate-meta">Updated {formattedStyleDate}</div>
                  )}
                </div>
                <div className="generate-output generate-output-large">
                  {styleEditing ? (
                    <textarea
                      className="generate-editor"
                      value={styleDraft}
                      onChange={(e)=>setStyleDraft(e.target.value)}
                      placeholder="Summarize tone, structure, and phrasing. Use '-' bullets if possible."
                      rows={8}
                    />
                  ) : (
                    styleProfile ? (
                      renderMarkdown(styleProfile)
                    ) : (
                      <div className="generate-muted">No style profile yet.</div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="generate-card span-2 library-card-large">
                <div className="library-header">
                  <div className="library-header-main">
                    <div className="generate-card-title">Past Performance</div>
                    <div className="generate-card-desc">Upload and review past performance files.</div>
                  </div>
                  <div className="library-header-actions">
                    <div className="library-sort">
                      <label className="library-sort-label" htmlFor="library-sort-select">Sort by</label>
                      <select
                        id="library-sort-select"
                        className="library-sort-select"
                        value={librarySort}
                        onChange={(e)=>setLibrarySort(e.target.value)}
                      >
                        <option value="added">Date added</option>
                        <option value="modified">Date modified</option>
                      </select>
                    </div>
                    <button
                      className="btn-secondary library-upload-btn"
                      type="button"
                      onClick={()=>libraryInputRef.current?.click()}
                      disabled={historyBusy}
                    >
                      <Upload size={14}/> Add files
                    </button>
                    <input
                      ref={libraryInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={onPickHistory}
                    />
                  </div>
                </div>
                <div className="library-grid library-grid-scroll">
                  {sortedLibraryFiles.length ? sortedLibraryFiles.map(file=>{
                    const pdf = isPdf(file.name)
                    return (
                      <div key={file.name} className={`library-card ${pdf ? '' : 'is-disabled'}`}>
                        <button
                          className="library-thumb"
                          type="button"
                          onDoubleClick={()=>pdf && setPreviewFile(file.name)}
                          disabled={!pdf}
                          title={pdf ? 'Double-click to preview PDF' : 'Preview available for PDFs only'}
                        >
                          {pdf ? (
                            <div className="library-thumb-fallback">
                              <FileText size={28}/>
                              <div>PDF</div>
                            </div>
                          ) : (
                            <div className="library-thumb-fallback">
                              <FileText size={28}/>
                              <div>DOCX</div>
                            </div>
                          )}
                        </button>
                        <div className="library-card-footer">
                          <div className="library-card-name" title={file.displayName}>{file.displayName}</div>
                          <button
                            className="icon-btn"
                            type="button"
                            title="Delete file"
                            onClick={(e)=>{ e.stopPropagation(); deleteHistoryFile(file.name) }}
                            disabled={historyBusy}
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </div>
                    )
                  }) : (
                    <div className="generate-muted">{EMPTY_MESSAGE}</div>
                  )}
                </div>
              </div>
            )}
            </div>
            {previewFile && historySubsection === '' && (
              <div className="library-preview-overlay" onClick={()=>setPreviewFile('')}>
                <div className="library-preview" onClick={(e)=>e.stopPropagation()}>
                  <div className="library-preview-head">
                    <div className="library-preview-title">{previewFile}</div>
                    <button className="icon-btn" type="button" onClick={()=>setPreviewFile('')}>
                      <X size={16}/>
                    </button>
                  </div>
                  <div className="library-preview-body">
                    {isPdf(previewFile) ? (
                      historyPreviewBusy ? (
                        <div className="library-preview-fallback">Loading preview...</div>
                      ) : historyPreviewUrl ? (
                        <iframe
                          className="library-preview-frame"
                          src={historyPreviewUrl}
                          title={`Preview ${previewFile}`}
                        />
                      ) : (
                        <div className="library-preview-fallback">
                          Preview unavailable.
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={()=>downloadBlob(libraryFileUrl(previewFile), previewFile)}
                          >
                            Download file
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="library-preview-fallback">
                        Preview available for PDFs only.
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={()=>downloadBlob(libraryFileUrl(previewFile), previewFile)}
                        >
                          Download file
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {draftPreviewId && historySubsection === '' && (
              <div className="library-preview-overlay" onClick={()=>setDraftPreviewId('')}>
                <div className="library-preview" onClick={(e)=>e.stopPropagation()}>
                  <div className="library-preview-head">
                    <div className="library-preview-title">{draftPreviewDraft?.name || 'Draft preview'}</div>
                    <button className="icon-btn" type="button" onClick={()=>setDraftPreviewId('')}>
                      <X size={16}/>
                    </button>
                  </div>
                  <div className="library-preview-body">
                    {draftPdfUrls[draftPreviewId] ? (
                      <iframe
                        className="library-preview-frame"
                        src={draftPdfUrls[draftPreviewId]}
                        title={`Preview ${draftPreviewDraft?.name || 'draft'}`}
                      />
                    ) : (
                      <div className="library-preview-fallback">
                        {draftPdfBusy[draftPreviewId]
                          ? 'Generating PDF preview...'
                          : 'Preview unavailable.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'rfp' ? (
          <div className="generate-grid">
            <div className="generate-card">
              <div className="generate-card-title">Upload Draft Proposal</div>
              <div className="generate-card-desc">Upload the RFP to draft a response.</div>
              <div className="generate-actions">
                <button
                  className="btn-primary"
                  type="button"
                  onClick={()=>rfpInputRef.current?.click()}
                  disabled={responseBusy}
                >
                  <Upload size={16}/> Choose RFP
                </button>
                <input
                  ref={rfpInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={onPickRfp}
                />
              </div>
              {rfpFile && (
                <div className="generate-file-chip">
                  <FileText size={16}/> {rfpFile.name}
                </div>
              )}
              <label className="generate-toggle">
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={(e)=>setAutoGenerate(e.target.checked)}
                />
                Auto-generate response after upload
              </label>
              <button
                className="btn-secondary"
                type="button"
                onClick={()=>generateResponse()}
                disabled={responseBusy || !rfpFile}
              >
                Generate response
              </button>
              <div className="generate-muted">Drafts save automatically.</div>
            </div>

            <div className="generate-card span-2">
              <div className="generate-card-title">Draft response</div>
              <div className="generate-toolbar">
                <div className="generate-mode">
                  <button
                    type="button"
                    className={`generate-mode-btn ${responseMode === 'edit' ? 'active' : ''}`}
                    onClick={()=>setResponseMode('edit')}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`generate-mode-btn ${responseMode === 'preview' ? 'active' : ''}`}
                    onClick={()=>setResponseMode('preview')}
                  >
                    Preview
                  </button>
                </div>
                <div className="generate-downloads">
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={()=>downloadResponse('docx', { contentType: 'markdown' })}
                    disabled={exportBusy}
                  >
                    Download DOCX
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={()=>downloadResponse('pdf', { contentType: 'markdown' })}
                    disabled={exportBusy}
                  >
                    Download PDF
                  </button>
                </div>
              </div>
              <div className="generate-output">
                {responseMode === 'edit' ? (
                  <textarea
                    className="generate-editor"
                    value={response}
                    onChange={(e)=>setResponse(e.target.value)}
                    placeholder="Generate a draft or start typing here."
                  />
                ) : (
                  response ? (
                    renderMarkdown(response)
                  ) : (
                    <div className="generate-muted">No draft yet.</div>
                  )
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'analyze' ? (
          <>
            <div className="generate-grid">
              {analyzeSubsection && analyzeSubsection !== 'rfp' ? (
                <div className="generate-card span-2">
                  <div className="generate-card-title">Analyze documents</div>
                  <div className="generate-card-desc">Choose an analysis type from the sidebar.</div>
                </div>
              ) : (
                <div className="generate-card span-2 library-card-large">
                  <div className="library-header">
                    <div className="library-header-main">
                      <div className="generate-card-title">RFP library</div>
                      <div className="generate-card-desc">Upload RFPs (PDF or DOCX) to review and analyze.</div>
                    </div>
                    <div className="library-actions">
                      <button
                        className={`library-actions-btn ${selectedAnalyzeFile ? 'is-enabled' : ''}`}
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={analyzeActionsOpen}
                        onClick={()=>{
                          if (!selectedAnalyzeFile) return
                          setAnalyzeActionsOpen(prev=>!prev)
                        }}
                        disabled={!selectedAnalyzeFile}
                      >
                        Actions
                      </button>
                      {analyzeActionsOpen && selectedAnalyzeFile && (
                        <div className="library-actions-menu">
                          <button
                            className="library-action-item"
                            type="button"
                            onClick={()=>{
                              generateCapabilityMatrix(selectedAnalyzeFile)
                              setAnalyzeActionsOpen(false)
                            }}
                            disabled={analyzeBusy || capMatrixBusy}
                          >
                            Generate capability matrix
                          </button>
                          <button
                            className="library-action-item"
                            type="button"
                            onClick={()=>{
                              generateShredDocument(selectedAnalyzeFile)
                              setAnalyzeActionsOpen(false)
                            }}
                            disabled={analyzeBusy || shredGenerateBusy}
                          >
                            Generate shred document
                          </button>
                          <button
                            className="library-action-item"
                            type="button"
                            onClick={()=>loadAnalyzeEdit(selectedAnalyzeFile)}
                            disabled={analyzeBusy || editorLoadBusy}
                          >
                            Edit
                          </button>
                          <button
                            className="library-action-item"
                            type="button"
                            disabled={analyzeBusy}
                            onClick={()=>{
                              deleteAnalyzeFile(selectedAnalyzeFile)
                              setAnalyzeActionsOpen(false)
                            }}
                          >
                            Delete RFP
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="library-grid library-grid-scroll">
                    {analyzeFiles.length ? analyzeFiles.map(name=>{
                      const pdf = isPdf(name)
                      const isSelected = selectedAnalyzeFile === name
                      return (
                        <div
                          key={name}
                          className={`library-card is-selectable${pdf ? '' : ' is-disabled'}${isSelected ? ' is-selected' : ''}`}
                          onClick={()=>setSelectedAnalyzeFile(name)}
                        >
                          <button
                            className="library-thumb"
                            type="button"
                            onDoubleClick={()=>{
                              if (pdf){
                                setAnalyzePreviewFile(name)
                              }
                            }}
                            title={pdf ? 'Double-click to preview PDF' : 'Preview available for PDFs only'}
                          >
                            {pdf ? (
                              <object
                                className="library-thumb-preview"
                                data={analyzeFileUrl(name)}
                                type="application/pdf"
                                aria-label={`Preview of ${name}`}
                              >
                                <div className="library-thumb-fallback">PDF</div>
                              </object>
                            ) : (
                              <div className="library-thumb-fallback">
                                <FileText size={28}/>
                                <div>DOCX</div>
                              </div>
                            )}
                          </button>
                          <div className="library-card-footer">
                            <div className="library-card-name" title={name}>{name}</div>
                          </div>
                        </div>
                      )
                    }) : (
                      <div className="generate-muted">{EMPTY_MESSAGE}</div>
                    )}
                  </div>
                  <div className="library-footer">
                    <div className="library-footer-actions">
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={()=>analyzeInputRef.current?.click()}
                        disabled={analyzeBusy}
                      >
                        <Upload size={16}/> Upload RFPs
                      </button>
                      <input
                        ref={analyzeInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.docx"
                        className="hidden"
                        onChange={onPickAnalyze}
                      />
                    </div>
                  </div>
                </div>
              )}
              {(!analyzeSubsection || analyzeSubsection === 'rfp') && selectedAnalyzeFile && (
                <div className="generate-card span-2">
                  <div className="generate-actions">
                    <div className="generate-tabs">
                      <button
                        className={`generate-tab ${analysisView === 'capability' ? 'active' : ''}`}
                        type="button"
                        onClick={()=>setAnalysisView('capability')}
                      >
                        Capability matrix
                      </button>
                      <button
                        className={`generate-tab ${analysisView === 'shred' ? 'active' : ''}`}
                        type="button"
                        onClick={()=>setAnalysisView('shred')}
                      >
                        Shred document
                      </button>
                    </div>
                  </div>
                  {analysisView === 'shred' && !!shredError && !shredGenerateBusy && !shredLoadBusy && (
                    <div className="generate-inline-error" role="alert">
                      <span>{shredError}</span>
                      <div className="generate-inline-error-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={()=>loadShredDocument(selectedAnalyzeFile, { silent: false })}
                        >
                          Retry Load
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={()=>generateShredDocument(selectedAnalyzeFile)}
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                  {analysisView === 'capability' && !!capMatrixError && !capMatrixBusy && (
                    <div className="generate-inline-error" role="alert">
                      <span>{capMatrixError}</span>
                      <div className="generate-inline-error-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={()=>loadCapabilityMatrix(selectedAnalyzeFile)}
                        >
                          Retry Load
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={()=>generateCapabilityMatrix(selectedAnalyzeFile)}
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                  {analysisView === 'shred' ? (
                    <ShredDocumentView
                      api={api}
                      document={shredDocument}
                      rows={shredRows}
                      loading={shredLoadBusy || shredGenerateBusy}
                      loadingLabel={shredGenerateBusy ? 'Generating shred document...' : 'Loading shred document...'}
                    />
                  ) : (
                    <CapabilityMatrixView
                      api={api}
                      matrix={capabilityMatrix}
                      rows={capabilityMatrixRows}
                      loading={capMatrixBusy}
                    />
                  )}
                </div>
              )}
            </div>
            {analyzePreviewFile && (!analyzeSubsection || analyzeSubsection === 'rfp') && (
              <div className="library-preview-overlay" onClick={()=>setAnalyzePreviewFile('')}>
                <div className="library-preview" onClick={(e)=>e.stopPropagation()}>
                  <div className="library-preview-head">
                    <div className="library-preview-title">{analyzePreviewFile}</div>
                    <button className="icon-btn" type="button" onClick={()=>setAnalyzePreviewFile('')}>
                      <X size={16}/>
                    </button>
                  </div>
                  <div className="library-preview-body">
                    {isPdf(analyzePreviewFile) ? (
                      analyzePreviewBusy ? (
                        <div className="library-preview-fallback">Loading preview...</div>
                      ) : analyzePreviewUrl ? (
                        <iframe
                          className="library-preview-frame"
                          src={analyzePreviewUrl}
                          title={`Preview ${analyzePreviewFile}`}
                        />
                      ) : (
                        <div className="library-preview-fallback">
                          Preview unavailable.
                          <button
                            className="btn-secondary"
                            type="button"
                            onClick={()=>downloadBlob(analyzeFileUrl(analyzePreviewFile), analyzePreviewFile)}
                          >
                            Download file
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="library-preview-fallback">
                        Preview available for PDFs only.
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={()=>downloadBlob(analyzeFileUrl(analyzePreviewFile), analyzePreviewFile)}
                        >
                          Download file
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'edit' ? (
          <div className="generate-grid">
            <div className="generate-card span-2">
              <div className="generate-card-title">Edit draft (word processor)</div>
              <div className="generate-card-desc">Format the generated draft with fonts, sizes, and rich text styles.</div>
              <div className="generate-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={()=>{
                    const md = (response || '').trim()
                    if (!md){
                      pushToast('Generate a draft in "Draft Proposal" first.', 'info')
                      return
                    }
                    setEditorHtml(markdownToHtml(md))
                    pushToast('Loaded latest draft into editor.', 'success')
                  }}
                  disabled={responseBusy || editorLoadBusy}
                >
                  Load from “Draft Proposal” draft
                </button>
              </div>
              <RichTextEditor
                value={editorHtml}
                onChange={(html)=>{
                  setEditorHtml(html)
                }}
                placeholder="Load a generated draft, or start typing here."
              />
              <div className="generate-downloads">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={()=>downloadResponse('docx', { contentType: 'html', overrideContent: editorHtml })}
                  disabled={editorExportBusy}
                >
                  Download DOCX
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={()=>downloadResponse('pdf', { contentType: 'html', overrideContent: editorHtml })}
                  disabled={editorExportBusy}
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="generate-grid">
            <div className="generate-card">
              <div className="generate-card-title">Section-by-section drafting</div>
              <div className="generate-card-desc">Generate each section in sequence using only your uploaded materials.</div>
              <div className="generate-actions">
                <button
                  className="btn-primary"
                  type="button"
                  onClick={()=>sectionInputRef.current?.click()}
                  disabled={sectionBusy}
                >
                  <Upload size={16}/> Choose RFP
                </button>
                <input
                  ref={sectionInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={onPickSectionRfp}
                />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={()=>prepareSectionRun()}
                  disabled={sectionBusy || !sectionFile}
                >
                  Prepare sections
                </button>
              </div>
              {sectionFile && (
                <div className="generate-file-chip">
                  <FileText size={16}/> {sectionFile.name}
                </div>
              )}
              <label className="generate-toggle">
                <input
                  type="checkbox"
                  checked={sectionAutoGenerate}
                  onChange={(e)=>setSectionAutoGenerate(e.target.checked)}
                />
                Auto-prepare after upload
              </label>
              <div className="generate-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={generateAllSections}
                  disabled={sectionBusy || sectionGeneratingIndex !== null || !sectionSections.length}
                >
                  Generate all sections
                </button>
              </div>
            </div>

            <div className="generate-card span-2">
              <div className="generate-card-title">Sections</div>
              <div className="section-list">
                {sectionSections.length ? sectionSections.map(sec=>(
                  <div key={sec.index} className="section-card">
                    <div className="section-card-head">
                      <div>
                        <div className="section-card-title">Section {sec.index}: {sec.title}</div>
                        <div className="section-card-meta">
                          IDs: {sec.requirement_ids?.length ? sec.requirement_ids.join(', ') : 'None in RFP'}
                        </div>
                      </div>
                      <div className="section-card-actions">
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={()=>generateSection(sec.index)}
                          disabled={sectionBusy || sectionGeneratingIndex !== null}
                        >
                          {sectionGeneratingIndex === sec.index ? 'Generating...' : 'Generate'}
                        </button>
                      </div>
                    </div>
                    <div className="section-card-context">
                      <div>
                        <div className="section-context-label">RFP excerpt</div>
                        <div className="section-snippet">{sec.rfp_excerpt || 'No RFP excerpt yet.'}</div>
                      </div>
                      <div>
                        <div className="section-context-label">Uploaded responses</div>
                        <div className="section-snippet">{sec.history_excerpt || 'No uploaded excerpts.'}</div>
                      </div>
                    </div>
                    <textarea
                      className="section-editor"
                      value={sec.draft || ''}
                      onChange={(e)=>setSectionSections(prev=>prev.map(item=>item.index===sec.index ? {...item, draft: e.target.value} : item))}
                      placeholder="Generate this section or start typing here."
                    />
                  </div>
                )) : (
                  <div className="generate-muted">Upload an RFP to extract its sections.</div>
                )}
              </div>
              <div className="generate-downloads">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={()=>downloadSectionResponse('docx')}
                  disabled={sectionExportBusy || !sectionSections.length}
                >
                  Download DOCX
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={()=>downloadSectionResponse('pdf')}
                  disabled={sectionExportBusy || !sectionSections.length}
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
