import { createTheme } from '@mui/material/styles'
import type { PaletteMode } from '@mui/material/styles'

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark'
  const paperBg = isDark ? '#1e293b' : '#ffffff'
  const defaultBg = isDark ? '#0f172a' : '#f8fafc'
  const border = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.12)'
  const cardGradient = isDark
    ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)'
    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(241, 245, 249, 0.92) 100%)'
  const paperGradient = isDark
    ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)'
    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.93) 100%)'
  const barGradient = isDark
    ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(241, 245, 249, 0.9) 100%)'
  const drawerGradient = isDark
    ? 'linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(241, 245, 249, 0.92) 100%)'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#6366f1',
        light: '#818cf8',
        dark: '#4f46e5',
      },
      secondary: {
        main: '#ec4899',
        light: '#f472b6',
        dark: '#db2777',
      },
      background: {
        default: defaultBg,
        paper: paperBg,
      },
      text: {
        primary: isDark ? '#f1f5f9' : '#0f172a',
        secondary: isDark ? '#cbd5e1' : '#475569',
      },
    },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 700,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          background: cardGradient,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${border}`,
          boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : '0 8px 24px rgba(15, 23, 42, 0.08)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 40px 0 rgba(99, 102, 241, 0.3)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: paperGradient,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${border}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 24px',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: barGradient,
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${border}`,
          boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 4px 16px rgba(15, 23, 42, 0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: drawerGradient,
          backdropFilter: 'blur(20px)',
          borderRight: `1px solid ${border}`,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '4px 8px',
          transition: 'all 0.2s ease',
          '&:hover': {
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
            transform: isDark ? 'translateX(4px)' : 'translateX(3px)',
          },
          '&.Mui-selected': {
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)',
            borderLeft: '3px solid #6366f1',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
  },
  })
}

export default createAppTheme
