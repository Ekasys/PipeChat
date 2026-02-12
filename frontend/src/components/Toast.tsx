import { Snackbar, Alert, AlertColor } from '@mui/material'
import { useState, useEffect } from 'react'

interface ToastProps {
  open: boolean
  message: string
  severity?: AlertColor
  onClose: () => void
  duration?: number
}

export default function Toast({ 
  open, 
  message, 
  severity = 'info', 
  onClose, 
  duration = 3000 
}: ToastProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Alert 
        onClose={onClose} 
        severity={severity} 
        variant="filled"
        sx={{
          background: severity === 'success' 
            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
            : severity === 'error'
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : severity === 'warning'
            ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 600,
        }}
      >
        {typeof message === 'string' ? message : JSON.stringify(message)}
      </Alert>
    </Snackbar>
  )
}

