import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Sun,
  Moon,
  MessageCircle,
  Sparkles
} from 'lucide-react'
import ChatWindow from './components/ChatWindow'
import GeneratePanel from './components/GeneratePanel'
import { API_BASE } from './api'
import { useToast } from './components/ToastProvider'

const API = API_BASE

const GENERATE_LABELS = {
  history: 'Library',
  rfp: 'Draft Proposal',
  analyze: 'Analyze Documents',
  edit: 'Edit',
  sections: 'Sections'
}

function buildBreadcrumb(leftMode, generateTab, historySubsection, analyzeSubsection, activeChat){
  const parts = ['EkChat']
  if (leftMode === 'chats'){
    parts.push('Chats')
    if (activeChat?.title){
      parts.push(activeChat.title)
    }
    return parts.join(' > ')
  }

  parts.push('Generate')
  parts.push(GENERATE_LABELS[generateTab] || 'Library')
  if (generateTab === 'history'){
    if (historySubsection === 'style') parts.push('Writing Style Profile')
    if (historySubsection === 'chat') parts.push('Chat With Documents')
  }
  if (generateTab === 'analyze'){
    parts.push(analyzeSubsection === 'rfp' || !analyzeSubsection ? 'Analyze RFP' : analyzeSubsection)
  }
  return parts.join(' > ')
}

function getInitialTheme(){
  const saved = localStorage.getItem('pipelinepro-theme') || localStorage.getItem('theme')
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App({ navState, themeMode, onToggleTheme } = {}){
  const { notify } = useToast()
  const [models, setModels] = useState([])
  const [chats, setChats] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [leftMode, setLeftMode] = useState('chats')
  const [generateTab, setGenerateTab] = useState('history')
  const [historySubsection, setHistorySubsection] = useState('')
  const [analyzeSubsection, setAnalyzeSubsection] = useState('')
  const [localTheme, setLocalTheme] = useState(getInitialTheme())
  const [files, setFiles] = useState([])
  const activeIdRef = useRef(activeId)
  const theme =
    themeMode === 'dark' || themeMode === 'light'
      ? themeMode
      : localTheme

  useEffect(()=>{ activeIdRef.current = activeId }, [activeId])

  const refreshFiles = useCallback(async (chatIdOverride)=>{
    const targetId = chatIdOverride ?? activeIdRef.current
    if (!targetId){
      setFiles([])
      return []
    }
    try{
      const res = await fetch(`${API}/files/list?chat_id=${encodeURIComponent(targetId)}`)
      const data = await res.json()
      const next = Array.isArray(data?.files)
        ? data.files
            .map(item => {
              if (!item) return null
              if (typeof item === 'string') return item
              if (typeof item?.name === 'string') return item.name
              if (typeof item?.original_name === 'string') return item.original_name
              return null
            })
            .filter(name => typeof name === 'string' && name.trim())
        : []
      if (activeIdRef.current === targetId){
        setFiles(next)
      }
      return next
    }catch(e){
      if (activeIdRef.current === targetId){
        setFiles([])
      }
      return []
    }
  }, [])

  const activeChat = useMemo(()=>chats.find(c=>c?.id===activeId)||null,[chats,activeId])
  const breadcrumb = useMemo(
    ()=>buildBreadcrumb(leftMode, generateTab, historySubsection, analyzeSubsection, activeChat),
    [leftMode, generateTab, historySubsection, analyzeSubsection, activeChat]
  )

  useEffect(()=>{
    if (themeMode) return
    localStorage.setItem('pipelinepro-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme, themeMode])

  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    const normalizedBase = API.replace(/\/$/, '')

    window.fetch = (input, init = {}) => {
      const token = localStorage.getItem('accessToken')
      const url = typeof input === 'string' ? input : (input?.url || '')

      const isEkchatRequest =
        url.startsWith(normalizedBase) ||
        url.startsWith('/api/ekchat/') ||
        url.includes('/api/ekchat/')

      if (!token || !isEkchatRequest) {
        return originalFetch(input, init)
      }

      const headers = new Headers((init && init.headers) || (typeof input !== 'string' ? input.headers : undefined) || {})
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      return originalFetch(input, { ...init, headers })
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  useEffect(()=>{
    fetch(`${API}/models`).then(r=>r.json()).then(d=>setModels(d.models||[])).catch(()=>{})
    refreshChats()
  },[])

  useEffect(()=>{ refreshFiles(activeId) }, [activeId, refreshFiles])
  useEffect(()=>{
    if (generateTab !== 'history' && historySubsection){
      setHistorySubsection('')
    }
  }, [generateTab, historySubsection])
  useEffect(()=>{
    if (generateTab !== 'analyze' && analyzeSubsection){
      setAnalyzeSubsection('')
    }
  }, [generateTab, analyzeSubsection])

  useEffect(() => {
    if (!navState || typeof navState !== 'object') return

    const nextMode = navState.leftMode === 'generate' ? 'generate' : 'chats'
    const nextTab = ['history', 'rfp', 'analyze', 'edit', 'sections'].includes(navState.generateTab)
      ? navState.generateTab
      : 'history'
    const nextHistorySubsection =
      typeof navState.historySubsection === 'string' ? navState.historySubsection : ''
    const nextAnalyzeSubsection =
      typeof navState.analyzeSubsection === 'string' ? navState.analyzeSubsection : ''

    setLeftMode(nextMode)

    if (nextMode === 'generate') {
      setGenerateTab(nextTab)
      setHistorySubsection(nextHistorySubsection)
      setAnalyzeSubsection(nextAnalyzeSubsection)
    } else {
      setHistorySubsection('')
      setAnalyzeSubsection('')
    }
  }, [
    navState?.leftMode,
    navState?.generateTab,
    navState?.historySubsection,
    navState?.analyzeSubsection
  ])

  const goToEdit = useCallback(()=>{
    setLeftMode('generate')
    setGenerateTab('edit')
    setHistorySubsection('')
    setAnalyzeSubsection('')
  }, [])

  function refreshChats(){
    fetch(`${API}/chats`).then(r=>r.json()).then(d=>{
      const list = Array.isArray(d?.chats) ? d.chats.filter(Boolean) : []
      setChats(list)
      if (!activeId && list.length){ setActiveId(list[0].id) }
    }).catch(()=>{})
  }

  async function newChat(){
    const model = models[0] || 'gemma3:4b-it-q4_K_M'
    try{
      const r = await fetch(`${API}/chats`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({model})})
      const d = await r.json().catch(()=>({}))
      if (!r.ok){
        const msg = d?.detail || d?.message || 'Failed to create chat.'
        throw new Error(msg)
      }
      const chat = d?.chat
      if (!chat?.id){
        throw new Error('Failed to create chat: missing id.')
      }
      setChats(prev=>[chat, ...prev].filter(Boolean))
      setActiveId(chat.id)
      setLeftMode('chats')
    }catch(err){
      console.error('New chat failed', err)
      notify(err?.message || 'Could not create a new chat. Please try again.', { tone: 'error' })
    }
  }

  async function deleteChat(id){
    await fetch(`${API}/chats/${id}`, {method:'DELETE'})
    setChats(prev=>prev.filter(c=>c.id!==id))
    if (activeId===id){
      const next = chats.find(c=>c.id!==id)
      setActiveId(next?.id || null)
    }
  }

  function onModelChanged(id, model){
    setChats(prev=>prev.map(c=>c.id===id?{...c, model}:c))
  }

  async function renameChatTitle(id, title){
    if (!id) return
    try{
      const res = await fetch(`${API}/chats/${id}/title`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.detail || 'Failed to rename chat')
      const finalTitle = data?.title || title || 'New chat'
      setChats(prev=>prev.map(c=>c.id===id ? {...c, title: finalTitle} : c))
    }catch(err){
      console.error('Rename chat failed', err)
      throw err
    }
  }

  function toggleTheme(){
    if (onToggleTheme){
      onToggleTheme()
      return
    }
    setLocalTheme(t => t==='dark' ? 'light' : 'dark')
  }

  return (
    <div className="ekchat-root" data-theme={theme}>
    <div className="app-shell no-sidebar">
      {/* Top bar */}
      <div className="topbar">
        <div className="brand">
          <div className="brand-copy">
            <div>EKCHAT</div>
            <div className="ekchat-breadcrumb" title={breadcrumb}>{breadcrumb}</div>
          </div>
        </div>
        <div className="topbar-controls">
          <div className="topbar-mode-controls">
            <button
              type="button"
              className={`icon-btn ${leftMode === 'chats' ? 'active' : ''}`}
              title="Chats"
              onClick={()=>setLeftMode('chats')}
            >
              <MessageCircle size={18}/>
            </button>
            <button
              type="button"
              className={`icon-btn ${leftMode === 'generate' ? 'active' : ''}`}
              title="Generate"
              onClick={()=>setLeftMode('generate')}
            >
              <Sparkles size={18}/>
            </button>
          </div>
          {leftMode === 'chats' ? (
            <div className="topbar-chat-controls">
              <select
                className="topbar-select topbar-chat-select"
                value={activeId || ''}
                onChange={(e)=>setActiveId(e.target.value || null)}
              >
                <option value="">Select a chat</option>
                {chats.map((chat)=>(
                  <option key={chat.id} value={chat.id}>
                    {chat.title || 'New chat'}
                  </option>
                ))}
              </select>
              <button className="btn-primary" onClick={newChat}><Plus size={16}/> New</button>
              {activeChat && (
                <button className="btn-secondary" type="button" onClick={()=>deleteChat(activeChat.id)}>
                  Delete
                </button>
              )}
            </div>
          ) : (
            <div className="topbar-generate-controls">
              <select
                className="topbar-select"
                value={generateTab}
                onChange={(e)=>setGenerateTab(e.target.value)}
              >
                <option value="history">Library</option>
                <option value="rfp">Draft Proposal</option>
                <option value="analyze">Analyze Documents</option>
                <option value="edit">Edit</option>
                <option value="sections">Sections</option>
              </select>
              {generateTab === 'history' && (
                <select
                  className="topbar-select topbar-sub-select"
                  value={historySubsection}
                  onChange={(e)=>setHistorySubsection(e.target.value)}
                >
                  <option value="">Library</option>
                  <option value="style">Writing style profile</option>
                  <option value="chat">Chat with your documents</option>
                </select>
              )}
              {generateTab === 'analyze' && (
                <select
                  className="topbar-select topbar-sub-select"
                  value={analyzeSubsection || 'rfp'}
                  onChange={(e)=>setAnalyzeSubsection(e.target.value)}
                >
                  <option value="rfp">Analyze RFP</option>
                </select>
              )}
            </div>
          )}
        </div>
        <div className="actions">
          <button className="icon-btn" title={`Switch to ${theme==='dark'?'Light':'Dark'} theme`} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="main">
        {leftMode === 'generate' ? (
          <GeneratePanel
            api={API}
            models={models}
            defaultModel={activeChat?.model}
            activeTab={generateTab}
            onTabChange={setGenerateTab}
            showTabs={false}
            historySubsection={historySubsection}
            analyzeSubsection={analyzeSubsection}
            onEditNavigate={goToEdit}
          />
        ) : (
          <ChatWindow
            api={API}
            models={models}
            chat={activeChat}
            files={files}
            onFilesChanged={refreshFiles}
            onAutoTitle={refreshChats}
            onModelChanged={onModelChanged}
            onRenameTitle={renameChatTitle}
          />
        )}
      </div>
    </div>
    </div>
  )
}
