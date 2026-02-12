import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, Paperclip, Globe, ArrowDown, Copy, RotateCcw, X } from 'lucide-react'
import MessageList from './MessageList'
import ModelPicker from './ModelPicker'
import { streamMessage, streamWebSearch } from '../api'
import { useToast } from './ToastProvider'

const TOKEN_MATCH = /(^|[\s.,;:!?()[\]{}'"`<>])@([A-Za-z0-9][\w.\-]{0,100})/g
const ATTACHMENT_LINE = /^\s*(?:[-*]\s*)?(pdf|docx|file)\s*:\s*\[([^\]]+)\]\(([^)]+)\)\s*$/i

function escapeHtml(str = ''){
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function toSlug(name = ''){
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function isDownloadLink(url = ''){
  return /\/api\/ekchat\/.*\/download/.test(url)
}

function parseSourceLinks(content = ''){
  const links = []
  for (const line of String(content || '').split(/\r?\n/)){
    const match = line.match(ATTACHMENT_LINE)
    if (!match) continue
    links.push({
      kind: match[1].toLowerCase(),
      name: match[2],
      url: match[3]
    })
  }
  return links
}

function isNearBottom(el, threshold = 80){
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

function withAuthHeaders(headers = {}){
  const token = localStorage.getItem('accessToken') || ''
  if (!token) return headers
  return {
    ...headers,
    Authorization: `Bearer ${token}`
  }
}

function buildMentionHighlight(text = '', files = []){
  if (!text) return ''
  const catalog = files.map(name => ({
    lower: name.toLowerCase(),
    slug: toSlug(name)
  }))

  let lastIndex = 0
  let result = ''

  text.replace(TOKEN_MATCH, (match, prefix, token, offset) => {
    const matchStart = offset
    const mentionStart = matchStart + prefix.length
    const mentionEnd = mentionStart + token.length + 1 // include '@'

    result += escapeHtml(text.slice(lastIndex, mentionStart))

    const tokenLower = token.toLowerCase()
    const tokenSlug = toSlug(token)
    const matched = catalog.some(entry =>
      entry.lower.startsWith(tokenLower) ||
      (!!tokenSlug && entry.slug.startsWith(tokenSlug))
    )

    const nextChar = text[mentionEnd] || ''
    const complete = !nextChar || /\s/.test(nextChar)

    const classes = ['mention-chip']
    if (matched) classes.push('matched')
    if (complete) classes.push('complete')

    result += `<span class="${classes.join(' ')}">${escapeHtml(`@${token}`)}</span>`
    lastIndex = mentionEnd
    return match
  })

  if (lastIndex < text.length){
    result += escapeHtml(text.slice(lastIndex))
  }

  return result
}

export default function ChatWindow({
  api,
  chat,
  models,
  files = [],
  onFilesChanged,
  onAutoTitle,
  onModelChanged,
  onRenameTitle,
  defaultSources = [],
  linkifyFiles = [],
  linkifyBaseUrl = '',
  onClearChat,
  clearDisabled = false
}){
  const { notify } = useToast()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(null)
  const [webMode, setWebMode] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [lastError, setLastError] = useState('')
  const [lastFailedRequest, setLastFailedRequest] = useState(null)

  const chatId = chat?.id
  const fileDownloadBase = useMemo(() => (
    chatId ? `${api}/files/download?chat_id=${encodeURIComponent(chatId)}&name=` : ''
  ), [api, chatId])
  const messagesRef = useRef(null)
  const fileRef = useRef(null)
  const highlightRef = useRef(null)
  const textareaRef = useRef(null)
  const latestChatIdRef = useRef(chatId)
  const titleInputRef = useRef(null)
  const isEditingTitleRef = useRef(false)
  const isAtBottomRef = useRef(true)
  const chatTitle = (chat?.title && chat.title.trim()) || 'New chat'
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(chatTitle)

  useEffect(()=>{ latestChatIdRef.current = chatId }, [chatId])

  useEffect(()=>{ isEditingTitleRef.current = editingTitle }, [editingTitle])

  useEffect(()=>{ setSelectedFiles([]) }, [chatId])

  useEffect(()=>{
    if (!files?.length){
      setSelectedFiles([])
      return
    }
    setSelectedFiles(prev => files.filter(file => prev.includes(file)))
  }, [files])

  useEffect(()=>{
    if (!editingTitle){
      setTitleDraft(chatTitle)
    }
  }, [chatTitle, editingTitle])

  useEffect(()=>{
    setEditingTitle(false)
    isEditingTitleRef.current = false
  }, [chatId])

  useEffect(()=>{
    if (!editingTitle) return
    const id = requestAnimationFrame(()=>{
      const el = titleInputRef.current
      if (el){
        el.focus()
        el.select()
      }
    })
    return ()=>cancelAnimationFrame(id)
  }, [editingTitle])

  async function finalizeTitle(commit = true){
    if (!isEditingTitleRef.current){
      return
    }
    isEditingTitleRef.current = false
    setEditingTitle(false)
    if (!commit || !chatId){
      setTitleDraft(chatTitle)
      return
    }
    const trimmed = (titleDraft || '').trim()
    if (trimmed === (chatTitle || '')){
      return
    }
    try{
      await onRenameTitle?.(chatId, trimmed)
    }catch(err){
      console.error('Failed to rename chat', err)
      setTitleDraft(chatTitle)
      notify('Could not rename chat. Please try again.', { tone: 'error' })
    }
  }

  function handleTitleKey(e){
    if (e.key === 'Enter'){
      e.preventDefault()
      finalizeTitle(true)
    }else if (e.key === 'Escape'){
      e.preventDefault()
      finalizeTitle(false)
    }
  }

  const highlightedInput = useMemo(()=>{
    const html = buildMentionHighlight(input, files)
    return html || escapeHtml(input || '')
  }, [input, files])

  const hasFileSelection = selectedFiles.length > 0

  const toggleFileSelection = useCallback((name)=>{
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(name)){
        next.delete(name)
      }else{
        next.add(name)
      }
      return files.filter(file => next.has(file))
    })
  }, [files])

  const clearFileSelection = useCallback(()=>{
    setSelectedFiles([])
  }, [])

  useEffect(()=>{
    const layer = highlightRef.current
    const area = textareaRef.current
    if (!layer || !area) return
    layer.scrollTop = area.scrollTop
    layer.scrollLeft = area.scrollLeft
  }, [input])

  const scrollToBottom = useCallback((behavior = 'auto')=>{
    const el = messagesRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    isAtBottomRef.current = true
    setShowJumpToLatest(false)
  }, [])

  useEffect(()=>{
    const el = messagesRef.current
    if (!el) return
    const onScroll = ()=>{
      const atBottom = isNearBottom(el)
      isAtBottomRef.current = atBottom
      setShowJumpToLatest(!atBottom)
    }
    onScroll()
    el.addEventListener('scroll', onScroll)
    return ()=>el.removeEventListener('scroll', onScroll)
  }, [])

  const loadMessages = useCallback(async ()=>{
    if (!chatId){
      setMessages([])
      setPending(null)
      return
    }
    const target = chatId
    try{
      const res = await fetch(`${api}/chats/${target}/messages`)
      const data = await res.json()
      if (latestChatIdRef.current !== target) return
      setMessages(Array.isArray(data?.messages) ? data.messages : [])
    }catch(e){
      if (latestChatIdRef.current === target){
        setMessages([])
      }
    }
  }, [api, chatId])

  // Load messages when chat changes or when another component requests refresh
  useEffect(()=>{ loadMessages() }, [loadMessages])

  useEffect(()=>{
    if (!chatId) return
    const handler = (evt)=>{
      const target = evt?.detail?.chatId
      if (target && target !== chatId) return
      loadMessages()
    }
    window.addEventListener('ekchat:refresh-chat', handler)
    return ()=>window.removeEventListener('ekchat:refresh-chat', handler)
  }, [chatId, loadMessages])

  const ensureAutoTitle = useCallback(async ()=>{
    if (!chatId) return
    try{
      await fetch(`${api}/chats/${chatId}/title/auto`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({force:false})})
      onAutoTitle?.()
    }catch(e){}
  }, [api, chatId, onAutoTitle])

  const nowTs = useCallback(()=> (Date.now()/1000)|0, [])

  const formatAssistantError = useCallback((message)=>{
    const clean = (message || '').toString().trim() || 'Something went wrong while contacting the model.'
    return clean.startsWith('⚠️') ? clean : `⚠️ ${clean}`
  }, [])

  const appendAssistantBubble = useCallback((text, isError = false)=>{
    const raw = (text ?? '').toString()
    const trimmed = raw.trim()
    if (!trimmed && !isError){
      return
    }
    const content = isError ? formatAssistantError(trimmed || raw) : raw
    if (!content.trim()){
      return
    }
    const entry = {role:'assistant', content, ts: nowTs()}
    setMessages(prev=>[...prev, entry])
    if (!isError){
      ensureAutoTitle()
    }
  }, [ensureAutoTitle, formatAssistantError, nowTs])

  const updatePendingContent = useCallback((text, kind)=>{
    setPending(prev=>{
      const content = text ?? ''
      if (!prev){
        return {role:'assistant', content, ts: nowTs(), ...(kind ? {kind} : {})}
      }
      const next = {...prev, content}
      if (kind){
        next.kind = kind
      }
      return next
    })
  }, [nowTs])

  const isUploadAck = useCallback((message)=>{
    const text = (message?.content || '').toString().trim()
    return message?.role === 'assistant' && text.startsWith('\uD83D\uDCCE')
  }, [])

  // Auto-scroll on any message/pending change
  const allMessages = useMemo(()=>{
    const list = pending ? [...messages, pending] : messages
    return list.filter((message)=>!isUploadAck(message))
  }, [messages, pending, isUploadAck])
  useEffect(()=>{
    if (isAtBottomRef.current){
      scrollToBottom()
      return
    }
    if (pending?.content){
      setShowJumpToLatest(true)
    }
  }, [allMessages.length, pending?.content, scrollToBottom])

  useEffect(()=>{
    const handleHotkeys = (e)=>{
      const isMeta = e.metaKey || e.ctrlKey
      const key = String(e.key || '').toLowerCase()
      if (isMeta && key === 'k'){
        e.preventDefault()
        textareaRef.current?.focus()
        return
      }
      if (isMeta && key === 'enter'){
        e.preventDefault()
        handleSend()
        return
      }
      if (e.key !== 'Escape'){
        return
      }
      let handled = false
      if (editingTitle){
        finalizeTitle(false)
        handled = true
      }
      if (webMode){
        setWebMode(false)
        handled = true
      }
      if (hasFileSelection){
        clearFileSelection()
        handled = true
      }
      if (handled){
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleHotkeys)
    return ()=>window.removeEventListener('keydown', handleHotkeys)
  }, [editingTitle, webMode, hasFileSelection, clearFileSelection, finalizeTitle, handleSend])

  const copyText = useCallback(async (value, success = 'Copied.')=>{
    const text = (value || '').toString()
    if (!text.trim()) return
    try{
      await navigator.clipboard.writeText(text)
      notify(success, { tone: 'success' })
    }catch{
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'absolute'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      notify(success, { tone: 'success' })
    }
  }, [notify])

  const openSourceLink = useCallback(async (url)=>{
    if (!url) return
    if (!isDownloadLink(url)){
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    try{
      const res = await fetch(url, { headers: withAuthHeaders() })
      if (!res.ok){
        const message = await res.text().catch(()=> '')
        throw new Error(message || `Download failed (HTTP ${res.status})`)
      }
      const blob = await res.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      window.open(objectUrl, '_blank', 'noopener,noreferrer')
      setTimeout(()=>window.URL.revokeObjectURL(objectUrl), 60_000)
    }catch(err){
      notify(err?.message || 'Could not open source file.', { tone: 'error' })
    }
  }, [notify])

  async function sendNormal(overrideContent){
    const content = (overrideContent ?? input).trim()
    if (!content || !chatId || loading) return false
    if (typeof overrideContent !== 'string'){
      setInput('')
    }
    const userMsg = {role:'user', content, ts: nowTs()}
    setMessages(prev=>[...prev, userMsg])
    setLastError('')
    setLastFailedRequest(null)
    setLoading(true)
    setPending({role:'assistant', content:'', ts: nowTs(), kind:'analysis'})
    requestAnimationFrame(()=>scrollToBottom('smooth'))

    let acc = ''
    let analysis = ''
    let hadError = false
    let finalReady = false
    let finalQueued = false
    let streamActive = true

    const queueFinalStream = ()=>{
      if (!streamActive || finalReady || finalQueued){
        return
      }
      finalQueued = true
      updatePendingContent('Thinking...', 'thinking')
      requestAnimationFrame(()=>{
        if (!streamActive){
          return
        }
        finalQueued = false
        finalReady = true
        updatePendingContent(acc, 'final')
      })
    }
    try{
      const sources = hasFileSelection
        ? selectedFiles
        : (Array.isArray(defaultSources) && defaultSources.length ? defaultSources : undefined)
      for await (const evt of streamMessage(chatId, content, chat?.model, undefined, { sources })){
        if (evt.type === 'file' && evt.name){
          onFilesChanged?.(chatId)
          continue
        }
        if (evt.error){
          hadError = true
          acc = evt.error || ''
          updatePendingContent(formatAssistantError(acc), 'error')
          setLastError(acc || 'The model reported an error.')
          setLastFailedRequest({ mode: 'chat', content })
          continue
        }
        if (evt.channel === 'analysis' && evt.delta){
          analysis += evt.delta
          updatePendingContent(analysis, 'analysis')
          continue
        }
        if (evt.delta){
          acc += evt.delta
          if (!finalReady){
            queueFinalStream()
          }else{
            updatePendingContent(acc, 'final')
          }
        }
        if (evt.type === 'done'){
          if (hadError){
            appendAssistantBubble(acc || 'The model reported an error.', true)
            return false
          }
          if (!acc.trim()){
            appendAssistantBubble('The model did not return any text.', true)
            return false
          }
          appendAssistantBubble(acc, false)
          setLastError('')
          setLastFailedRequest(null)
          return true
        }
      }
      throw new Error('Model stream ended unexpectedly.')
    }catch(e){
      appendAssistantBubble(e?.message || 'Failed to contact the model.', true)
      setLastError(e?.message || 'Failed to contact the model.')
      setLastFailedRequest({ mode: 'chat', content })
      return false
    }finally{
      streamActive = false
      setPending(null)
      setLoading(false)
    }
  }

  async function sendWebSearch(overrideQuery){
    const q = (overrideQuery ?? input).trim()
    if (!q || !chatId || loading) return false
    if (typeof overrideQuery !== 'string'){
      setInput('')
    }
    const userMsg = {role:'user', content:`🔎 ${q}`, ts: nowTs()}
    setMessages(prev=>[...prev, userMsg])
    setLastError('')
    setLastFailedRequest(null)
    setLoading(true)
    setPending({role:'assistant', content:'', ts: nowTs()})
    requestAnimationFrame(()=>scrollToBottom('smooth'))

    let acc = ''
    let hadError = false
    try{
      for await (const evt of streamWebSearch(chatId, q)){
        if (evt.error){
          hadError = true
          acc = evt.error || ''
          updatePendingContent(formatAssistantError(acc))
          setLastError(acc || 'Web search failed.')
          setLastFailedRequest({ mode: 'web', content: q })
          continue
        }
        if (evt.delta){
          acc += evt.delta
          updatePendingContent(acc)
        }
        if (evt.type === 'done'){
          if (hadError){
            appendAssistantBubble(acc || 'Web search failed.', true)
            return false
          }
          if (!acc.trim()){
            appendAssistantBubble('Web search returned no summary.', true)
            return false
          }
          appendAssistantBubble(acc, false)
          setLastError('')
          setLastFailedRequest(null)
          return true
        }
      }
      throw new Error('Web search stream ended unexpectedly.')
    }catch(e){
      appendAssistantBubble(e?.message || 'Web search failed.', true)
      setLastError(e?.message || 'Web search failed.')
      setLastFailedRequest({ mode: 'web', content: q })
      return false
    }finally{
      setPending(null)
      setLoading(false)
    }
  }

  async function handleSend(){
    if (loading) return
    if (webMode){
      const sent = await sendWebSearch()
      if (sent) setWebMode(false)
    }else{
      await sendNormal()
    }
  }

  function toggleWebMode(){
    if (loading) return
    setWebMode(v=>!v)
  }

  async function handleRetryRequest(requestPayload = lastFailedRequest){
    if (!requestPayload || loading) return
    const mode = requestPayload.mode === 'web' ? 'web' : 'chat'
    const content = (requestPayload.content || '').toString()
    if (!content.trim()) return
    setWebMode(mode === 'web')
    if (mode === 'web'){
      await sendWebSearch(content)
    }else{
      await sendNormal(content)
    }
  }

  async function onModelSelect(model){
    if (!chatId) return
    await fetch(`${api}/chats/${chatId}/model`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({model})})
    onModelChanged?.(chatId, model)
  }

  function openPicker(){ if (chatId) fileRef.current?.click() }

  async function handleClearChat(){
    if (!chatId || !onClearChat || clearDisabled) return
    await onClearChat(chatId)
  }
  async function uploadPicked(files){
    if (!chatId || !files?.length) return
    const fd = new FormData()
    fd.append('chat_id', chatId)
    for (const f of files) fd.append('files', f)
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
      try{
        data = await res.json()
      }catch{}
      const message = data?.message || 'Files indexed.'
      notify(message, { tone: 'success' })
      await onFilesChanged?.(chatId)
      await loadMessages()
    }catch(err){
      console.error('File upload failed', err)
      notify(err?.message || 'Could not upload files. Please try again.', { tone: 'error' })
    }finally{
      if (fileRef.current){
        fileRef.current.value = ''
      }
    }
  }

  function syncHighlightScroll(e){
    const layer = highlightRef.current
    if (!layer) return
    layer.scrollTop = e.target.scrollTop
    layer.scrollLeft = e.target.scrollLeft
  }

  const placeholder = webMode
    ? "Search the web"
    : "Type your message... Select a file tag to focus context. Use the Globe for Web Search."

  return (
    <div className="chat-window">
      {/* Header strip */}
      <div className="chat-header">
        {chat ? (
          editingTitle ? (
            <input
              ref={titleInputRef}
              className="chat-title-input"
              value={titleDraft}
              onChange={e=>setTitleDraft(e.target.value)}
              onBlur={()=>finalizeTitle(true)}
              onKeyDown={handleTitleKey}
              maxLength={80}
            />
          ) : (
            <button
              type="button"
              className="chat-title-button"
              onClick={()=>{ setTitleDraft(chatTitle); setEditingTitle(true) }}
              title="Rename chat"
            >
              {chatTitle}
            </button>
          )
        ) : (
          <div className="chat-title-placeholder">Select a chat</div>
        )}
        <div className="chat-header-spacer" />
        {onClearChat && (
          <div className="chat-header-actions">
            <button
              type="button"
              className="btn-secondary chat-clear-btn"
              onClick={handleClearChat}
              disabled={clearDisabled || !chatId}
              title="Clear this conversation"
            >
              Clear chat
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="messages" ref={messagesRef}>
        {files.length > 0 && (
          <div className="chat-context-bar">
            <div className="chat-context-main">
              <span className="chat-context-label">Context</span>
              <button
                type="button"
                className={`chat-context-chip ${!hasFileSelection ? 'active' : ''}`}
                onClick={clearFileSelection}
                aria-pressed={!hasFileSelection}
                title="Use all uploaded files"
              >
                All files
              </button>
              {files.map((name)=>(
                <button
                  key={name}
                  type="button"
                  className={`chat-context-chip ${selectedFiles.includes(name) ? 'active' : ''}`}
                  onClick={()=>toggleFileSelection(name)}
                  aria-pressed={selectedFiles.includes(name)}
                  title={name}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="chat-context-meta">
              {hasFileSelection
                ? `Scoped to ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}`
                : `Using all ${files.length} file${files.length === 1 ? '' : 's'}`}
            </div>
          </div>
        )}
        <div className="messages-inner">
          {allMessages.map((m, i)=>(
            <div key={i} className={`message ${m.role}${m.kind ? ` ${m.kind}` : ''}`}>
              <div className="bubble">
                <div className="message-body">
                  {m.kind === 'analysis' ? (
                    <div className="status-block">
                      <div className="status-row" role="status" aria-live="polite">
                        <span className="status-spinner" aria-hidden="true" />
                        <span>Reasoning...</span>
                      </div>
                      {!!(m.content || '').trim() && (
                        <MessageList
                          messages={[m]}
                          linkifyFiles={linkifyFiles.length ? linkifyFiles : files}
                          linkifyBaseUrl={linkifyBaseUrl || fileDownloadBase}
                        />
                      )}
                    </div>
                  ) : m.kind === 'thinking' ? (
                    <div className="status-row" role="status" aria-live="polite">
                      <span className="status-spinner" aria-hidden="true" />
                      <span>Thinking...</span>
                    </div>
                  ) : (
                    <MessageList
                      messages={[m]}
                      linkifyFiles={linkifyFiles.length ? linkifyFiles : files}
                      linkifyBaseUrl={linkifyBaseUrl || fileDownloadBase}
                    />
                  )}
                  {m.role === 'assistant' && m.kind !== 'analysis' && m.kind !== 'thinking' && (
                    <div className="message-meta-row">
                      {(() => {
                        const sources = parseSourceLinks(m?.content || '')
                        return (
                          <div className="message-sources">
                            {sources.length > 0 ? (
                              <>
                                <span className="message-source-count">
                                  Used {sources.length} source{sources.length === 1 ? '' : 's'}
                                </span>
                                {sources.slice(0, 3).map((source, idx) => (
                                  <button
                                    key={`${source.url}-${idx}`}
                                    type="button"
                                    className="message-source-chip"
                                    onClick={()=>openSourceLink(source.url)}
                                    title={source.name}
                                  >
                                    {source.name}
                                  </button>
                                ))}
                              </>
                            ) : null}
                          </div>
                        )
                      })()}
                      <div className="message-actions">
                        <button
                          type="button"
                          className="message-action-btn"
                          onClick={()=>copyText(m?.content || '', 'Response copied.')}
                          title="Copy response"
                        >
                          <Copy size={14} />
                          Copy
                        </button>
                        {(() => {
                          let previousUser = null
                          for (let idx = i - 1; idx >= 0; idx -= 1){
                            const candidate = allMessages[idx]
                            if (candidate?.role !== 'user') continue
                            const raw = (candidate.content || '').toString()
                            if (raw.startsWith('🔎 ')){
                              previousUser = { mode: 'web', content: raw.replace(/^🔎\s*/, '') }
                            }else{
                              previousUser = { mode: 'chat', content: raw }
                            }
                            break
                          }
                          if (!previousUser?.content?.trim()) return null
                          return (
                            <button
                              type="button"
                              className="message-action-btn"
                              onClick={()=>handleRetryRequest(previousUser)}
                              title="Regenerate from this prompt"
                              disabled={loading}
                            >
                              <RotateCcw size={14} />
                              Regenerate
                            </button>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      {!!lastError && !!lastFailedRequest && !loading && (
        <div className="chat-inline-error" role="alert">
          <div className="chat-inline-error-text">{lastError}</div>
          <div className="chat-inline-error-actions">
            <button
              type="button"
              className="message-action-btn"
              onClick={()=>handleRetryRequest()}
            >
              Retry
            </button>
            <button
              type="button"
              className="message-action-btn"
              onClick={()=>{
                setLastError('')
                setLastFailedRequest(null)
              }}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {showJumpToLatest && (
        <button
          type="button"
          className="jump-latest-btn"
          onClick={()=>scrollToBottom('smooth')}
          title="Jump to latest response"
        >
          <ArrowDown size={14} />
          Jump to latest
        </button>
      )}
      <div className="composer-shell">
        <div className={`composer${webMode ? ' web-mode' : ''}`}>
          <div className="input">
            <div className="textarea-shell">
              <div
                ref={highlightRef}
                className="textarea-highlight"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: highlightedInput || '&nbsp;' }}
              />
              <textarea
                ref={textareaRef}
                placeholder={placeholder}
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handleSend() } }}
                onScroll={syncHighlightScroll}
              />
            </div>
            <div className="composer-footer">
              <div className="input-actions">
                <button
                  className={`icon-btn ${webMode ? 'active' : ''}`}
                  onClick={toggleWebMode}
                  type="button"
                  aria-pressed={webMode}
                  title={webMode ? 'Web search mode enabled. Click to turn off.' : 'Toggle web search mode'}
                >
                  <Globe size={18}/>
                </button>
                <button className="icon-btn" onClick={openPicker} title="Attach files" type="button"><Paperclip size={18}/></button>
                <ModelPicker models={models} value={chat?.model} onChange={onModelSelect}/>
              </div>
              <button
                  className="send-btn"
                  onClick={handleSend}
                  disabled={loading}
                  title={webMode ? 'Send query via web search' : 'Send message'}
                >
                  {webMode ? <Globe size={18}/> : <Send size={18}/>}
                </button>
              </div>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e=>uploadPicked(e.target.files)}/>
          </div>
        </div>
      </div>
    </div>
  )
}
