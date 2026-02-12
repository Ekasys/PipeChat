import { useState, useCallback } from 'react'

interface ToastState {
  open: boolean
  message: string
  severity: 'success' | 'error' | 'warning' | 'info'
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    severity: 'info',
  })

  const showToast = useCallback((message: string | any, severity: ToastState['severity'] = 'info') => {
    // Ensure message is always a string
    let messageStr = ''
    if (typeof message === 'string') {
      messageStr = message
    } else if (message && typeof message === 'object') {
      // Handle Pydantic validation errors or other error objects
      if (Array.isArray(message)) {
        messageStr = message.map((err: any) => {
          if (typeof err === 'string') return err
          if (err.msg) return err.msg
          return JSON.stringify(err)
        }).join(', ')
      } else if (message.msg) {
        messageStr = message.msg
      } else if (message.message) {
        messageStr = message.message
      } else {
        messageStr = JSON.stringify(message)
      }
    } else {
      messageStr = String(message || 'An error occurred')
    }
    setToast({ open: true, message: messageStr, severity })
  }, [])

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

  return {
    toast,
    showToast,
    hideToast,
  }
}

