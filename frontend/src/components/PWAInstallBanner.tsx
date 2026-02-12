import { useEffect, useMemo, useState } from 'react'
import { Alert, AlertTitle, Box, Button, Collapse, IconButton, LinearProgress } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { usePWAInstallPrompt } from '../hooks/usePWAInstallPrompt'

const STORAGE_KEY = 'pipelinepro-pwa-install-dismissed'

export default function PWAInstallBanner() {
  const { canInstall, promptInstall, isInstalled } = usePWAInstallPrompt()
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  })
  const [installing, setInstalling] = useState(false)
  const [installAccepted, setInstallAccepted] = useState(false)

  const shouldShow = useMemo(() => {
    if (dismissed || isInstalled) return false
    return canInstall || installing
  }, [dismissed, isInstalled, canInstall, installing])

  useEffect(() => {
    if (dismissed && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    }
  }, [dismissed])

  const handleInstall = async () => {
    if (!canInstall) return
    setInstalling(true)
    const accepted = await promptInstall()
    setInstallAccepted(accepted)
    setInstalling(false)
    if (accepted) {
      setTimeout(() => {
        setDismissed(true)
      }, 2500)
    }
  }

  if (!shouldShow) {
    return null
  }

  return (
    <Collapse in={shouldShow} timeout={400}>
      <Alert
        severity={installAccepted ? 'success' : 'info'}
        icon={installAccepted ? <CheckCircleIcon fontSize="inherit" /> : undefined}
        action={
          <Box display="flex" alignItems="center" gap={1}>
            {!installAccepted && (
              <Button
                size="small"
                variant="contained"
                onClick={handleInstall}
                startIcon={<DownloadIcon fontSize="small" />}
                disabled={!canInstall || installing}
              >
                {installing ? 'Installing…' : 'Install app'}
              </Button>
            )}
            <IconButton
              aria-label="dismiss install prompt"
              size="small"
              onClick={() => setDismissed(true)}
              sx={{ color: 'inherit' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        sx={{
          mb: 2,
          border: '1px solid rgba(99, 102, 241, 0.3)',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
        }}
      >
        <AlertTitle>{installAccepted ? 'PipelinePro is installing' : 'Install PipelinePro as an app'}</AlertTitle>
        {installAccepted
          ? 'Great! You can now launch PipelinePro directly from your home screen.'
          : 'Add the app to your device for faster access, offline support, and a full-screen experience.'}
        {installing && (
          <Box mt={1}>
            <LinearProgress color="info" />
          </Box>
        )}
      </Alert>
    </Collapse>
  )
}

