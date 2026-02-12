import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { PaletteMode } from '@mui/material/styles'

const STORAGE_KEY = 'pipelinepro-theme'

type ThemeModeContextValue = {
  mode: PaletteMode
  setMode: (next: PaletteMode) => void
  toggleMode: () => void
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null)

function getInitialMode(): PaletteMode {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

interface ThemeModeProviderProps {
  children: ReactNode
}

export function ThemeModeProvider({ children }: ThemeModeProviderProps) {
  const [mode, setMode] = useState<PaletteMode>(getInitialMode)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
    localStorage.setItem('theme', mode)
    document.documentElement.setAttribute('data-theme-mode', mode)
  }, [mode])

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [mode]
  )

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) {
    throw new Error('useThemeMode must be used inside ThemeModeProvider')
  }
  return ctx
}
