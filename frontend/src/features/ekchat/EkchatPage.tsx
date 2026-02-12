import { Box } from '@mui/material'
import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useThemeMode } from '../../components/ThemeModeContext'
import EkchatRoot from './native/EkchatRoot'
import './native/ekchat.css'

type EkchatNavState = {
  leftMode: 'chats' | 'generate'
  generateTab?: 'history' | 'rfp' | 'analyze' | 'edit' | 'sections'
  historySubsection: string
  analyzeSubsection: string
}

function parseEkchatNavState(search: string) {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')
  const tab = params.get('tab')
  const historySubsection = params.get('historySubsection')
  const analyzeSubsection = params.get('analyzeSubsection')

  const safeMode: EkchatNavState['leftMode'] = mode === 'generate' ? 'generate' : 'chats'
  const safeTab: EkchatNavState['generateTab'] = ['history', 'rfp', 'analyze', 'edit', 'sections'].includes(tab || '')
    ? (tab as EkchatNavState['generateTab'])
    : undefined

  return {
    leftMode: safeMode,
    generateTab: safeTab,
    historySubsection: historySubsection || '',
    analyzeSubsection: analyzeSubsection || '',
  }
}

export default function EkchatPage() {
  const location = useLocation()
  const { mode, toggleMode } = useThemeMode()
  const navState = useMemo(() => parseEkchatNavState(location.search), [location.search])

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        p: 0,
        m: 0,
        display: 'flex',
        overflow: 'hidden',
        '& > *': {
          flex: 1,
          minHeight: 0,
        },
      }}
    >
      <EkchatRoot navState={navState} themeMode={mode} onToggleTheme={toggleMode} />
    </Box>
  )
}
