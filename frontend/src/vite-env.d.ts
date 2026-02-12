/// <reference types="vite/client" />

declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[]
    prompt: () => Promise<void>
    readonly userChoice: Promise<{
      outcome: 'accepted' | 'dismissed'
      platform: string
    }>
  }
}

export {}

