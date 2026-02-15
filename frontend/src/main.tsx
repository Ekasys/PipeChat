import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import { ThemeProvider, CssBaseline } from '@mui/material'
import App from './App'
import { store } from './store'
import createAppTheme from './theme'
import { ThemeModeProvider, useThemeMode } from './components/ThemeModeContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function AppShell() {
  const { mode } = useThemeMode()
  const theme = React.useMemo(() => createAppTheme(mode), [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeModeProvider>
        <QueryClientProvider client={queryClient}>
          <AppShell />
        </QueryClientProvider>
      </ThemeModeProvider>
    </Provider>
  </React.StrictMode>,
)

const isLocalhostRuntime =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '[::1]'

if (isLocalhostRuntime && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().catch(() => undefined)
    })
  })
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys
        .filter((key) => key.startsWith('pipelinepro-cache-'))
        .forEach((key) => {
          caches.delete(key).catch(() => undefined)
        })
    })
  }
}

if (import.meta.env.PROD && !isLocalhostRuntime && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.error('Service worker registration failed:', error))
  })
}
