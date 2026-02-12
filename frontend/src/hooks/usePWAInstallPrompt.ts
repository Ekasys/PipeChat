import { useCallback, useEffect, useState } from 'react'

export function usePWAInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener('appinstalled', handleAppInstalled)
    return () => window.removeEventListener('appinstalled', handleAppInstalled)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return false
    promptEvent.prompt()
    const choiceResult = await promptEvent.userChoice
    setPromptEvent(null)
    return choiceResult.outcome === 'accepted'
  }, [promptEvent])

  return {
    canInstall: Boolean(promptEvent),
    promptInstall,
    isInstalled,
  }
}

