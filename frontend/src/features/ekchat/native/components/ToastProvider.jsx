import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext({ notify: () => {} })
const DEFAULT_DURATION = 5000
const EXIT_DURATION = 180
const MAX_TOASTS = 4
let toastSeed = 0

function makeToastId(){
  if (typeof crypto !== 'undefined' && crypto.randomUUID){
    return crypto.randomUUID()
  }
  toastSeed += 1
  return `toast-${Date.now()}-${toastSeed}`
}

function ToastItem({ toast, onClose }){
  const { id, message, tone, duration } = toast
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const timerRef = useRef(null)
  const exitRef = useRef(null)
  const startedAtRef = useRef(0)
  const remainingRef = useRef(duration)

  const clearTimer = () => {
    if (timerRef.current){
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const clearExit = () => {
    if (exitRef.current){
      clearTimeout(exitRef.current)
      exitRef.current = null
    }
  }

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    clearTimer()
    clearExit()
    exitRef.current = setTimeout(() => onClose(id), EXIT_DURATION)
  }, [id, onClose])

  const startTimer = useCallback(() => {
    if (closingRef.current) return
    if (remainingRef.current <= 0){
      requestClose()
      return
    }
    startedAtRef.current = Date.now()
    clearTimer()
    timerRef.current = setTimeout(requestClose, remainingRef.current)
  }, [requestClose])

  const pauseTimer = () => {
    if (closingRef.current) return
    if (!timerRef.current) return
    clearTimer()
    const elapsed = Date.now() - startedAtRef.current
    remainingRef.current = Math.max(0, remainingRef.current - elapsed)
  }

  const resumeTimer = () => {
    if (closingRef.current) return
    if (timerRef.current) return
    startTimer()
  }

  React.useEffect(() => {
    startTimer()
    return () => {
      clearTimer()
      clearExit()
    }
  }, [startTimer])

  return (
    <div
      className={`toast ${tone} ${closing ? 'closing' : ''}`}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <div className="toast-message">{message}</div>
      <button
        type="button"
        className="toast-close"
        onClick={requestClose}
        aria-label="Dismiss notification"
      >
        X
      </button>
    </div>
  )
}

function ToastViewport({ toasts, onClose }){
  return (
    <div
      className="toast-viewport"
      aria-live="polite"
      aria-atomic="false"
      style={{ position: 'fixed', top: 70, right: 18, bottom: 'auto', left: 'auto', zIndex: 1000 }}
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  )
}

export function ToastProvider({ children, maxToasts = MAX_TOASTS }){
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id)=>{
    setToasts(prev => prev.filter(item => item.id !== id))
  }, [])

  const notify = useCallback((message, options = {})=>{
    const text = (message ?? '').toString().trim()
    if (!text) return
    const { tone = 'info', duration = DEFAULT_DURATION } = options
    const toast = { id: makeToastId(), message: text, tone, duration }
    setToasts(prev => [toast, ...prev].slice(0, maxToasts))
  }, [maxToasts])

  const value = useMemo(()=>({ notify }), [notify])

  const viewport = <ToastViewport toasts={toasts} onClose={removeToast} />

  return (
    <ToastContext.Provider value={value}>
      {children}
      {viewport}
    </ToastContext.Provider>
  )
}

export function useToast(){
  return useContext(ToastContext)
}
