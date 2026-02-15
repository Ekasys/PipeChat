import React from 'react'
import EkchatApp from './EkchatApp.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'

type EkchatNavState = {
  leftMode: 'chats' | 'generate'
  generateTab?: 'history' | 'rfp' | 'analyze' | 'edit' | 'sections'
  historySubsection: string
  analyzeSubsection: string
}

interface EkchatRootProps {
  navState?: EkchatNavState
  themeMode?: 'dark' | 'light'
  onToggleTheme?: () => void
}

const TypedEkchatApp = EkchatApp as unknown as React.ComponentType<{
  navState?: EkchatNavState
  themeMode?: 'dark' | 'light'
  onToggleTheme?: () => void
}>

class EkchatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown) {
    // Keep this visible in the browser console for quick diagnosis.
    // eslint-disable-next-line no-console
    console.error('[Ekchat] UI crashed', error)
  }

  render() {
    if (this.state.error) {
      const message =
        this.state.error instanceof Error
          ? this.state.error.stack || this.state.error.message
          : String(this.state.error)

      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            padding: 24,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
            color: '#111827',
            background: '#f8fafc',
            overflow: 'auto',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Ekchat failed to load</h2>
          <p style={{ marginTop: 8, marginBottom: 12, color: '#4b5563' }}>
            Open DevTools Console to see the full error. Fixing this usually means a missing import
            or a runtime exception in the ported Ekchat UI.
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              lineHeight: 1.35,
              overflow: 'auto',
              maxHeight: 280,
            }}
          >
            {message}
          </pre>
          <button
            type="button"
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: 'pointer',
            }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default function EkchatRoot({ navState, themeMode, onToggleTheme }: EkchatRootProps) {
  return (
    <EkchatErrorBoundary>
      <ToastProvider>
        <TypedEkchatApp navState={navState} themeMode={themeMode} onToggleTheme={onToggleTheme} />
      </ToastProvider>
    </EkchatErrorBoundary>
  )
}
